'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock3, Users } from 'lucide-react';
import { useEffect } from 'react';
import { formatDate, todayISO } from '@/lib/format';
import { useBilling } from '@/lib/store';

export default function AdminDashboardPage() {
  const { bills, patients, loading, formatCurrency, user } = useBilling();

  useEffect(() => {
    if (!loading && user && user.role !== 'admin') {
      window.location.href = '/';
    }
  }, [loading, user]);

  if (loading) return <div className="page"><div className="card section-card"><h1>Loading admin workspace…</h1></div></div>;

  const collected = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
  const outstandingBills = bills.filter((bill) => bill.status !== 'Paid');
  const outstanding = outstandingBills.reduce((sum, bill) => sum + (bill.amount - bill.paidAmount), 0);
  const todaysVisits = bills.filter((bill) => bill.date === todayISO()).length;
  const recentBills = [...bills].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  const today = todayISO();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{new Date(`${today}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <h1>Hello, {user?.name || 'Admin'}.</h1>
          <p className="subtitle">Full payment history and billing management for admin.</p>
        </div>
      </div>

      <div className="stats-grid cols-3">
        <div className="card stat"><span className="stat-label">Collected</span><span className="stat-value">{loading ? '—' : formatCurrency(collected)}</span><span className="stat-foot"><ArrowUpRight size={13} /> Across {bills.length} bills</span></div>
        <div className="card stat"><span className="stat-label">Outstanding dues</span><span className="stat-value">{loading ? '—' : formatCurrency(outstanding)}</span><span className="stat-foot"><Clock3 size={13} /> {outstandingBills.length} bill{outstandingBills.length === 1 ? '' : 's'} unsettled</span></div>
        <div className="card stat"><span className="stat-label">Patients today</span><span className="stat-value">{loading ? '—' : todaysVisits}</span><span className="stat-foot"><Users size={13} /> {patients.length} registered total</span></div>
      </div>

      <section className="card section-card">
        <div className="section-heading"><h2>Full payment history</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bill number</th><th>Patient</th><th>Date</th><th>Status</th><th>Amount</th><th>Payment</th></tr></thead>
            <tbody>
              {recentBills.map((bill) => (
                <tr key={bill.id}>
                  <td><Link href={`/bills/${encodeURIComponent(bill.id)}`} className="text-link"><strong>{bill.id}</strong></Link></td>
                  <td><div className="customer-name">{bill.patientName}</div><div className="customer-email">{bill.patientPhone}</div></td>
                  <td>{formatDate(bill.date)}</td>
                  <td><span className={`badge ${bill.status.toLowerCase().replace(' ', '-')}`}>{bill.status}</span></td>
                  <td>
                    <strong>{formatCurrency(bill.amount)}</strong>
                    {bill.status !== 'Paid' && <div className="due-note">{formatCurrency(bill.amount - bill.paidAmount)} due</div>}
                  </td>
                  <td>{formatCurrency(bill.paidAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && recentBills.length === 0 && <div className="empty-state">No bills yet.</div>}
        </div>
      </section>
    </div>
  );
}
