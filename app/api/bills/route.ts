import { connectToDatabase } from '@/lib/mongodb';
import { Bill } from '@/lib/models/Bill';
import { Patient } from '@/lib/models/Patient';
import { Payment } from '@/lib/models/Payment';
import { ServiceItem } from '@/lib/models/ServiceItem';
import { Profile, PROFILE_KEY } from '@/lib/models/Profile';
import { PAYMENT_MODES } from '@/lib/types';
import { getBillStatus } from '@/lib/format';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';

// The bill embeds a trimmed copy of its payments-ledger row (no PAN, no CVV —
// the ledger itself never stored those either).
function embeddablePayment(pay: Record<string, unknown>) {
  return {
    id: pay.id, method: pay.method, amount: pay.amount, status: pay.status,
    sandbox: pay.sandbox ?? true, reference: pay.reference || '',
    cardBrand: pay.cardBrand, cardLast4: pay.cardLast4, cardHolder: pay.cardHolder,
    cardType: pay.cardType, kioskApprovalCode: pay.kioskApprovalCode, kioskTerminalId: pay.kioskTerminalId,
    upiApp: pay.upiApp, upiId: pay.upiId, createdAt: pay.createdAt,
  };
}

// GET /api/bills — list all bills, newest first.
export async function GET() {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const bills = await Bill.find({}).sort({ createdAt: -1 }).lean();
    return jsonOk(bills);
  });
}

type LineInput = { serviceId: string; quantity: number };

// POST /api/bills — create a bill for a patient visit.
// Body: { patientId?, patientName?, patientPhone?, doctor?, date,
//         items: [{ serviceId, quantity }], discount?, paidAmount?, paymentMode, notes?, id? }
// Prices are always re-read from the services collection here, never trusted from the client.
// Patient resolution: pass an existing patientId, or a patientName that exactly matches
// one — either way the patient must already be registered (see /api/patients); billing
// never creates a patient record itself, that's a separate, deliberate flow.
// Bill number: pass `id` to choose it yourself, or omit it to auto-number sequentially.
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const body = await request.json();

    // Billing and patient registration are two separate flows — a bill can only
    // be raised for someone already registered; it never creates a patient itself.
    let patient = null;
    if (body?.patientId) {
      patient = await Patient.findOne({ id: body.patientId }).lean();
    }
    if (!patient && body?.patientName?.trim()) {
      const name = String(body.patientName).trim();
      patient = await Patient.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
    }
    if (!patient) return jsonError('No registered patient matches — register them from the Patients page first.');

    const lines: LineInput[] = Array.isArray(body?.items) ? body.items : [];
    if (lines.length === 0) return jsonError('Add at least one billable service.');

    const items = [];
    let subtotal = 0;
    for (const line of lines) {
      const service = await ServiceItem.findOne({ id: line.serviceId }).lean();
      if (!service) return jsonError(`Service ${line.serviceId} was not found.`);
      const quantity = Math.max(1, Number(line.quantity) || 1);
      items.push({ serviceId: service.id, service: service.name, category: service.category, quantity, price: service.price });
      subtotal += quantity * service.price;
    }

    // Whole rupees only, everywhere — the app never displays paise, so nothing
    // fractional should ever reach the database (client-side already rounds too,
    // but this is the one place that can't be bypassed).
    const discount = Math.round(Math.max(0, Number(body.discount) || 0));
    const amount = Math.max(0, subtotal - discount);
    let paidAmount = Math.round(Math.min(amount, Math.max(0, Number(body.paidAmount) || 0)));
    let paymentMode = PAYMENT_MODES.includes(body.paymentMode) ? body.paymentMode : 'Cash';

    // A collected payment (from POST /api/payments) is the source of truth for
    // how much was paid and by what method — the client can't override it.
    let embeddedPayment: ReturnType<typeof embeddablePayment> | undefined;
    if (body.paymentTxnId) {
      const pay = await Payment.findOne({ id: String(body.paymentTxnId).trim() }).lean() as Record<string, unknown> | null;
      if (!pay) return jsonError('The linked payment was not found.');
      if (pay.status !== 'success') return jsonError('That payment has not completed yet.');
      if (pay.billId) return jsonError('That payment is already attached to another bill.');
      paymentMode = pay.method as typeof paymentMode;
      paidAmount = Math.round(Math.min(amount, Number(pay.amount) || 0));
      embeddedPayment = embeddablePayment(pay);
    }

    let billId: string;
    if (body.patientId && patient.id && (!body.id || String(body.id).trim() === patient.id)) {
      billId = patient.id;
      if (await Bill.findOne({ id: billId })) return jsonError(`A bill already exists for patient ${patient.id}.`);
    } else if (body.id?.trim()) {
      billId = String(body.id).trim();
      if (await Bill.findOne({ id: billId })) return jsonError(`Bill number ${billId} is already in use — pick another.`);
    } else {
      // Atomically claim the next bill number so two simultaneous bills can never collide.
      const profile = await Profile.findOneAndUpdate({ key: PROFILE_KEY }, { $inc: { nextBillSeq: 1 } }, { returnDocument: 'before', upsert: true });
      billId = `${profile?.billPrefix ?? 'BILL-'}${profile?.nextBillSeq ?? 1001}`;
    }

    const bill = await Bill.create({
      id: billId,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone || (body.patientPhone ? String(body.patientPhone).trim() : ''),
      doctor: body.doctor ? String(body.doctor).trim() : undefined,
      date: body.date,
      items,
      subtotal,
      discount,
      amount,
      paidAmount,
      status: getBillStatus({ amount, paidAmount }),
      paymentMode,
      payment: embeddedPayment,
      notes: body.notes ? String(body.notes).trim() : undefined,
      createdAt: new Date().toISOString(),
    });

    // Point the ledger row at the bill it settled.
    if (embeddedPayment) {
      await Payment.updateOne({ id: embeddedPayment.id }, { billId, billNo: billId });
    }

    return jsonOk(bill, 201);
  });
}
