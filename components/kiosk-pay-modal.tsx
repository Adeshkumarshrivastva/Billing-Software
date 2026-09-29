'use client';

import { CheckCircle2, CreditCard, Loader2, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Payment } from '@/lib/types';

// Card payments run on the clinic's kiosk machine. This popup only pushes the
// amount to it and watches the outcome — no card number, expiry or CVV is ever
// typed here, so nothing sensitive passes through the browser or the server.
//
// Two shapes, decided by the server's KIOSK_PROVIDER:
//   http   — the terminal reports back, so the popup polls until it answers.
//   manual — any machine, no integration. Staff key the amount in, then settle
//            the row here from the printed slip.

type Props = {
  amount: number;
  billNo?: string;
  billId?: string;
  patientName?: string;
  formatCurrency: (value: number) => string;
  onCancel: () => void;
  onPaid: (payment: Payment) => void;
};

type Started = Payment & { provider?: string; terminalId?: string; message?: string };
type Stage = 'idle' | 'waiting' | 'approved' | 'declined';

// How long the machine gets before the popup stops asking (a card read, PIN and
// bank authorisation comfortably fit in three minutes).
const POLL_EVERY_MS = 2500;
const GIVE_UP_AFTER_MS = 3 * 60 * 1000;

async function postPayment<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'The kiosk payment could not be processed.');
  return body as T;
}

export function KioskPayModal({ amount, billNo, billId, patientName, formatCurrency, onCancel, onPaid }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [txn, setTxn] = useState<Started | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Manual settlement, read off the terminal's slip.
  const [approvalCode, setApprovalCode] = useState('');
  const [last4, setLast4] = useState('');

  const manual = txn?.provider !== 'http';
  const settled = stage === 'approved' || stage === 'declined';

  // One timer drives both the on-screen counter and the give-up cut-off.
  useEffect(() => {
    if (stage !== 'waiting') return;
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [stage]);

  const finish = useCallback((payment: Payment) => {
    setTxn((prev) => ({ ...(prev ?? {}), ...payment }));
    if (payment.status === 'success') {
      setStage('approved');
      // Let the tick of confirmation land before the popup closes.
      setTimeout(() => onPaid(payment), 900);
    } else if (payment.status === 'failed') {
      setStage('declined');
    }
  }, [onPaid]);

  // Poll the terminal while it has the card. Manual kiosks never answer on
  // their own, so they are not polled at all.
  const stageRef = useRef(stage);
  stageRef.current = stage;
  useEffect(() => {
    if (stage !== 'waiting' || manual || !txn?.id) return;
    let stop = false;
    const startedAt = Date.now();

    const ask = async () => {
      if (stop || stageRef.current !== 'waiting') return;
      try {
        const payment = await postPayment<Payment>({ action: 'kiosk-status', id: txn.id });
        if (stop) return;
        if (payment.status !== 'pending') { finish(payment); return; }
      } catch (err) {
        if (stop) return;
        setError(err instanceof Error ? err.message : 'Lost contact with the kiosk machine.');
      }
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        setError('The kiosk machine did not finish in time. Check the machine, then retry or cancel.');
        return;
      }
      if (!stop) timer = setTimeout(ask, POLL_EVERY_MS);
    };

    let timer = setTimeout(ask, POLL_EVERY_MS);
    return () => { stop = true; clearTimeout(timer); };
  }, [stage, manual, txn?.id, finish]);

  const sendToKiosk = async () => {
    setBusy(true);
    setError('');
    try {
      const started = await postPayment<Started>({
        action: 'kiosk-start', amount, billId, billNo, patientName,
      });
      setTxn(started);
      if (started.status === 'success') finish(started);
      else { setElapsed(0); setStage('waiting'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the kiosk machine.');
    } finally {
      setBusy(false);
    }
  };

  const settle = async (outcome: 'approved' | 'declined') => {
    if (!txn) return;
    setBusy(true);
    setError('');
    try {
      const payment = await postPayment<Payment>({
        action: 'kiosk-settle', id: txn.id, outcome,
        approvalCode: approvalCode.trim() || undefined,
        last4: last4.trim() || undefined,
      });
      finish(payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not settle this payment.');
    } finally {
      setBusy(false);
    }
  };

  // Leaving mid-charge voids the row so a half-finished charge is never left
  // sitting in the ledger as pending.
  const close = async () => {
    if (txn && stage === 'waiting') {
      try { await postPayment({ action: 'kiosk-cancel', id: txn.id }); } catch { /* the row is abandoned either way */ }
    }
    onCancel();
  };

  const retry = () => { setTxn(null); setStage('idle'); setError(''); setApprovalCode(''); setLast4(''); };

  return (
    <div className="modal-overlay pay-overlay" onClick={busy ? undefined : () => void close()}>
      <div className="card modal-card kiosk" onClick={(e) => e.stopPropagation()}>
        <header className="kiosk-head">
          <div>
            <h2>Card — kiosk machine</h2>
            <p>{billNo ? `${billNo} · ` : ''}{formatCurrency(amount)}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={() => void close()} disabled={busy}><X size={16} /></button>
        </header>

        {error && <p className="kiosk-error">{error}</p>}

        {stage === 'idle' && (
          <div className="kiosk-body">
            <div className="kiosk-icon"><CreditCard size={30} /></div>
            <p className="kiosk-hint">
              Send <strong>{formatCurrency(amount)}</strong> to the kiosk machine, then ask the patient to
              tap, swipe or insert their card on it.
            </p>
            <button type="button" className="button primary kiosk-cta" onClick={sendToKiosk} disabled={busy}>
              {busy ? 'Sending…' : `Send ${formatCurrency(amount)} to kiosk`}
            </button>
          </div>
        )}

        {stage === 'waiting' && (
          <div className="kiosk-body">
            <div className="kiosk-icon spin"><Loader2 size={30} /></div>
            <p className="kiosk-hint">
              <strong>{formatCurrency(amount)}</strong> is on the machine
              {txn?.terminalId ? <> · terminal <strong>{txn.terminalId}</strong></> : null}.
              Ask the patient to tap, swipe or insert their card.
            </p>
            {manual ? (
              <>
                <p className="kiosk-note">Once the slip prints, settle it here.</p>
                <div className="kiosk-row">
                  <label className="kiosk-field">
                    <span>Approval code</span>
                    <input value={approvalCode} onChange={(e) => setApprovalCode(e.target.value.toUpperCase().slice(0, 12))} placeholder="From the slip" autoComplete="off" />
                  </label>
                  <label className="kiosk-field">
                    <span>Card last 4</span>
                    <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" inputMode="numeric" />
                  </label>
                </div>
                <button type="button" className="button primary kiosk-cta" onClick={() => void settle('approved')} disabled={busy}>
                  {busy ? 'Saving…' : 'Approved on the machine'}
                </button>
                <button type="button" className="kiosk-link danger" onClick={() => void settle('declined')} disabled={busy}>Card was declined</button>
              </>
            ) : (
              <>
                <p className="kiosk-note">Waiting for the machine… {elapsed}s</p>
                <button type="button" className="kiosk-link" onClick={() => void close()} disabled={busy}>Cancel this charge</button>
              </>
            )}
          </div>
        )}

        {stage === 'approved' && (
          <div className="kiosk-body">
            <div className="kiosk-icon ok"><CheckCircle2 size={30} /></div>
            <p className="kiosk-hint"><strong>Approved</strong> · {formatCurrency(amount)}</p>
            <p className="kiosk-note">
              {txn?.cardBrand ?? 'Card'}{txn?.cardLast4 ? ` ••${txn.cardLast4}` : ''}
              {txn?.kioskApprovalCode ? ` · auth ${txn.kioskApprovalCode}` : ''}
            </p>
          </div>
        )}

        {stage === 'declined' && (
          <div className="kiosk-body">
            <div className="kiosk-icon bad"><XCircle size={30} /></div>
            <p className="kiosk-hint"><strong>Declined</strong> — nothing was collected.</p>
            <button type="button" className="button primary kiosk-cta" onClick={retry}>Try the card again</button>
            <button type="button" className="kiosk-link" onClick={onCancel}>Use another payment method</button>
          </div>
        )}

        {!settled && (
          <p className="kiosk-foot">The card is read by the machine — no card number or CVV is entered here.</p>
        )}
      </div>

      <style jsx>{`
        .kiosk { max-width: 420px; }
        .kiosk-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
        .kiosk-head h2 { margin: 0; font-size: 17px; }
        .kiosk-head p { margin: 3px 0 0; font-size: 13px; font-weight: 700; color: var(--muted); }
        .kiosk-error { margin: 0 0 12px; padding: 9px 12px; border-radius: 9px; background: #fef2f2; color: #b91c1c; font-size: 12.5px; }
        .kiosk-body { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 6px 0 2px; }
        .kiosk-icon { width: 58px; height: 58px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--primary-soft); color: var(--primary); }
        .kiosk-icon.ok { background: #dcfce7; color: #15803d; }
        .kiosk-icon.bad { background: #fee2e2; color: #b91c1c; }
        .kiosk-icon.spin :global(svg) { animation: kiosk-spin 1s linear infinite; }
        @keyframes kiosk-spin { to { transform: rotate(360deg); } }
        .kiosk-hint { margin: 0; font-size: 13px; line-height: 1.6; color: var(--ink); max-width: 320px; }
        .kiosk-note { margin: 0; font-size: 12px; color: var(--muted); }
        .kiosk-cta { width: 100%; justify-content: center; margin-top: 4px; }
        .kiosk-link { border: 0; background: transparent; color: var(--muted); font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px; }
        .kiosk-link:hover { color: var(--primary); }
        .kiosk-link.danger:hover { color: #b91c1c; }
        .kiosk-row { display: flex; gap: 10px; width: 100%; }
        .kiosk-field { flex: 1; display: flex; flex-direction: column; gap: 5px; text-align: left; }
        .kiosk-field span { font-size: 11.5px; font-weight: 700; color: var(--muted); }
        .kiosk-field input { width: 100%; }
        .kiosk-foot { margin: 16px 0 0; padding-top: 12px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); text-align: center; }
      `}</style>
    </div>
  );
}
