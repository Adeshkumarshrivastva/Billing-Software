'use client';
import Link from 'next/link';
import { CheckCircle2, Download, Inbox, MessageCircle, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatDate, initialsFor, whatsAppLink } from '@/lib/format';
import type { Bill, BillStatus } from '@/lib/types';
import { useBilling } from '@/lib/store';
import { PaymentModal } from '@/components/payment-modal';

const filters: Array<BillStatus | 'All'> = ['All', 'Pending', 'Paid'];
const tones = ['tone-0', 'tone-1', 'tone-2'];
function toCsv(rows: { id: string; patient: string; phone?: string; date: string; status: string; amount: number; paid: number }[]) {
  const header = ['Bill', 'Patient', 'Phone', 'Date', 'Status', 'Amount', 'Paid'];
  const lines = rows.map((r) => [r.id, r.patient, r.phone, r.date, r.status, r.amount.toFixed(2), r.paid.toFixed(2)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...lines].join('\n');
}
export default function BillsPage() {
  const { bills, formatCurrency, profile, loading, user } = useBilling();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BillStatus | 'All'>('All');
  const [paying, setPaying] = useState<Bill | null>(null);
  const canManagePayments = user?.role === 'admin';

  // The bill record is admin only — middleware already redirects a regular
  // user server-side; this is the same client-side fallback the admin page uses.
  useEffect(() => {
    if (!loading && user && user.role !== 'admin') {
      window.location.href = '/';
    }
  }, [loading, user]);
  const counts = useMemo(() => {
    const base: Record<string, number> = { All: bills.length, Pending: 0, Paid: 0 };
    bills.forEach((bill) => { base[bill.status] += 1; });
    return base;
  }, [bills]);

  // Collected = actual money in hand (every paidAmount, partial payments included).
  // Outstanding = actual money still owed (amount minus whatever's already paid).
  // These always add up to the total billed, using the real numbers.
  const totals = useMemo(() => {
    const collected = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const outstanding = bills.reduce((sum, bill) => sum + (bill.amount - bill.paidAmount), 0);
    return { collected, outstanding };
  }, [bills]);
  const filtered = bills
    .filter((bill) => filter === 'All' || bill.status === filter)
    .filter((bill) => `${bill.id} ${bill.patientName} ${bill.patientPhone}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const reminderLink = (bill: Bill) =>
    whatsAppLink(bill.patientPhone, `Hi ${bill.patientName}, this is a reminder from ${profile.name} — your bill ${bill.id} has a pending balance of ${formatCurrency(bill.amount - bill.paidAmount)}. Please pay at your earliest convenience. Thank you!`);
  const handleExport = () => {
    const csv = toCsv(filtered.map((bill) => ({ id: bill.id, patient: bill.patientName, phone: bill.patientPhone, date: formatDate(bill.date), status: bill.status, amount: bill.amount, paid: bill.paidAmount })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bills-${filter.toLowerCase().replace(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><p className="eyebrow">Receivables</p><h1>Bills</h1><p className="subtitle">Every patient bill, its dues, and payments collected.</p></div>
      </div>

      <div className="stats-grid">
        <div className="card stat"><span className="stat-label">Total bills</span><span className="stat-value">{loading ? '—' : bills.length}</span><span className="stat-foot">All time</span></div>
        <div className="card stat"><span className="stat-label">Collected</span><span className="stat-value">{loading ? '—' : formatCurrency(totals.collected)}</span><span className="stat-foot"><CheckCircle2 size={13} /> {counts.Paid} fully paid</span></div>
        <div className="card stat"><span className="stat-label">Outstanding dues</span><span className="stat-value" style={{ color: totals.outstanding > 0 ? 'var(--warning)' : undefined }}>{loading ? '—' : formatCurrency(totals.outstanding)}</span><span className="stat-foot">{counts.Pending} bill{counts.Pending === 1 ? '' : 's'} pending</span></div>
        <div className="card stat"><span className="stat-label">Fully paid</span><span className="stat-value">{loading ? '—' : counts.Paid}</span><span className="stat-foot">of {bills.length} bills</span></div>
      </div>

      <div className="toolbar">
        <div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bills or patients" /></div>
        <div className="filter-pills">
          {filters.map((option) => (
            <button key={option} className={`pill ${filter === option ? 'active' : ''}`} onClick={() => setFilter(option)}>{option} <b>{counts[option] ?? 0}</b></button>
          ))}
        </div>
        <button className="icon-button" aria-label="Download bills as CSV" onClick={handleExport}><Download size={16} /></button>
      </div>

      <section className="card section-card">
        <div className="section-heading">
          <div><h2>{filter === 'All' ? 'All bills' : `${filter} bills`}</h2><p className="subtitle" style={{ marginTop: 5 }}>{filtered.length} bill{filtered.length === 1 ? '' : 's'} found</p></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bill number</th><th>Patient</th><th>Date</th><th>Doctor</th><th>Status</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {filtered.map((bill, index) => (
                <tr key={bill.id}>
                  <td><Link href={`/bills/${encodeURIComponent(bill.id)}`} className="text-link"><strong>{bill.id}</strong></Link></td>
                  <td>
                    <div className="customer-cell">
                      <span className={`avatar-chip ${tones[index % tones.length]}`}>{initialsFor(bill.patientName)}</span>
                      <div><div className="customer-name">{bill.patientName}</div><div className="customer-email">{bill.patientPhone}</div></div>
                    </div>
                  </td>
                  <td>{formatDate(bill.date)}</td>
                  <td>{bill.doctor ?? <span className="subtitle">—</span>}</td>
                  <td><span className={`badge ${bill.status.toLowerCase().replace(' ', '-')}`}>{bill.status}</span></td>
                  <td>
                    <strong>{formatCurrency(bill.amount)}</strong>
                    {bill.status !== 'Paid' && <div className="due-note">{formatCurrency(bill.amount - bill.paidAmount)} due</div>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/bills/${encodeURIComponent(bill.id)}`} className="icon-button" aria-label="Download bill"><Download size={14} /></Link>
                      {bill.status !== 'Paid' && reminderLink(bill) && (
                        <a href={reminderLink(bill)!} target="_blank" rel="noopener noreferrer" className="icon-button" aria-label="Send WhatsApp reminder"><MessageCircle size={14} /></a>
                      )}
                      {canManagePayments && bill.status !== 'Paid' && <button className="row-action" onClick={() => setPaying(bill)}>Record payment</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="empty-state">
              <Inbox size={22} style={{ marginBottom: 8, opacity: .5 }} />
              <div>No bills match {query ? 'that search' : 'this filter'}.</div>
            </div>
          )}
        </div>
      </section>
      {paying && <PaymentModal bill={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
