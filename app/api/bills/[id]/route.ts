import { cookies } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { Bill } from '@/lib/models/Bill';
import { Payment } from '@/lib/models/Payment';
import { getBillStatus } from '@/lib/format';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };
type SessionResult = {
  session: Awaited<ReturnType<typeof verifySession>>;
  error: Response | null;
};

async function requireSignedInUser(): Promise<SessionResult> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { session: null, error: jsonError('Sign in required.', 401) };
  const session = await verifySession(token);
  if (!session) return { session: null, error: jsonError('Session expired, please sign in again.', 401) };
  return { session, error: null };
}

// GET /api/bills/:id
export async function GET(_request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const auth = await requireSignedInUser();
    if (auth.error) return auth.error;

    await connectToDatabase();
    const { id } = await params;
    const bill = await Bill.findOne({ id }).lean();
    if (!bill) return jsonError('Bill not found.', 404);
    return jsonOk(bill);
  });
}

// PUT /api/bills/:id — record a payment or edit notes. Body: { paidAmount?, notes? }
// Status is always recomputed from paidAmount vs. amount, never accepted directly from the client.
export async function PUT(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const auth = await requireSignedInUser();
    if (auth.error) return auth.error;
    if (!auth.session) return jsonError('Session expired, please sign in again.', 401);

    await connectToDatabase();
    const { id } = await params;
    const bill = await Bill.findOne({ id });
    if (!bill) return jsonError('Bill not found.', 404);

    const body = await request.json();
    if (body.paidAmount !== undefined) {
      if (auth.session.role !== 'admin') return jsonError('Only admin can record payments.', 403);
      // Whole rupees only — clamp to [0, amount] and round, so a fractional or
      // out-of-range value from a client can never end up stored.
      bill.paidAmount = Math.round(Math.max(0, Math.min(bill.amount, Number(body.paidAmount))));
      bill.status = getBillStatus({ amount: bill.amount, paidAmount: bill.paidAmount });

      // A sandbox collection was run for this payment — attach its record.
      if (body.paymentTxnId) {
        const pay = await Payment.findOne({ id: String(body.paymentTxnId).trim() }).lean() as Record<string, unknown> | null;
        if (!pay) return jsonError('The linked payment was not found.');
        if (pay.status !== 'success') return jsonError('That payment has not completed yet.');
        if (pay.billId && pay.billId !== bill.id) return jsonError('That payment is already attached to another bill.');
        bill.paymentMode = pay.method as typeof bill.paymentMode;
        bill.payment = {
          id: pay.id, method: pay.method, amount: pay.amount, status: pay.status,
          sandbox: pay.sandbox ?? true, reference: pay.reference || '',
          cardBrand: pay.cardBrand, cardLast4: pay.cardLast4, cardHolder: pay.cardHolder,
          cardType: pay.cardType, kioskApprovalCode: pay.kioskApprovalCode, kioskTerminalId: pay.kioskTerminalId,
          upiApp: pay.upiApp, upiId: pay.upiId, createdAt: pay.createdAt,
        } as typeof bill.payment;
        await Payment.updateOne({ id: pay.id }, { billId: bill.id, billNo: bill.id });
      }
    }
    if (body.notes !== undefined) bill.notes = String(body.notes).trim();
    await bill.save();
    return jsonOk(bill);
  });
}
