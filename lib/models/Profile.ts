import { Schema, model, models, type InferSchemaType } from 'mongoose';

// Singleton document — one clinic profile per deployment, always looked up by this key.
export const PROFILE_KEY = 'clinic-profile';

const ProfileSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: PROFILE_KEY },
    name: { type: String, required: true },
    tagline: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    registrationNo: { type: String, default: '' },
    address: { type: String, default: '' },
    currency: { type: String, enum: ['INR', 'USD'], default: 'INR' },
    billPrefix: { type: String, default: 'BILL-' },
    nextBillSeq: { type: Number, default: 1001 },
    upiVpa: { type: String, default: '' }, // clinic UPI ID for collections / QR
    upiName: { type: String, default: '' }, // payee name shown in the payer's UPI app
  },
  { versionKey: false },
);

export type ProfileDoc = InferSchemaType<typeof ProfileSchema>;

export const Profile = models.Profile || model('Profile', ProfileSchema, 'profile');
