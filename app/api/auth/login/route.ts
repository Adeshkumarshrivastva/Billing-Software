import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { verifyPassword } from '@/lib/password';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';

// POST /api/auth/login — Body: { email, password }
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await connectToDatabase();
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    const user = await User.findOne({ email });
    // Same message either way — don't reveal whether the email exists.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return jsonError('Incorrect email or password.', 401);
    }

    const token = await signSession({
      sub: String(user._id),
      email: user.email || '',
      name: user.name,
      phone: user.phone,
      role: user.role || 'user',
    });
    const res = jsonOk({ name: user.name, email: user.email || '', phone: user.phone, role: user.role || 'user' });
    // No maxAge — a browser-session cookie. It's gone once the browser is
    // actually closed, so reopening the app always asks for sign-in again.
    res.cookies.set(SESSION_COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return res;
  });
}
