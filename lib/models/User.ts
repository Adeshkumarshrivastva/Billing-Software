import { Schema, model, models, type InferSchemaType } from 'mongoose';

// Staff accounts — anyone billing a patient must be signed in as one of these.
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, default: '', unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User = models.User || model('User', UserSchema, 'users');
