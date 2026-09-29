import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { normalizePhone, isValidPhone } from '@/lib/otp';
import { hashPassword } from '@/lib/password';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register — create a staff account with a phone number.
// Body: { name, phone, email?, password }
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const phone = normalizePhone(String(body.phone ?? ''));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!name) return jsonError('Name is required.');
    if (!isValidPhone(phone)) return jsonError('Enter a valid 10-digit phone number.');
    if (email && !EMAIL_RE.test(email)) return jsonError('Enter a valid email address.');
    if (password.length < 6) return jsonError('Password must be at least 6 characters.');

    const existingByPhone = await User.findOne({ phone }).lean();
    if (existingByPhone) return jsonError('An account with this phone number already exists.', 409);

    if (email) {
      const existingByEmail = await User.findOne({ email }).lean();
      if (existingByEmail) return jsonError('An account with this email already exists.', 409);
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, phone, email: email || '', passwordHash, role: 'user', createdAt: new Date().toISOString() });

    return jsonOk({ name: user.name, email: user.email || '', phone: user.phone, role: user.role });
  });
}
