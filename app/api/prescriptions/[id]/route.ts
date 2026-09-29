import { connectToDatabase } from '@/lib/mongodb';
import { Prescription } from '@/lib/models/Prescription';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

// GET /api/prescriptions/:id — one prescription.
export async function GET(_request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const { id } = await params;
    const prescription = await Prescription.findOne({ id }).lean();
    if (!prescription) return jsonError('Prescription not found.', 404);
    return jsonOk(prescription);
  });
}

// DELETE /api/prescriptions/:id — discard a prescription.
export async function DELETE(_request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const { id } = await params;
    const result = await Prescription.deleteOne({ id });
    if (result.deletedCount === 0) return jsonError('Prescription not found.', 404);
    return jsonOk({ deleted: true });
  });
}
