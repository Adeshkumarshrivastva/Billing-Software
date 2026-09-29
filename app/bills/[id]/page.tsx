'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, MessageCircle } from 'lucide-react';
import { formatDate, whatsAppLink } from '@/lib/format';
import { useBilling } from '@/lib/store';

export default function BillDetailPage() {
  const { id: rawId } = useParams<{ id: string }>();
  // Bill numbers can contain spaces ("Bill-Number 0011049002"), so the URL
  // segment arrives percent-encoded — decode it before matching. try/catch
  // guards against a malformed sequence in a hand-typed bill number.
  let id = rawId;
  try { id = decodeURIComponent(rawId); } catch { /* keep raw */ }
  const { bills, profile, formatCurrency, loading, user } = useBilling();
  const bill = bills.find((b) => b.id === id);

  // The bill record is admin only — middleware redirects a regular user
  // server-side; this mirrors that on the client.
  useEffect(() => {
    if (!loading && user && user.role !== 'admin') {
      window.location.href = '/';
    }
  }, [loading, user]);

  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const el = receiptRef.current;
    if (!el || downloading) return;
    setDownloading(true);
    try {
      // Wait for the webfonts + logo so the PDF snapshot isn't missing them.
      if (document.fonts?.ready) await document.fonts.ready;
      // Loaded on demand (browser only) — keeps these heavy libs out of the
      // initial bundle. jsPDF + html2canvas directly, no UMD wrapper in between.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const image = canvas.toDataURL('image/jpeg', 0.98);

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height / canvas.width) * imgW;

      // One page when it fits, otherwise slice the tall image across pages.
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(image, 'JPEG', margin, position, imgW, imgH);
      heightLeft -= pageH - margin;
      while (heightLeft > 0) {
        position = margin - (imgH - heightLeft);
        pdf.addPage();
        pdf.addImage(image, 'JPEG', margin, position, imgW, imgH);
        heightLeft -= pageH;
      }

      const safeName = (bill?.id ?? 'bill').trim().replace(/[^\w.-]+/g, '-') || 'bill';
      pdf.save(`${safeName}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="page"><div className="empty-state">Loading bill…</div></div>;

  if (!bill) {
    return (
      <div className="page">
        <div className="page-header">
          <div><p className="eyebrow">Bill receipt</p><h1>Not found</h1><p className="subtitle">No bill with id &ldquo;{id}&rdquo; exists.</p></div>
        </div>
        <Link href="/bills" className="button secondary"><ArrowLeft size={15} /> Back to bills</Link>
      </div>
    );
  }

  const due = bill.amount - bill.paidAmount;
  const reminderLink = bill.status !== 'Paid'
    ? whatsAppLink(bill.patientPhone, `Hi ${bill.patientName}, this is a reminder from ${profile.name} — your bill ${bill.id} has a pending balance of ${formatCurrency(due)}. Please pay at your earliest convenience. Thank you!`)
    : null;

  return (
    <div className="page receipt-page">
      <div className="page-header no-print">
        <div><p className="eyebrow">Bill receipt</p><h1>{bill.id}</h1><p className="subtitle">Issued {formatDate(bill.date)} to {bill.patientName}</p></div>
        <div className="page-actions">
          <Link href="/bills" className="button secondary"><ArrowLeft size={15} /> Back</Link>
          {reminderLink && (
            <a href={reminderLink} target="_blank" rel="noopener noreferrer" className="button secondary"><MessageCircle size={15} /> WhatsApp reminder</a>
          )}
          <button className="button primary" onClick={handleDownload} disabled={downloading}><Download size={15} /> {downloading ? 'Preparing…' : 'Download bill'}</button>
        </div>
      </div>

      <div className="card receipt" ref={receiptRef}>
        <div className="receipt-head">
          <div className="receipt-brand">
            <img src="/pmc-logo.png" alt={profile.name} />
            <div><strong>{profile.name}</strong>{profile.registrationNo && <small>Reg. {profile.registrationNo}</small>}</div>
          </div>
          <div className="receipt-meta">
            <div><span>Bill No.</span><strong>{bill.id}</strong></div>
            <div><span>Date</span><strong>{formatDate(bill.date)}</strong></div>
            <div><span>Status</span><span className={`badge ${bill.status.toLowerCase().replace(' ', '-')}`}>{bill.status}</span></div>
          </div>
        </div>

        <div className="receipt-parties">
          <div>
            <span>Billed to</span>
            <strong>{bill.patientName}</strong>
            {bill.patientPhone && <small>{bill.patientPhone}</small>}
          </div>
          <div>
            <span>Clinic</span>
            <strong>{profile.name}</strong>
            {profile.address && <small>{profile.address}</small>}
            {profile.phone && <small>{profile.phone}</small>}
            {profile.registrationNo && <small>Reg. {profile.registrationNo}</small>}
          </div>
        </div>

        <table className="receipt-table">
          <thead><tr><th>Service</th><th>Category</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
          <tbody>
            {bill.items.map((item, i) => (
              <tr key={i}>
                <td>{item.service}</td>
                <td>{item.category}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.price)}</td>
                <td>{formatCurrency(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-totals">
          <div><span>Subtotal</span><strong>{formatCurrency(bill.subtotal)}</strong></div>
          {bill.discount > 0 && <div><span>Discount</span><strong>-{formatCurrency(bill.discount)}</strong></div>}
          <div className="grand"><span>Total amount</span><strong>{formatCurrency(bill.amount)}</strong></div>
          <div><span>Paid ({bill.paymentMode})</span><strong>{formatCurrency(bill.paidAmount)}</strong></div>
          {bill.payment && (
            <div>
              <span>Reference</span>
              <strong>
                {bill.payment.id}
                {bill.payment.cardLast4 ? ` · ${bill.payment.cardBrand ?? 'Card'} ••${bill.payment.cardLast4}` : ''}
                {bill.payment.kioskApprovalCode ? ` · auth ${bill.payment.kioskApprovalCode}` : ''}
                {bill.payment.upiApp ? ` · ${bill.payment.upiApp}` : ''}
                {!bill.payment.upiApp && bill.payment.upiId ? ` · ${bill.payment.upiId}` : ''}
              </strong>
            </div>
          )}
          <div className={due > 0 ? 'due' : ''}><span>Balance due</span><strong>{formatCurrency(due)}</strong></div>
        </div>

        {bill.notes && <p className="receipt-notes">{bill.notes}</p>}
        <p className="receipt-footer">Thank you for visiting {profile.name}</p>
      </div>
    </div>
  );
}
