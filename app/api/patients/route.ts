import { connectToDatabase } from '@/lib/mongodb';
import { Patient } from '@/lib/models/Patient';
import { jsonError, jsonOk, nextSequentialId, withErrorHandling } from '@/lib/api-utils';
import { toISODate, todayISO } from '@/lib/format';

// GET /api/patients?q=search — list all patients, newest first, optionally filtered by name/phone/email.
export async function GET(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const q = new URL(request.url).searchParams.get('q')?.trim();
    const filter = q ? { $or: [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] } : {};
    const patients = await Patient.find(filter).sort({ createdAt: -1 }).lean();
    return jsonOk(patients);
  });
}

// POST /api/patients — register a new patient. Only `name` is required — the rest
// (age, gender, phone, ...) can be filled in later, so a patient can also be
// created inline from the billing screen by just typing their name.
// Body: { name, age?, gender?, phone?, email?, address?, guardianName?, date? }
// `date` is the registration date (yyyy-mm-dd); defaults to today when omitted.
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const body = await request.json();
    if (!body?.name?.trim()) return jsonError('A patient name is required.');
    const id = await nextSequentialId('PAT', Patient);
    const patient = await Patient.create({
      id,
      name: String(body.name).trim(),
      age: body.age !== undefined && body.age !== '' ? Number(body.age) : undefined,
      gender: body.gender || undefined,
      phone: body.phone ? String(body.phone).trim() : '',
      email: body.email ? String(body.email).trim() : undefined,
      address: body.address ? String(body.address).trim() : undefined,
      guardianName: body.guardianName ? String(body.guardianName).trim() : undefined,
      date: toISODate(body.date) || todayISO(),
      status: 'Active',
      createdAt: new Date().toISOString(),
    });
    return jsonOk(patient, 201);
  });
}
