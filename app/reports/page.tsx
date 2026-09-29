'use client';

import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { todayISO } from '@/lib/format';
import { useBilling } from '@/lib/store';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReportsPage() {
  const { bills, patients, formatCurrency, loading } = useBilling();
  const today = todayISO();
  const [year, month] = today.split('-');

  // Collected = actual money in hand, Outstanding = actual money still owed —
  // both account for partial payments already made. See app/bills/page.tsx.
  const collectedThisMonth = bills.filter((bill) => bill.date.startsWith(`${year}-${month}`)).reduce((sum, bill) => sum + bill.paidAmount, 0);
  const outstanding = bills.filter((bill) => bill.status !== 'Paid');
  const outstandingTotal = outstanding.reduce((sum, bill) => sum + (bill.amount - bill.paidAmount), 0);

  const billedTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const collectedTotal = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
  const collectionRate = billedTotal > 0 ? (collectedTotal / billedTotal) * 100 : 0;

  const patientsBilled = new Set(bills.map((bill) => bill.patientId)).size;

  const monthlyTotals = months.map((_, index) => bills.filter((bill) => Number(bill.date.slice(5, 7)) === index + 1 && bill.date.startsWith(year)).reduce((sum, bill) => sum + bill.amount, 0));
  const maxMonth = Math.max(1, ...monthlyTotals);

  const topServices = useMemo(() => {
    const byService = new Map<string, { name: string; revenue: number }>();
    for (const bill of bills) {
      for (const item of bill.items) {
        const existing = byService.get(item.serviceId) ?? { name: item.service, revenue: 0 };
        existing.revenue += item.quantity * item.price;
        byService.set(item.serviceId, existing);
      }
    }
    return [...byService.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  }, [bills]);
  const maxServiceRevenue = Math.max(1, ...topServices.map((s) => s.revenue));

  return (
    <div className="page">
      <div className="page-header">
        <div><p className="eyebrow">Business intelligence</p><h1>Reports</h1><p className="subtitle">A clear view of the money moving through the clinic.</p></div>
        <button className="button secondary"><CalendarDays size={15} /> {new Date(`${today}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</button>
      </div>
      <div className="stats-grid">
        <div className="card stat"><span className="stat-label">Collected this month</span><span className="stat-value">{loading ? '—' : formatCurrency(collectedThisMonth)}</span><span className="stat-foot"><ArrowUpRight size={13} /> {bills.filter((b) => b.status === 'Paid').length} bills fully paid</span></div>
        <div className="card stat"><span className="stat-label">Outstanding dues</span><span className="stat-value">{loading ? '—' : formatCurrency(outstandingTotal)}</span><span className="stat-foot" style={{ color: outstanding.length > 0 ? 'var(--warning)' : undefined }}><ArrowDownRight size={13} /> {outstanding.length} bill{outstanding.length === 1 ? '' : 's'} unsettled</span></div>
        <div className="card stat"><span className="stat-label">Patients billed</span><span className="stat-value">{loading ? '—' : patientsBilled}</span><span className="stat-foot"><ArrowUpRight size={13} /> of {patients.length} total</span></div>
        <div className="card stat"><span className="stat-label">Collection rate</span><span className="stat-value">{loading ? '—' : `${collectionRate.toFixed(1)}%`}</span><span className="stat-foot"><ArrowUpRight size={13} /> collected vs. billed</span></div>
      </div>
      <div className="content-grid">
        <section className="card section-card chart-card">
          <div className="section-heading"><div><h2>Billing overview</h2><p className="subtitle" style={{ marginTop: 5 }}>Billed amount · Jan–Dec {year}</p></div><BarChart3 size={19} color="var(--primary)" /></div>
          <div className="chart">
            <div className="chart-grid"><span>{formatCurrency(maxMonth)}</span><span>{formatCurrency(maxMonth / 2)}</span><span>{formatCurrency(0)}</span></div>
            <div className="bars">
              {monthlyTotals.map((total, index) => (
                <div className="bar-column" key={months[index]}>
                  <div className="bar" style={{ height: `${(total / maxMonth) * 100}%` }} title={formatCurrency(total)} />
                  <small>{months[index]}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card section-card">
          <div className="section-heading"><h2>Top services</h2></div>
          {topServices.map((service) => (
            <div className="top-customer" key={service.name}>
              <div className="kpi-line"><strong>{service.name}</strong><span>{formatCurrency(service.revenue)}</span></div>
              <div className="progress"><span style={{ width: `${(service.revenue / maxServiceRevenue) * 100}%` }} /></div>
            </div>
          ))}
          {topServices.length === 0 && <div className="empty-state">No billing activity yet.</div>}
        </section>
      </div>
      <style jsx>{`.chart{height:250px;display:flex;gap:15px}.chart-grid{display:flex;flex-direction:column;justify-content:space-between;color:var(--muted);font-size:10px;padding-bottom:24px}.bars{display:flex;align-items:flex-end;justify-content:space-around;gap:8px;flex:1;border-bottom:1px solid var(--line);background:repeating-linear-gradient(to bottom,transparent,transparent 60px,#eef0f5 61px)}.bar-column{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:8px;flex:1}.bar{width:100%;max-width:30px;background:linear-gradient(180deg,var(--primary-light),var(--primary));border-radius:5px 5px 0 0;min-height:4px}.bar-column small{font-size:10px;color:var(--muted);height:15px}.top-customer{padding:10px 0 5px}.top-customer + .top-customer{margin-top:12px}`}</style>
    </div>
  );
}
