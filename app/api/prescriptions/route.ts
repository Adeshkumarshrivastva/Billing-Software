import { connectToDatabase } from '@/lib/mongodb';
import { Prescription } from '@/lib/models/Prescription';
import { Patient } from '@/lib/models/Patient';
import { jsonError, jsonOk, nextSequentialId, withErrorHandling } from '@/lib/api-utils';
import { toISODate, todayISO } from '@/lib/format';

// GET /api/prescriptions — list all prescriptions, newest first.
export async function GET() {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const list = await Prescription.find({}).sort({ createdAt: -1 }).lean();
    return jsonOk(list);
  });
}

type ItemInput = { name?: unknown; dose?: unknown; frequency?: unknown; timing?: unknown; duration?: unknown; notes?: unknown };

// POST /api/prescriptions — issue a prescription for a patient.
// Body: { patientId?, patientName?, patientAge?, patientGender?, patientPhone?, patientAddress?,
//         doctor?, date, complaint?, investigation?, diagnosis?,
//         items?: [{ name, frequency?, timing?, duration?, notes? }],
//         note?, photos?: string[] (data: URLs), advice?, followUpDate?, id? }
// The patient must already be registered — pass an existing patientId, or a
// patientName that exactly matches one. The client store registers a walk-in on
// the spot before calling here, exactly like the billing flow does.
// Rx number: pass `id` to choose it, or omit it to auto-number sequentially.
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const body = await request.json();

    let patient = null;
    if (body?.patientId) {
      patient = await Patient.findOne({ id: body.patientId }).lean();
    }
    if (!patient && body?.patientName?.trim()) {
      const name = String(body.patientName).trim();
      patient = await Patient.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
    }
    if (!patient) return jsonError('No registered patient matches — register them from the Patients page first.');

    const rawItems: ItemInput[] = Array.isArray(body?.items) ? body.items : [];
    const items = rawItems
      .map((it) => ({
        name: String(it?.name ?? '').trim(),
        dose: String(it?.dose ?? '').trim(),
        frequency: String(it?.frequency ?? '').trim(),
        timing: String(it?.timing ?? '').trim(),
        duration: String(it?.duration ?? '').trim(),
        notes: String(it?.notes ?? '').trim(),
      }))
      .filter((it) => it.name);

    // Attached photos: keep only inline image data URLs, cap the count so a
    // single prescription document stays well under MongoDB's 16 MB limit
    // (the client already downscales each image before upload).
    const photos: string[] = (Array.isArray(body?.photos) ? body.photos : [])
      .filter((p: unknown): p is string => typeof p === 'string' && p.startsWith('data:image/'))
      .slice(0, 6);

    let id: string;
    if (body.id?.trim()) {
      id = String(body.id).trim();
      if (await Prescription.findOne({ id })) return jsonError(`Prescription number ${id} is already in use — pick another.`);
    } else {
      id = await nextSequentialId('RX', Prescription);
    }

    // The Rx snapshots the patient's details. A value the doctor typed on the
    // form for this visit wins; otherwise fall back to the registered record.
    const ageInput = body.patientAge !== undefined && body.patientAge !== '' ? Number(body.patientAge) : undefined;

    const prescription = await Prescription.create({
      id,
      patientId: patient.id,
      patientName: patient.name,
      patientAge: Number.isFinite(ageInput) ? ageInput : patient.age ?? undefined,
      patientGender: body.patientGender || patient.gender || undefined,
      patientPhone: (body.patientPhone ? String(body.patientPhone).trim() : '') || patient.phone || '',
      patientAddress: (body.patientAddress ? String(body.patientAddress).trim() : '') || patient.address || '',
      doctor: body.doctor ? String(body.doctor).trim() : undefined,
      date: toISODate(body.date) || todayISO(),
      complaint: body.complaint ? String(body.complaint).trim() : undefined,
      investigation: body.investigation ? String(body.investigation).trim() : undefined,
      diagnosis: body.diagnosis ? String(body.diagnosis).trim() : undefined,
      items,
      note: body.note ? String(body.note).trim() : undefined,
      photos,
      advice: body.advice ? String(body.advice).trim() : undefined,
      followUpDate: toISODate(body.followUpDate) || '',
      createdAt: new Date().toISOString(),
    });

    return jsonOk(prescription, 201);
  });
}
