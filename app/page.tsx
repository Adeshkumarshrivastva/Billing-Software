'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock3, ShieldCheck, Users } from 'lucide-react';
import { todayISO } from '@/lib/format';
import { useBilling } from '@/lib/store';

export default function DashboardPage() {
  const { bills, loading, user, formatCurrency, patients } = useBilling();
  const isAdmin = user?.role === 'admin';

  if (loading) {
    return <div className="page"><div className="card section-card"><h1>Loading your workspace…</h1></div></div>;
  }

  const recentBills = [...bills].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const totalBilled = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const outstanding = bills.reduce((sum, bill) => sum + (bill.amount - bill.paidAmount), 0);
  const paidCount = bills.filter((bill) => bill.status === 'Paid').length;
  const todaysVisits = bills.filter((bill) => bill.date === todayISO()).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          {/* <p className="eyebrow">User dashboard</p> */}
          <h1>Hello, {user?.name || 'User'}.</h1>
          <p className="subtitle">Your billing overview, patient activity, and clinic performance at a glance.</p>
        </div>
      </div>

      <div className="stats-grid cols-4">
        <div className="card stat">
          <span className="stat-label">Total billed</span>
          <span className="stat-value">{formatCurrency(totalBilled)}</span>
          <span className="stat-foot"><ArrowUpRight size={13} /> Across {bills.length} bills</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Outstanding</span>
          <span className="stat-value">{formatCurrency(outstanding)}</span>
          <span className="stat-foot"><Clock3 size={13} /> {bills.filter((bill) => bill.status !== 'Paid').length} pending</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Settled</span>
          <span className="stat-value">{paidCount}</span>
          <span className="stat-foot"><ShieldCheck size={13} /> Fully paid bills</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Patients today</span>
          <span className="stat-value">{todaysVisits}</span>
          <span className="stat-foot"><Users size={13} /> {patients.length} registered</span>
        </div>
      </div>

      <section className="card section-card">
        <div className="section-heading">
          <div><h2>Recent billing activity</h2></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Patient</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBills.map((bill) => (
                <tr key={bill.id}>
                  <td>{isAdmin ? <Link href={`/bills/${encodeURIComponent(bill.id)}`} className="text-link"><strong>{bill.id}</strong></Link> : <strong>{bill.id}</strong>}</td>
                  <td>{bill.patientName}</td>
                  <td>{bill.date}</td>
                  <td><strong>{formatCurrency(bill.amount)}</strong></td>
                  <td><span className={`badge ${bill.status.toLowerCase().replace(' ', '-')}`}>{bill.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentBills.length === 0 && <div className="empty-state">No billing activity yet.</div>}
        </div>
      </section>
    </div>
  );
}
