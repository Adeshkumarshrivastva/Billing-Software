import { Schema, model, models, type InferSchemaType } from 'mongoose';

const PrescriptionItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    dose: { type: String, default: '', trim: true },      // "1 tablet"
    frequency: { type: String, default: '', trim: true }, // "1-0-1"
    timing: { type: String, default: '', trim: true },    // "After food"
    duration: { type: String, default: '', trim: true },  // "5 days"
    notes: { type: String, default: '', trim: true },
  },
  { _id: false },
);

// A prescription is a clinical document — no money, no GST, no line prices.
// It snapshots the patient's details so a reprint years later still reads right
// even if the patient record was edited since.
const PrescriptionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // RX-0001
    patientId: { type: String, required: true },
    patientName: { type: String, required: true, trim: true },
    patientAge: { type: Number, min: 0 },
    patientGender: { type: String, enum: ['Male', 'Female', 'Other'] },
    patientPhone: { type: String, default: '' },
    patientAddress: { type: String, default: '' },
    doctor: { type: String, trim: true },
    date: { type: String, required: true },
    complaint: { type: String, default: '', trim: true },
    investigation: { type: String, default: '', trim: true },
    diagnosis: { type: String, trim: true },
    items: { type: [PrescriptionItemSchema], default: [] }, // legacy — the form no longer prescribes medicines
    note: { type: String, default: '', trim: true },
    photos: { type: [String], default: [] }, // data URLs, downscaled client-side
    advice: { type: String, trim: true },
    followUpDate: { type: String, default: '' },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

export type PrescriptionDoc = InferSchemaType<typeof PrescriptionSchema>;

export const Prescription = models.Prescription || model('Prescription', PrescriptionSchema, 'prescriptions');
