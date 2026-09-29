import type { Bill, BillStatus, ClinicProfile } from './types';

const currencyLocale: Record<ClinicProfile['currency'], string> = { INR: 'en-IN', USD: 'en-US' };

export function formatCurrency(value: number, currency: ClinicProfile['currency'] = 'INR') {
  return new Intl.NumberFormat(currencyLocale[currency], { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

/** Renders a date as dd-mm-yyyy — the format used everywhere in this app.
 *  Accepts a yyyy-mm-dd string or a full ISO timestamp (only the date part
 *  is used). Returns the input unchanged if it isn't a parseable date. */
export function formatDate(iso: string) {
  if (!iso) return '';
  const datePart = String(iso).slice(0, 10);
  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

/** Coerces a date-ish string to yyyy-mm-dd for storage / <input type="date">.
 *  Accepts yyyy-mm-dd, dd-mm-yyyy, dd/mm/yyyy, or anything Date can parse.
 *  Returns '' when the value can't be understood as a date. */
export function toISODate(input: string | undefined | null): string {
  if (!input) return '';
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Only two states: fully settled reads as "Paid", anything still owed — even a
 *  partial payment already made — reads as "Pending" until it's fully cleared. */
export function getBillStatus(bill: Pick<Bill, 'amount' | 'paidAmount'>): BillStatus {
  return bill.paidAmount >= bill.amount ? 'Paid' : 'Pending';
}

export function timeAgo(iso: string, now: number = Date.now()) {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(new Date(iso).toISOString().slice(0, 10));
}

export function initialsFor(name: string) {
  return name.split(' ').map((word) => word[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/** Turns a loosely-formatted phone number into a wa.me link with a pre-filled
 *  message. A bare 10-digit number is assumed Indian and gets +91 prepended;
 *  anything else is used as-is (digits only). Returns null with no usable number. */
export function whatsAppLink(phone: string | undefined, message: string): string | null {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (!digits) return null;
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}
