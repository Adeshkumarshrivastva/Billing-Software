import type { CardBrand } from './types';

// ─── Card kiosk (POS terminal) ───────────────────────────────────────────────
// Card payments are taken on the clinic's kiosk machine, not in this app. The
// app pushes the amount to the terminal, the patient taps / swipes / inserts
// there, and the terminal reports back. No card number, expiry or CVV ever
// reaches this codebase — that is the whole point of using a terminal.
//
// Two providers:
//   manual — the default, and what works with any machine on day one. The app
//            books the charge as PENDING; the operator keys the amount into the
//            terminal and settles the row from the printed slip.
//   http   — a real integration. Point KIOSK_API_BASE_URL at the vendor's cloud
//            API (Pine Labs Plutus Smart, Ezetap, Mswipe…) or at a small bridge
//            service running beside the terminal, speaking the contract below.
//
// The `http` contract, all JSON:
//   POST   {base}/charges                  { referenceId, amount, currency,
//                                            terminalId, note } → ChargeReply
//   GET    {base}/charges/{referenceId}                         → ChargeReply
//   POST   {base}/charges/{referenceId}/cancel                  → ChargeReply
//   ChargeReply: { status: 'pending' | 'success' | 'failed',
//                  approvalCode?, rrn?, cardBrand?, cardLast4?, cardType?,
//                  message? }
// Field names are read leniently (approvalCode/auth_code, rrn/reference…) so a
// vendor that is close but not identical still lines up.

export type KioskProvider = 'manual' | 'http';
export type KioskStatus = 'pending' | 'success' | 'failed';

export type KioskResult = {
  status: KioskStatus;
  approvalCode?: string;
  reference?: string; // RRN / retrieval reference printed on the slip
  cardBrand?: CardBrand;
  cardLast4?: string;
  cardType?: string; // CREDIT / DEBIT, as the terminal reports it
  message?: string;
};

export type KioskConfig = {
  provider: KioskProvider;
  terminalId: string;
  baseUrl: string;
  apiKey: string;
  merchantId: string;
  /** How long the machine is given to answer one call before we give up. */
  timeoutMs: number;
};

export function kioskConfig(): KioskConfig {
  const raw = (process.env.KIOSK_PROVIDER || 'manual').trim().toLowerCase();
  const provider: KioskProvider = raw === 'http' ? 'http' : 'manual';
  const timeout = Number(process.env.KIOSK_TIMEOUT_MS);
  return {
    provider,
    terminalId: (process.env.KIOSK_TERMINAL_ID || '').trim(),
    baseUrl: (process.env.KIOSK_API_BASE_URL || '').trim().replace(/\/+$/, ''),
    apiKey: (process.env.KIOSK_API_KEY || '').trim(),
    merchantId: (process.env.KIOSK_MERCHANT_ID || '').trim(),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 10000,
  };
}

const BRANDS: CardBrand[] = ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Discover'];

function pick(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

/** Normalises whatever the terminal replied with into a KioskResult. */
function readReply(body: unknown): KioskResult {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const inner = (raw.data && typeof raw.data === 'object' ? raw.data : raw) as Record<string, unknown>;
  const state = pick(inner, 'status', 'state', 'result', 'responseCode').toLowerCase();

  const status: KioskStatus =
    /^(success|approved|captured|paid|00)$/.test(state)
      ? 'success'
      : /^(fail|failed|declined|cancelled|canceled|error|timeout)$/.test(state)
        ? 'failed'
        : 'pending';

  const brandRaw = pick(inner, 'cardBrand', 'card_brand', 'scheme', 'network');
  const brand = BRANDS.find((b) => b.toLowerCase() === brandRaw.toLowerCase());

  return {
    status,
    approvalCode: pick(inner, 'approvalCode', 'approval_code', 'authCode', 'auth_code') || undefined,
    reference: pick(inner, 'rrn', 'reference', 'referenceNumber', 'retrievalReferenceNumber', 'txnId') || undefined,
    cardBrand: brand ?? (brandRaw ? 'Card' : undefined),
    cardLast4: pick(inner, 'cardLast4', 'card_last4', 'last4', 'maskedCard').replace(/\D/g, '').slice(-4) || undefined,
    cardType: pick(inner, 'cardType', 'card_type') || undefined,
    message: pick(inner, 'message', 'errorMessage', 'responseMessage', 'error') || undefined,
  };
}

async function callTerminal(path: string, init: RequestInit): Promise<KioskResult> {
  const config = kioskConfig();
  if (!config.baseUrl) {
    throw new Error('The kiosk API is not configured. Set KIOSK_API_BASE_URL in .env.local, or leave KIOSK_PROVIDER=manual.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...(config.terminalId ? { 'X-Terminal-Id': config.terminalId } : {}),
        ...(config.merchantId ? { 'X-Merchant-Id': config.merchantId } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reply = readReply(body);
      throw new Error(reply.message || `The kiosk machine returned ${response.status}.`);
    }
    return readReply(body);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The kiosk machine did not respond in time. Check that it is switched on and online.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Pushes the amount to the terminal. `manual` books it and waits for staff. */
export async function startCharge(input: { referenceId: string; amount: number; note?: string }): Promise<KioskResult> {
  const config = kioskConfig();
  if (config.provider === 'manual') {
    return { status: 'pending', message: 'Key the amount into the kiosk machine, then settle it here.' };
  }
  return callTerminal('/charges', {
    method: 'POST',
    body: JSON.stringify({
      referenceId: input.referenceId,
      // Terminals bill in the smallest unit — paise, not rupees.
      amount: Math.round(input.amount * 100),
      currency: 'INR',
      terminalId: config.terminalId,
      merchantId: config.merchantId || undefined,
      note: input.note || undefined,
    }),
  });
}

/** Asks the terminal how a charge went. `manual` stays pending until settled. */
export async function pollCharge(referenceId: string): Promise<KioskResult> {
  if (kioskConfig().provider === 'manual') return { status: 'pending' };
  return callTerminal(`/charges/${encodeURIComponent(referenceId)}`, { method: 'GET' });
}

/** Tells the terminal to drop a charge the operator abandoned. */
export async function cancelCharge(referenceId: string): Promise<KioskResult> {
  if (kioskConfig().provider === 'manual') return { status: 'failed', message: 'Cancelled at the counter.' };
  return callTerminal(`/charges/${encodeURIComponent(referenceId)}/cancel`, { method: 'POST' });
}
