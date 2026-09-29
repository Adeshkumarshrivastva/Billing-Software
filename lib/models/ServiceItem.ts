import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { SERVICE_CATEGORIES } from '../types';

const ServiceItemSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // SVC-001
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: SERVICE_CATEGORIES, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { versionKey: false },
);

export type ServiceItemDoc = InferSchemaType<typeof ServiceItemSchema>;

// Collection is named "services" (model name singular "ServiceItem" avoids clashing
// with the DOM/Node built-in name "Service").
export const ServiceItem = models.ServiceItem || model('ServiceItem', ServiceItemSchema, 'services');
