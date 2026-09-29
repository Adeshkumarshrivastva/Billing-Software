import { connectToDatabase } from '@/lib/mongodb';
import { Patient } from '@/lib/models/Patient';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';
import { toISODate } from '@/lib/format';

type Params = { params: Promise<{ id: string }> };

// Ids are stored as PAT-0001. Callers shouldn't have to match that exactly —
// "7", "pat7", "PAT-7" and "pat-0007" all mean the same record, which matters
// when the number is read off a card or typed in a hurry at the counter.
function normaliseId(input: string): string {
  const raw = String(input ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const digits = raw.replace(/^PAT-?/, '');
  return /^\d+$/.test(digits) ? `PAT-${digits.padStart(4, '0')}` : raw;
}

// GET /api/patients/:id — one patient record, everything captured at
// registration. This is what every screen fills its patient fields from.
export async function GET(_request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const { id } = await params;
    const patient = await Patient.findOne({ id: normaliseId(id) }).lean();
    if (!patient) return jsonError('Patient not found.', 404);
    return jsonOk(patient);
  });
}

// PUT /api/patients/:id — update editable fields on an existing patient.
// Deactivation is one-way: once a patient is Inactive, nothing can flip them
// back to Active through this route — enforced here, not just in the UI.
export async function PUT(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const id = normaliseId((await params).id);
    const existing = await Patient.findOne({ id }).lean();
    if (!existing) return jsonError('Patient not found.', 404);

    const body = await request.json();
    if (existing.status === 'Inactive' && body.status !== undefined && body.status !== 'Inactive') {
      return jsonError('This patient was deactivated and cannot be made active again.');
    }

    const patch: Record<string, unknown> = {};
    for (const key of ['name', 'age', 'gender', 'phone', 'email', 'address', 'guardianName', 'status'] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (body.date !== undefined) patch.date = toISODate(body.date) || existing.date;
    const patient = await Patient.findOneAndUpdate({ id }, patch, { returnDocument: 'after' }).lean();
    return jsonOk(patient);
  });
}

// DELETE /api/patients/:id
export async function DELETE(_request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const id = normaliseId((await params).id);
    const result = await Patient.deleteOne({ id });
    if (result.deletedCount === 0) return jsonError('Patient not found.', 404);
    return jsonOk({ deleted: true });
  });
}
