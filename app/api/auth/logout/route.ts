import { SESSION_COOKIE_NAME } from '@/lib/auth';
import { jsonOk } from '@/lib/api-utils';

// POST /api/auth/logout
export async function POST() {
  const res = jsonOk({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
