import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';
import { isAdminPhone, isValidPhone, normalizePhone, verifyOtpForPhone } from '@/lib/otp';

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const body = await request.json();
    const phone = normalizePhone(String(body.phone ?? ''));
    const otp = String(body.otp ?? '').trim();

    if (!isValidPhone(phone)) return jsonError('Enter a valid 10-digit phone number.', 400);
    if (!/^\d{6}$/.test(otp)) return jsonError('Enter a valid 6-digit OTP.', 400);

    const isAdmin = isAdminPhone(phone);
    if (!isAdmin) {
      const user = await User.findOne({ phone }).lean();
      if (!user) return jsonError('No account found for this phone number. Please register first.', 404);
    }

    if (!verifyOtpForPhone(phone, otp)) {
      return jsonError('Invalid or expired OTP.', 401);
    }

    const account = isAdmin
      ? { _id: 'admin', name: 'PMC Admin', email: 'admin@pmc.local', phone, role: 'admin' as const }
      : await User.findOne({ phone }).lean();

    if (!account) return jsonError('No account found for this phone number. Please register first.', 404);

    const token = await signSession({
      sub: String(account._id),
      email: account.email || 'admin@pmc.local',
      name: account.name,
      phone: account.phone,
      role: account.role || 'admin',
    });

    const res = jsonOk({ ok: true, name: account.name, email: account.email || 'admin@pmc.local', phone: account.phone, role: account.role || 'admin' });
    res.cookies.set(SESSION_COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return res;
  });
}
