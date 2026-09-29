import { Schema, model, models, type InferSchemaType } from 'mongoose';

const PatientSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // PAT-0001, shown to staff
    name: { type: String, required: true, trim: true },
    // Optional at the DB layer so a patient can be created inline from the billing
    // screen with just a name; the dedicated registration form still asks for these.
    age: { type: Number, min: 0 },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true },
    address: { type: String, trim: true },
    guardianName: { type: String, trim: true },
    date: { type: String, trim: true }, // yyyy-mm-dd registration date (shown dd-mm-yyyy)
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

export type PatientDoc = InferSchemaType<typeof PatientSchema>;

export const Patient = models.Patient || model('Patient', PatientSchema);
