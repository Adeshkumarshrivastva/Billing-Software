// Pure, dependency-free helpers shared by the payments API and the UI.
// Card numbers are never handled here any more — cards are read by the kiosk
// machine (see lib/kiosk.ts), so nothing in this app needs to parse one.

const VPA_RE = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z]{2,64}$/i;

export function validVpa(vpa: string): boolean {
  return VPA_RE.test((vpa || '').trim());
}

/** Builds a UPI intent URI (`upi://pay?...`) — what a QR encodes and what
 *  Google Pay / PhonePe / Paytm open. Amount is fixed to 2 dp per the spec. */
export function buildUpiUri(opts: { pa: string; pn: string; am: number; tn?: string; tr?: string }): string {
  const parts = [
    `pa=${encodeURIComponent(opts.pa)}`,
    `pn=${encodeURIComponent(opts.pn)}`,
    `am=${encodeURIComponent(opts.am.toFixed(2))}`,
    'cu=INR',
  ];
  if (opts.tn) parts.push(`tn=${encodeURIComponent(opts.tn.slice(0, 80))}`);
  if (opts.tr) parts.push(`tr=${encodeURIComponent(opts.tr)}`);
  return `upi://pay?${parts.join('&')}`;
}

/** Short, unambiguous id like TXN-7K2M9QX4 (no 0/O/1/I). */
export function genId(prefix: string, length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${out}`;
}
