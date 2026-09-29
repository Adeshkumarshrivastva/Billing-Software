'use client';

import { QrCode, X } from 'lucide-react';
import { useState } from 'react';
import { type Payment, type PaymentMode, type UpiApp } from '@/lib/types';

// Runs the collection flow (POST /api/payments) and hands the finished Payment
// back to the caller. A popup, locked to one method. Used by New bill and by
// "Record payment" on the bills list. Card is not handled here — it runs on the
// kiosk machine, see components/kiosk-pay-modal.tsx.

type Props = {
  amount: number;
  method: PaymentMode;
  billNo?: string;
  billId?: string;
  patientName?: string;
  formatCurrency: (value: number) => string;
  onCancel?: () => void;
  onPaid: (payment: Payment) => void;
};

// Order per request. Picking one shows the clinic's UPI QR to scan with it.
const UPI_APP_BUTTONS: UpiApp[] = ['PhonePe', 'Google Pay', 'Paytm', 'BHIM'];

async function postPayment(payload: Record<string, unknown>): Promise<Payment & { qr?: string }> {
  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'The payment could not be processed.');
  return body as Payment & { qr?: string };
}

export function CollectPaymentModal({ amount, method, billNo, billId, patientName, formatCurrency, onCancel, onPaid }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [address, setAddress] = useState('');

  const [vpa, setVpa] = useState('');
  const [qr, setQr] = useState('');
  const [pendingTxn, setPendingTxn] = useState<Payment | null>(null);
  const [pickedApp, setPickedApp] = useState<UpiApp | null>(null);

  const meta = { amount, billNo, billId, patientName, address: address.trim() };

  const run = async (fn: () => Promise<Payment>) => {
    setBusy(true);
    setError('');
    try {
      const payment = await fn();
      if (payment.status === 'success') onPaid(payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The payment could not be processed.');
    } finally {
      setBusy(false);
    }
  };

  // Pick an app (or "clinic QR") → book a pending payment and show the clinic's
  // UPI QR. The customer scans it with that app; staff confirm once it's paid.
  const showClinicQr = async (app: UpiApp | null) => {
    setBusy(true);
    setError('');
    try {
      const res = await postPayment({ ...meta, method: 'UPI', upi: { flow: 'qr', app: app || undefined } });
      setQr(res.qr || '');
      setPendingTxn(res);
      setPickedApp(app);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the QR.');
    } finally {
      setBusy(false);
    }
  };

  const payUpiCollect = () => run(() => postPayment({ ...meta, method: 'UPI', upi: { flow: 'collect', vpa: vpa.trim() } }));
  const confirmPending = () => pendingTxn && run(() => postPayment({ action: 'confirm', id: pendingTxn.id }));
  const resetUpi = () => { setPendingTxn(null); setPickedApp(null); setQr(''); };
  const payFlat = (m: PaymentMode) => run(() => postPayment({ ...meta, method: m }));

  return (
    <div className="modal-overlay pay-overlay" onClick={busy ? undefined : onCancel}>
      <div className="card modal-card pay-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Collect payment</h2>
            <p className="subtitle" style={{ margin: 0 }}>{method}{billNo ? ` · ${billNo}` : ''}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onCancel} disabled={busy}><X size={16} /></button>
        </div>

        <div className="pay-amount">
          <span>Amount to collect</span>
          <strong>{formatCurrency(amount)}</strong>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="field full" style={{ marginBottom: 12 }}>
          <label htmlFor="pay-address">Address</label>
          <textarea id="pay-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House no., street, city, state" />
        </div>

        {method === 'UPI' && (
          <div className="pay-panel">
            {pendingTxn ? (
              <div className="upi-waiting">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr && <img src={qr} alt="Scan to pay by UPI" width={200} height={200} />}
                <p>Scan with {pickedApp ?? 'any UPI app'}{pickedApp ? ' or any UPI app' : ''}, then confirm once it&apos;s paid.</p>
                <button type="button" className="button primary pay-cta" onClick={confirmPending} disabled={busy}>
                  {busy ? 'Confirming…' : 'Payment received'}
                </button>
                <button type="button" className="linkish" onClick={resetUpi} disabled={busy}>Choose another way</button>
              </div>
            ) : (
              <>
                <div className="upi-apps">
                  {UPI_APP_BUTTONS.map((app) => (
                    <button type="button" key={app} className="upi-app" onClick={() => showClinicQr(app)} disabled={busy}>{app}</button>
                  ))}
                </div>
                <div className="field">
                  <label htmlFor="vpa">UPI ID</label>
                  <input id="vpa" value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="name@bank" autoComplete="off" />
                </div>
                <button type="button" className="button primary pay-cta" onClick={payUpiCollect} disabled={busy}>
                  {busy ? 'Requesting…' : 'Send collect request'}
                </button>
                <button type="button" className="linkish" onClick={() => showClinicQr(null)} disabled={busy}>
                  <QrCode size={13} /> Show clinic QR
                </button>
              </>
            )}
          </div>
        )}

        {method === 'Cash' && (
          <div className="pay-panel">
            <button type="button" className="button primary pay-cta" onClick={() => payFlat('Cash')} disabled={busy}>
              {busy ? 'Saving…' : `Mark ${formatCurrency(amount)} received`}
            </button>
          </div>
        )}

        {method === 'Insurance' && (
          <div className="pay-panel">
            <button type="button" className="button primary pay-cta" onClick={() => payFlat('Insurance')} disabled={busy}>
              {busy ? 'Saving…' : 'Record insurance payment'}
            </button>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
