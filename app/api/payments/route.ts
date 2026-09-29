import { cookies } from 'next/headers';
import { toDataURL } from 'qrcode';
import { connectToDatabase } from '@/lib/mongodb';
import { Payment } from '@/lib/models/Payment';
import { Profile, PROFILE_KEY } from '@/lib/models/Profile';
import { seedProfile } from '@/lib/seed-data';
import { PAYMENT_MODES, UPI_APPS, type PaymentMode, type UpiApp } from '@/lib/types';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth';
import { buildUpiUri, genId, validVpa } from '@/lib/payments';
import { cancelCharge, kioskConfig, pollCharge, startCharge, type KioskResult } from '@/lib/kiosk';

// Copies whatever the kiosk machine reported onto the ledger row.
function applyKioskResult(payment: Record<string, unknown> & { save: () => Promise<unknown> }, result: KioskResult) {
  if (result.approvalCode) payment.kioskApprovalCode = result.approvalCode;
  if (result.cardBrand) payment.cardBrand = result.cardBrand;
  if (result.cardLast4) payment.cardLast4 = result.cardLast4;
  if (result.cardType) payment.cardType = result.cardType;
  if (result.status === 'success') {
    payment.status = 'success';
    payment.reference = result.reference || result.approvalCode || payment.reference || genId('RRN', 12);
  } else if (result.status === 'failed') {
    payment.status = 'failed';
  }
}

async function requireAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return { error: jsonError('Sign in required.', 401) };
  if (session.role !== 'admin') return { error: jsonError('Only an admin can take payments.', 403) };
  return { error: null };
}

// GET /api/payments?billId=BILL-1042 — the payments ledger, newest first.
export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    await connectToDatabase();
    const billId = new URL(request.url).searchParams.get('billId')?.trim();
    const rows = await Payment.find(billId ? { billId } : {}).sort({ createdAt: -1 }).limit(200).lean();
    return jsonOk(rows);
  });
}

// POST /api/payments
//   kiosk start:  { action: 'kiosk-start', amount, billId?, billNo?, ... }
//   kiosk poll:   { action: 'kiosk-status', id }
//   kiosk settle: { action: 'kiosk-settle', id, outcome, approvalCode?, last4? }
//                 ← manual provider only: the operator reads the printed slip
//   kiosk cancel: { action: 'kiosk-cancel', id }
//   other methods: { method, amount, ... }
//   confirm:   { action: 'confirm', id }        ← marks a pending QR paid
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));

    // ── kiosk (card machine) ─────────────────────────────────────────────────
    // The card never touches this app: the amount is pushed to the terminal,
    // the patient taps / swipes there, and the terminal reports the outcome.
    if (body?.action === 'kiosk-start') {
      const amount = Math.round(Number(body?.amount));
      if (!Number.isFinite(amount) || amount <= 0) return jsonError('Enter a valid amount.');
      const config = kioskConfig();
      const id = genId('TXN');
      const kioskRefId = genId('POS', 10);
      const note = body?.billNo ? String(body.billNo).trim() : 'Clinic bill';

      let started;
      try {
        started = await startCharge({ referenceId: kioskRefId, amount, note });
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : 'Could not reach the kiosk machine.');
      }
      if (started.status === 'failed') {
        return jsonError(started.message || 'The kiosk machine refused the charge.');
      }

      const payment = await Payment.create({
        id,
        billId: body?.billId ? String(body.billId).trim() : '',
        billNo: body?.billNo ? String(body.billNo).trim() : '',
        patientName: body?.patientName ? String(body.patientName).trim() : '',
        address: body?.address ? String(body.address).trim() : '',
        method: 'Card',
        amount,
        status: started.status === 'success' ? 'success' : 'pending',
        sandbox: config.provider === 'manual',
        reference: started.reference || started.approvalCode || '',
        cardBrand: started.cardBrand,
        cardLast4: started.cardLast4,
        cardType: started.cardType,
        kioskProvider: config.provider,
        kioskTerminalId: config.terminalId,
        kioskRefId,
        kioskApprovalCode: started.approvalCode,
        createdAt: new Date().toISOString(),
      });
      return jsonOk({ ...payment.toObject(), provider: config.provider, terminalId: config.terminalId }, 201);
    }

    if (body?.action === 'kiosk-status') {
      const id = String(body?.id || '').trim();
      if (!id) return jsonError('Which payment? A transaction id is required.');
      const payment = await Payment.findOne({ id });
      if (!payment) return jsonError('That payment was not found.', 404);
      if (payment.status !== 'pending') return jsonOk(payment.toObject());
      try {
        const result = await pollCharge(String(payment.kioskRefId || ''));
        applyKioskResult(payment, result);
        if (payment.isModified()) await payment.save();
        return jsonOk({ ...payment.toObject(), message: result.message });
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : 'Could not read the kiosk machine.');
      }
    }

    // Manual provider only — the operator settles the row from the printed slip.
    if (body?.action === 'kiosk-settle') {
      if (kioskConfig().provider !== 'manual') {
        return jsonError('This kiosk reports its own result — it cannot be settled by hand.');
      }
      const id = String(body?.id || '').trim();
      if (!id) return jsonError('Which payment? A transaction id is required.');
      const payment = await Payment.findOne({ id });
      if (!payment) return jsonError('That payment was not found.', 404);
      if (payment.status !== 'pending') return jsonError('This payment has already been settled.');

      const approved = body?.outcome === 'approved';
      applyKioskResult(payment, {
        status: approved ? 'success' : 'failed',
        approvalCode: body?.approvalCode ? String(body.approvalCode).trim().slice(0, 24) : undefined,
        cardLast4: String(body?.last4 ?? '').replace(/\D/g, '').slice(-4) || undefined,
        cardBrand: body?.brand ? String(body.brand).trim() as never : undefined,
      });
      await payment.save();
      return jsonOk(payment.toObject());
    }

    if (body?.action === 'kiosk-cancel') {
      const id = String(body?.id || '').trim();
      if (!id) return jsonError('Which payment? A transaction id is required.');
      const payment = await Payment.findOne({ id });
      if (!payment) return jsonError('That payment was not found.', 404);
      if (payment.status === 'success') return jsonError('That payment already went through.');
      try {
        await cancelCharge(String(payment.kioskRefId || ''));
      } catch {
        // The machine may already have dropped it — the row is voided either way.
      }
      payment.status = 'failed';
      await payment.save();
      return jsonOk(payment.toObject());
    }

    // ── confirm a pending QR payment ──────────────────────────────────────────
    if (body?.action === 'confirm') {
      const id = String(body?.id || '').trim();
      if (!id) return jsonError('Which payment? A transaction id is required.');
      const existing = await Payment.findOne({ id });
      if (!existing) return jsonError('That payment was not found.', 404);
      if (existing.status === 'success') return jsonOk(existing.toObject());
      if (existing.status !== 'pending') return jsonError('This payment can no longer be confirmed.');
      existing.status = 'success';
      existing.reference = existing.reference || genId('UTR', 12);
      await existing.save();
      return jsonOk(existing.toObject());
    }

    // ── initiate ─────────────────────────────────────────────────────────────
    const method = (PAYMENT_MODES as string[]).includes(body?.method) ? (body.method as PaymentMode) : null;
    if (!method) return jsonError('Choose a valid payment method.');
    const amount = Math.round(Number(body?.amount));
    if (!Number.isFinite(amount) || amount <= 0) return jsonError('Enter a valid amount.');

    const base = {
      id: genId('TXN'),
      billId: body?.billId ? String(body.billId).trim() : '',
      billNo: body?.billNo ? String(body.billNo).trim() : '',
      patientName: body?.patientName ? String(body.patientName).trim() : '',
      address: body?.address ? String(body.address).trim() : '',
      method,
      amount,
      sandbox: true,
      createdAt: new Date().toISOString(),
    };

    // Card is never keyed into this app — it goes to the kiosk machine, which
    // is its own action below.
    if (method === 'Card') {
      return jsonError('Card payments run on the kiosk machine — use action "kiosk-start".');
    }

    if (method === 'UPI') {
      const flow = body?.upi?.flow === 'qr' ? 'qr' : 'collect';

      // 'qr' shows the clinic's UPI QR (scannable by any app) and leaves a
      // PENDING row for staff to confirm once the customer has paid.
      if (flow === 'qr') {
        const profile = await Profile.findOneAndUpdate(
          { key: PROFILE_KEY },
          { $setOnInsert: { key: PROFILE_KEY, ...seedProfile } },
          { returnDocument: 'after', upsert: true },
        ).lean() as { upiVpa?: string; upiName?: string; name?: string } | null;
        const pa = (profile?.upiVpa || '').trim();
        if (!validVpa(pa)) return jsonError('Add the clinic UPI ID in Settings before taking UPI payments.');
        const pn = (profile?.upiName || profile?.name || 'Clinic').trim();
        const uri = buildUpiUri({ pa, pn, am: amount, tn: base.billNo || 'Clinic bill', tr: base.id });
        const app = (UPI_APPS as string[]).includes(body?.upi?.app) ? (body.upi.app as UpiApp) : undefined;
        const qr = await toDataURL(uri, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
        const payment = await Payment.create({ ...base, status: 'pending', upiId: pa, upiUri: uri, upiApp: app });
        return jsonOk({ ...payment.toObject(), qr }, 201);
      }

      const vpa = String(body?.upi?.vpa || '').trim();
      if (!validVpa(vpa)) return jsonError('Enter a valid UPI ID, e.g. name@bank.');
      const app = (UPI_APPS as string[]).includes(body?.upi?.app) ? (body.upi.app as UpiApp) : undefined;
      const payment = await Payment.create({
        ...base,
        status: 'success',
        reference: genId('UTR', 12),
        upiApp: app,
        upiId: vpa,
      });
      return jsonOk(payment.toObject(), 201);
    }

    // Cash / Insurance — no gateway leg, just booked into the ledger.
    const payment = await Payment.create({
      ...base,
      status: 'success',
      reference: method === 'Cash' ? 'CASH' : genId('REF', 8),
    });
    return jsonOk(payment.toObject(), 201);
  });
}
