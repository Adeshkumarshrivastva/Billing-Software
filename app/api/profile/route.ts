import { connectToDatabase } from '@/lib/mongodb';
import { Profile, PROFILE_KEY } from '@/lib/models/Profile';
import { seedProfile } from '@/lib/seed-data';
import { jsonOk, withErrorHandling } from '@/lib/api-utils';

// GET /api/profile — the clinic's single settings document (created on first read if missing).
export async function GET() {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const profile = await Profile.findOneAndUpdate({ key: PROFILE_KEY }, { $setOnInsert: { key: PROFILE_KEY, ...seedProfile } }, { returnDocument: 'after', upsert: true }).lean();
    return jsonOk(profile);
  });
}

// PUT /api/profile — update clinic name, contact info, currency, bill numbering, etc.
export async function PUT(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    for (const key of ['name', 'tagline', 'email', 'phone', 'registrationNo', 'address', 'currency', 'billPrefix', 'upiVpa', 'upiName'] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const profile = await Profile.findOneAndUpdate({ key: PROFILE_KEY }, patch, { returnDocument: 'after', upsert: true }).lean();
    return jsonOk(profile);
  });
}
