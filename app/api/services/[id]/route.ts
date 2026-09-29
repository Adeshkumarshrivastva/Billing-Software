import { connectToDatabase } from '@/lib/mongodb';
import { ServiceItem } from '@/lib/models/ServiceItem';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

// PUT /api/services/:id — edit a catalog item's name/price/category.
export async function PUT(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const { id } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    for (const key of ['name', 'category'] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    // Whole rupees only, same as everywhere else in the app.
    if (body.price !== undefined) patch.price = Math.max(0, Math.round(Number(body.price)));
    const service = await ServiceItem.findOneAndUpdate({ id }, patch, { returnDocument: 'after' }).lean();
    if (!service) return jsonError('Service not found.', 404);
    return jsonOk(service);
  });
}

// DELETE /api/services/:id — remove a catalog item (past bills keep their own snapshot, so history is unaffected).
export async function DELETE(_request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const { id } = await params;
    const result = await ServiceItem.deleteOne({ id });
    if (result.deletedCount === 0) return jsonError('Service not found.', 404);
    return jsonOk({ deleted: true });
  });
}
