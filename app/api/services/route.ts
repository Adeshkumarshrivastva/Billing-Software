import { connectToDatabase } from '@/lib/mongodb';
import { ServiceItem } from '@/lib/models/ServiceItem';
import { SERVICE_CATEGORIES } from '@/lib/types';
import { jsonError, jsonOk, nextSequentialId, withErrorHandling } from '@/lib/api-utils';

// GET /api/services?q=search — list the billable service catalog (consultations, tests, procedures, room charges, pharmacy).
export async function GET(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const q = new URL(request.url).searchParams.get('q')?.trim();
    const filter = q ? { name: new RegExp(q, 'i') } : {};
    const services = await ServiceItem.find(filter).sort({ category: 1, name: 1 }).lean();
    return jsonOk(services);
  });
}

// POST /api/services — add a new billable item. Body: { name, category, price }
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const body = await request.json();
    if (!body?.name || !SERVICE_CATEGORIES.includes(body.category) || body.price === undefined) {
      return jsonError('name, a valid category, and price are required.');
    }
    const id = await nextSequentialId('SVC', ServiceItem);
    const service = await ServiceItem.create({
      id,
      name: String(body.name).trim(),
      category: body.category,
      price: Math.max(0, Math.round(Number(body.price))),
    });
    return jsonOk(service, 201);
  });
}
