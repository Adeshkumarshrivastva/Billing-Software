'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { todayISO } from '@/lib/format';
import { PAYMENT_MODES, type Payment, type PaymentMode } from '@/lib/types';
import { useBilling } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { CollectPaymentModal } from '@/components/collect-payment-modal';
import { KioskPayModal } from '@/components/kiosk-pay-modal';

type Line = { serviceId: string; quantity: number };

export default function NewBillPage() {
  const router = useRouter();
  const { patients, services, nextBillNumber, addBill, formatCurrency, loading, user } = useBilling();
  const { showToast } = useToast();

  // Raising a bill is admin only — middleware redirects a regular user
  // server-side; this mirrors that on the client.
  useEffect(() => {
    if (!loading && user && user.role !== 'admin') {
      window.location.href = '/';
    }
  }, [loading, user]);

  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [billNumber, setBillNumber] = useState('');
  // The next serial is shown in the field as soon as the clinic profile loads,
  // so the user can see which number this bill will get. Once they edit it by
  // hand we stop syncing; an untouched value is still assigned authoritatively
  // by the server on save (avoids a stale number if another bill was raised
  // meanwhile).
  const billNumberTouched = useRef(false);
  const [doctor, setDoctor] = useState('');
  const [date, setDate] = useState(todayISO());
  const [discountPct, setDiscountPct] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [fullyPaid, setFullyPaid] = useState(true);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<Line[]>(services[0] ? [{ serviceId: services[0].id, quantity: 1 }] : []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [armGateway, setArmGateway] = useState(false);

  // services load asynchronously from the API, so the very first render has none —
  // fill in a default line once the catalog actually arrives.
  useEffect(() => {
    if (lineItems.length === 0 && services[0]) setLineItems([{ serviceId: services[0].id, quantity: 1 }]);
  }, [services, lineItems.length]);

  const matchedPatient = useMemo(
    () => patients.find((p) => p.name.trim().toLowerCase() === patientName.trim().toLowerCase()),
    [patients, patientName],
  );

  // Picking a registered patient pulls their details in — done once per patient
  // so a phone number corrected by hand isn't overwritten on the next keystroke.
  const syncedId = useRef<string | null>(null);
  useEffect(() => {
    if (matchedPatient && matchedPatient.id !== syncedId.current) {
      syncedId.current = matchedPatient.id;
      setPatientPhone(matchedPatient.phone ?? '');
    }
    if (!matchedPatient) syncedId.current = null;
  }, [matchedPatient]);

  // Existing patients use their patient ID as the bill number.
  useEffect(() => {
    if (matchedPatient) {
      billNumberTouched.current = false;
      setBillNumber(matchedPatient.id);
    } else if (!loading && !billNumberTouched.current) {
      setBillNumber(nextBillNumber);
    }
  }, [loading, matchedPatient, nextBillNumber]);

  const linesWithService = lineItems
    .map((line) => ({ line, service: services.find((s) => s.id === line.serviceId) }))
    .filter((entry): entry is { line: Line; service: NonNullable<typeof entry.service> } => Boolean(entry.service));

  const subtotal = useMemo(() => linesWithService.reduce((sum, { line, service }) => sum + line.quantity * service.price, 0), [linesWithService]);
  // Discount is entered as a percentage; the flat rupee amount stored on the bill
  // is derived from the current subtotal (whole rupees, like everywhere else).
  const discount = Math.round((subtotal * discountPct) / 100);
  const amount = Math.max(0, subtotal - discount);

  const updateLine = (index: number, patch: Partial<Line>) => setLineItems(lineItems.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const removeLine = (index: number) => setLineItems(lineItems.filter((_, i) => i !== index));

  // Card / UPI (paid in full) collect through the gateway in a popup;
  // the returned Payment then rides along to the bills API, which trusts it for
  // the paid amount and mode. Cash / Insurance / "not paid yet" save straight away.
  const needsGateway = fullyPaid && amount > 0 && (paymentMode === 'Card' || paymentMode === 'UPI');
  const formReady = !!patientName.trim() && linesWithService.length > 0 && amount > 0;

  // Card opens the card-details popup the instant it's picked — the patient and
  // services don't have to be filled in first. (Only when there's actually money
  // to collect: a ₹0 bill or "not paid yet" has nothing to charge.) UPI still
  // "arms" instead — its popup waits until the bill is ready. Cancelling either
  // just closes it; the primary button reopens it.
  const handlePaymentModeChange = (mode: PaymentMode) => {
    setPaymentMode(mode);
    setError('');
    setArmGateway(mode === 'UPI');
    if (mode === 'Card' && fullyPaid && amount > 0) setCollecting(true);
  };

  useEffect(() => {
    if (armGateway && needsGateway && formReady && !collecting && !saving) {
      setCollecting(true);
      setArmGateway(false);
    }
  }, [armGateway, needsGateway, formReady, collecting, saving]);

  const save = () => {
    setError('');
    if (!patientName.trim()) { setError('Enter the patient’s name.'); return; }
    if (linesWithService.length === 0) { setError('Add at least one service.'); return; }
    // An unmatched name is fine — the store registers the patient on save.
    if (needsGateway) { setCollecting(true); return; }
    void finalize(null);
  };

  const finalize = async (payment: Payment | null) => {
    setCollecting(false);
    // The card popup can be opened before the rest of the bill is filled in, so
    // re-check here rather than trusting save()'s checks to have run.
    if (!patientName.trim()) { setError('Enter the patient’s name, then take the card payment again.'); return; }
    if (linesWithService.length === 0) { setError('Add at least one service, then take the card payment again.'); return; }
    setSaving(true);
    try {
      await addBill({
        // Untouched → let the server assign the next number authoritatively;
        // only send a manual override when the user actually edited the field.
        id: matchedPatient?.id || (billNumberTouched.current ? billNumber.trim() || undefined : undefined),
        patientId: matchedPatient?.id,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim() || undefined,
        doctor: doctor || undefined,
        date,
        discount,
        paidAmount: payment ? payment.amount : fullyPaid ? amount : 0,
        paymentMode: payment ? payment.method : paymentMode,
        paymentTxnId: payment?.id,
        notes: notes || undefined,
        items: linesWithService.map(({ line }) => ({ serviceId: line.serviceId, quantity: line.quantity })),
      });
      showToast(payment ? `Payment received · ${payment.id}` : 'Bill created successfully.');
      router.push('/bills');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this bill.');
    } finally {
      setSaving(false);
    }
  };

  const noServices = services.length === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link href="/bills" className="text-link"><ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to bills</Link>
          <p className="eyebrow" style={{ marginTop: 20 }}>New bill</p>
          <h1></h1>
          {/* <p className="subtitle">Add the services provided today — no GST, healthcare billing is tax-exempt.</p> */}
        </div>
      </div>

      {noServices && (
        <div className="notice-banner"><span>Add a <Link href="/services">service</Link> before billing.</span></div>
      )}

      <div className="content-grid">
        <section className="card section-card">
          {error && <div className="modal-error">{error}</div>}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="patient">Patient name</label>
              <input id="patient" list="known-patients" value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="Patient name" autoComplete="off" />
              <datalist id="known-patients">{patients.map((p) => <option key={p.id} value={p.name} />)}</datalist>
            </div>
            <div className="field"><label htmlFor="patientPhone">Patient phone</label><input id="patientPhone" value={patientPhone} onChange={(event) => setPatientPhone(event.target.value)} placeholder="Phone number" /></div>
            <div className="field">
              <label htmlFor="bill-number">Bill number</label>
              <input id="bill-number" value={billNumber} readOnly={!!matchedPatient} onChange={(event) => { billNumberTouched.current = true; setBillNumber(event.target.value); }} placeholder={nextBillNumber} />
            </div>
            <div className="field"><label htmlFor="doctor">Doctor</label><input id="doctor" value={doctor} onChange={(event) => setDoctor(event.target.value)} placeholder="Doctor name" /></div>
            <div className="field"><label htmlFor="date">Visit date</label><input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
            <div className="field">
              <label htmlFor="paymentMode">Payment mode</label>
              <select id="paymentMode" value={paymentMode} onChange={(event) => handlePaymentModeChange(event.target.value as PaymentMode)}>{PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select>
            </div>

            <div className="field full">
              <label>Services</label>
              <div className="table-wrap">
                <table className="items-table">
                  <thead><tr><th>Service</th><th>Qty</th><th>Rate</th><th></th><th>Amount</th><th></th></tr></thead>
                  <tbody>
                    {linesWithService.map(({ line, service }, index) => (
                      <tr key={`${line.serviceId}-${index}`}>
                        <td>
                          <select value={line.serviceId} onChange={(event) => updateLine(index, { serviceId: event.target.value })}>
                            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td><input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value)) })} aria-label="Quantity" /></td>
                        <td>{formatCurrency(service.price)}</td>
                        <td><span className="category-chip">{service.category}</span></td>
                        <td><strong>{formatCurrency(line.quantity * service.price)}</strong></td>
                        <td>{lineItems.length > 1 && <button className="icon-button" onClick={() => removeLine(index)} aria-label="Remove line item"><Trash2 size={15} /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="field">
              <label htmlFor="discount">Discount % (optional)</label>
              <input id="discount" type="number" min="0" max="100" step="1" placeholder="0" value={discountPct === 0 ? '' : discountPct} onChange={(event) => setDiscountPct(Math.min(100, Math.max(0, Math.round(Number(event.target.value)))))} />
              {discountPct > 0 && <p className="form-hint">{discountPct}% of {formatCurrency(subtotal)} = −{formatCurrency(discount)}</p>}
            </div>
            <div className="field">
              <label htmlFor="fullyPaid">Payment received?</label>
              <select id="fullyPaid" value={fullyPaid ? 'yes' : 'no'} onChange={(event) => setFullyPaid(event.target.value === 'yes')}>
                <option value="yes">Paid in full now</option>
                <option value="no">Not paid yet (add to dues)</option>
              </select>
            </div>
            {/* <div className="field full"><label htmlFor="notes">Notes</label><textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" /></div> */}
          </div>
          <div className="form-actions">
            <Link href="/bills" className="button secondary">Cancel</Link>
            <button className="button primary" onClick={save} disabled={noServices || saving || collecting}>
              {saving ? 'Saving…' : needsGateway ? `Collect ${formatCurrency(amount)} & save` : 'Save bill'}
            </button>
          </div>
        </section>

        <aside className="card section-card invoice-preview">
          <div className="section-heading"><h2>Summary</h2><span className="badge pending">{fullyPaid ? 'PAID' : 'DUE'}</span></div>
          <div className="preview-line"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
          <div className="preview-line"><span>Discount{discountPct > 0 ? ` (${discountPct}%)` : ''}</span><span>− {formatCurrency(discount)}</span></div>
          <div className="preview-total"><span>Total due</span><strong>{formatCurrency(amount)}</strong></div>
          <div className="preview-note">
            Payment mode: {paymentMode}<br />
            {fullyPaid ? 'Marked as paid in full.' : `${formatCurrency(amount)} will be added to outstanding dues.`}
          </div>
        </aside>
      </div>
      <style jsx>{`.invoice-preview{height:max-content}.preview-line,.preview-total{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line);font-size:13px}.preview-total{font-size:16px;border:0;padding-top:18px}.preview-note{background:var(--paper);border-radius:9px;padding:12px;color:var(--muted);font-size:11px;line-height:1.6}`}</style>

      {collecting && paymentMode === 'Card' && (
        <KioskPayModal
          amount={amount}
          billNo={billNumber.trim() || nextBillNumber}
          patientName={patientName.trim()}
          formatCurrency={formatCurrency}
          onCancel={() => setCollecting(false)}
          onPaid={(payment) => void finalize(payment)}
        />
      )}
      {collecting && paymentMode !== 'Card' && (
        <CollectPaymentModal
          amount={amount}
          method={paymentMode}
          billNo={billNumber.trim() || nextBillNumber}
          patientName={patientName.trim()}
          formatCurrency={formatCurrency}
          onCancel={() => setCollecting(false)}
          onPaid={(payment) => void finalize(payment)}
        />
      )}
    </div>
  );
}
