'use client';

import { ArrowRight, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Bill, Payment } from '@/lib/types';
import { useBilling } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { CollectPaymentModal } from '@/components/collect-payment-modal';
import { KioskPayModal } from '@/components/kiosk-pay-modal';

// Shared by the Bills list and the Dashboard's "Recent bills" table so both
// use the exact same record-payment flow instead of two copies of the logic.
// Step 1 picks how much to collect; step 2 collects it — card goes to the
// kiosk machine, everything else to the in-app flow.
export function PaymentModal({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { formatCurrency, recordPayment } = useBilling();
  const { showToast } = useToast();
  const due = bill.amount - bill.paidAmount;
  const [amount, setAmount] = useState(due);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<'amount' | 'collect'>('amount');

  // Whole rupees only — the app never shows paise, so nothing should ever produce them.
  const setQuickAmount = (fraction: number) => setAmount(Math.round(due * fraction));

  const toCollect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid amount.'); return; }
    if (amount > due) { setError('That is more than the balance due.'); return; }
    setError('');
    setStage('collect');
  };

  const onPaid = async (payment: Payment) => {
    try {
      await recordPayment(bill.id, bill.paidAmount + amount, payment.id);
      showToast(`Payment recorded · ${payment.id}`);
      onClose();
    } catch (err) {
      setStage('amount');
      setError(err instanceof Error ? err.message : 'Could not record this payment.');
    }
  };

  if (stage === 'collect') {
    if (bill.paymentMode === 'Card') {
      return (
        <KioskPayModal
          amount={amount}
          billNo={bill.id}
          billId={bill.id}
          patientName={bill.patientName}
          formatCurrency={formatCurrency}
          onCancel={() => setStage('amount')}
          onPaid={onPaid}
        />
      );
    }
    return (
      <CollectPaymentModal
        amount={amount}
        billNo={bill.id}
        billId={bill.id}
        patientName={bill.patientName}
        method={bill.paymentMode}
        formatCurrency={formatCurrency}
        onCancel={() => setStage('amount')}
        onPaid={onPaid}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="card modal-card" onClick={(event) => event.stopPropagation()} onSubmit={toCollect}>
        <div className="modal-head"><h2>Record payment</h2><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
        {error && <div className="modal-error">{error}</div>}
        <p className="subtitle" style={{ marginBottom: 14 }}>{bill.id} · {bill.patientName}</p>

        <div className="breakdown">
          <div className="breakdown-line"><span>Bill total</span><strong>{formatCurrency(bill.amount)}</strong></div>
          <div className="breakdown-line"><span>Already paid</span><strong>{formatCurrency(bill.paidAmount)}</strong></div>
          <div className="breakdown-line total"><span>Balance due</span><strong>{formatCurrency(due)}</strong></div>
        </div>

        <div className="field">
          <label>Quick amount</label>
          <div className="quick-amounts">
            {[0.25, 0.5, 0.75, 1].map((fraction) => {
              const value = Math.round(due * fraction);
              const isActive = amount === value;
              return (
                <button type="button" key={fraction} className={`quick-amount-btn ${isActive ? 'active' : ''}`} onClick={() => setQuickAmount(fraction)}>
                  {fraction === 1 ? 'Full' : `${fraction * 100}%`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-grid">
          <div className="field full">
            <label htmlFor="amount">Amount to collect now</label>
            <input id="amount" type="number" min="1" step="1" max={due} value={amount} onChange={(event) => setAmount(Math.round(Number(event.target.value)))} autoFocus />
          </div>
        </div>

        <div className={`balance-preview ${due - amount <= 0 ? 'clear' : ''}`}>
          <span>Balance remaining after this payment</span>
          <strong>{formatCurrency(Math.max(0, due - amount))}</strong>
        </div>

        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary">Continue to payment <ArrowRight size={14} /></button>
        </div>
      </form>
    </div>
  );
}
