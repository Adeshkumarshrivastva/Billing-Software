import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { jsonError, jsonOk, withErrorHandling } from '@/lib/api-utils';

// GET /api/auth/me — who's signed in, from the session cookie.
export async function GET() {
  return withErrorHandling(async () => {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return jsonError('Not signed in.', 401);
    const session = await verifySession(token);
    if (!session) return jsonError('Session expired, please sign in again.', 401);
    return jsonOk({ name: session.name, email: session.email, phone: session.phone, role: session.role });
  });
}
