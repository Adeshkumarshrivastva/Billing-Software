import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { PAYMENT_MODES, SERVICE_CATEGORIES } from '../types';

const BillItemSchema = new Schema(
  {
    serviceId: { type: String, required: true },
    service: { type: String, required: true },
    category: { type: String, enum: SERVICE_CATEGORIES, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// Snapshot of the collection captured for this bill (sandbox). Mirrors the
// payments-ledger row; card fields are brand + last four + holder only.
const BillPaymentSchema = new Schema(
  {
    id: { type: String, required: true },
    method: { type: String, enum: PAYMENT_MODES, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['success', 'failed', 'pending'], required: true },
    sandbox: { type: Boolean, default: true },
    reference: { type: String, default: '' },
    cardBrand: { type: String },
    cardLast4: { type: String },
    cardHolder: { type: String },
    cardType: { type: String },
    kioskApprovalCode: { type: String },
    kioskTerminalId: { type: String },
    upiApp: { type: String },
    upiId: { type: String },
    createdAt: { type: String, required: true },
  },
  { _id: false },
);

const BillSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // BILL-1001
    patientId: { type: String, required: true },
    patientName: { type: String, required: true },
    patientPhone: { type: String, default: '' },
    doctor: { type: String, trim: true },
    date: { type: String, required: true },
    items: { type: [BillItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['Pending', 'Paid'], required: true },
    paymentMode: { type: String, enum: PAYMENT_MODES, required: true },
    payment: { type: BillPaymentSchema, default: undefined },
    notes: { type: String, trim: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

export type BillDoc = InferSchemaType<typeof BillSchema>;

export const Bill = models.Bill || model('Bill', BillSchema, 'bills');
