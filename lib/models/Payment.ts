import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { PAYMENT_MODES } from '../types';

// The payments ledger — one row per collection attempt (success, failed, or
// pending while the kiosk machine or a QR is still being paid). Card rows keep
// only what the terminal prints on the slip — never a card number or CVV.
const PaymentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // TXN-XXXXXXXX
    billId: { type: String, default: '' },
    billNo: { type: String, default: '' },
    patientName: { type: String, default: '' },
    address: { type: String, default: '' },
    method: { type: String, enum: PAYMENT_MODES, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['success', 'failed', 'pending'], required: true },
    sandbox: { type: Boolean, default: true },
    reference: { type: String, default: '' },
    cardBrand: { type: String },
    cardLast4: { type: String },
    cardHolder: { type: String },
    cardType: { type: String },
    kioskProvider: { type: String },
    kioskTerminalId: { type: String },
    kioskRefId: { type: String },
    kioskApprovalCode: { type: String },
    upiApp: { type: String },
    upiId: { type: String },
    upiUri: { type: String },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

export type PaymentDoc = InferSchemaType<typeof PaymentSchema>;

export const Payment = models.Payment || model('Payment', PaymentSchema, 'payments');
