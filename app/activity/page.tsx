'use client';

import Link from 'next/link';
import { CalendarDays, ChevronDown, ChevronRight, Receipt, UserPlus } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import type { Bill } from '@/lib/types';
import { useBilling, type PatientWithStats } from '@/lib/store';

type DayEntry = {
  date: string;
  bills: Bill[];
  billed: number;
  collected: number;
  dues: number;
  patients: PatientWithStats[];
};

export default function ActivityPage() {
  const { bills, patients, formatCurrency, loading, user } = useBilling();
  const isAdmin = user?.role === 'admin';
  const [open, setOpen] = useState<Set<string>>(new Set());

  const days = useMemo<DayEntry[]>(() => {
    const map = new Map<string, DayEntry>();
    const entryFor = (date: string) => {
      let entry = map.get(date);
      if (!entry) {
        entry = { date, bills: [], billed: 0, collected: 0, dues: 0, patients: [] };
        map.set(date, entry);
      }
      return entry;
    };

    for (const bill of bills) {
      const entry = entryFor(bill.date);
      entry.bills.push(bill);
      entry.billed += bill.amount;
      entry.collected += bill.paidAmount;
      entry.dues += Math.max(0, bill.amount - bill.paidAmount);
    }
    for (const patient of patients) {
      const date = (patient.date || patient.createdAt || '').slice(0, 10);
      if (!date) continue;
      entryFor(date).patients.push(patient);
    }

    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [bills, patients]);

  const totalBilled = days.reduce((sum, day) => sum + day.billed, 0);
  const patientsAdded = days.reduce((sum, day) => sum + day.patients.length, 0);

  const toggle = (date: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h1>Day log</h1>
          <p className="subtitle">Every day, at a glance — bills raised and patients registered on that date.</p>
        </div>
      </div>

      <div className="stats-grid cols-3">
        <div className="card stat"><span className="stat-label">Active days</span><span className="stat-value">{loading ? '—' : days.length}</span><span className="stat-foot"><CalendarDays size={13} /> with bills or new patients</span></div>
        <div className="card stat"><span className="stat-label">Bills raised</span><span className="stat-value">{loading ? '—' : bills.length}</span><span className="stat-foot"><Receipt size={13} /> {formatCurrency(totalBilled)} billed in total</span></div>
        <div className="card stat"><span className="stat-label">Patients added</span><span className="stat-value">{loading ? '—' : patientsAdded}</span><span className="stat-foot"><UserPlus size={13} /> {patients.length} registered total</span></div>
      </div>

      <section className="card section-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Bills</th>
                <th>Billed</th>
                <th>Collected</th>
                <th>Dues</th>
                <th>Patients added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const isOpen = open.has(day.date);
                const weekday = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
                return (
                  <Fragment key={day.date}>
                    <tr className="day-row" onClick={() => toggle(day.date)}>
                      <td>
                        <div className="customer-name">{formatDate(day.date)}</div>
                        <div className="customer-email">{weekday}</div>
                      </td>
                      <td><strong>{day.bills.length}</strong></td>
                      <td>{formatCurrency(day.billed)}</td>
                      <td>{formatCurrency(day.collected)}</td>
                      <td>{day.dues > 0 ? <span className="dues-amount">{formatCurrency(day.dues)}</span> : <span className="subtitle">—</span>}</td>
                      <td>{day.patients.length > 0 ? <strong>{day.patients.length}</strong> : <span className="subtitle">—</span>}</td>
                      <td>
                        <span className="expand-hint">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="detail-row">
                        <td colSpan={7}>
                          <div className="detail-panel">
                            <div className="detail-block">
                              <h4>Bills ({day.bills.length})</h4>
                              {day.bills.length === 0 ? (
                                <p className="subtitle">No bills raised on this day.</p>
                              ) : (
                                <ul className="detail-list">
                                  {day.bills.map((bill) => (
                                    <li key={bill.id}>
                                      {isAdmin
                                        ? <Link href={`/bills/${encodeURIComponent(bill.id)}`} className="text-link">{bill.id}</Link>
                                        : <span className="text-link">{bill.id}</span>}
                                      <span>{bill.patientName}</span>
                                      <span className={`badge ${bill.status.toLowerCase()}`}>{bill.status}</span>
                                      <strong>{formatCurrency(bill.amount)}</strong>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!loading && days.length === 0 && <div className="empty-state">No activity yet. Raise a bill or register a patient to see it here.</div>}
        </div>
      </section>

      <style jsx>{`
        .day-row { cursor: pointer; }
        .expand-hint { display: inline-flex; color: var(--muted); }
        .dues-amount { color: var(--warning); font-weight: 700; }
        .detail-row td { padding: 0; background: var(--paper); }
        .detail-row:hover { background: var(--paper); }
        .detail-panel { padding: 18px 12px 22px; }
        .detail-block h4 { margin: 0 0 12px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
        .detail-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .detail-list li { display: flex; align-items: center; gap: 12px; font-size: 12.5px; white-space: nowrap; }
        .detail-list li strong { margin-left: auto; font-family: 'Space Grotesk', sans-serif; }
      `}</style>
    </div>
  );
}
