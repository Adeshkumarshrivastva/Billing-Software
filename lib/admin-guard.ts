import { cookies } from 'next/headers';
import { jsonError } from '@/lib/api-utils';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth';

// Same gate the payments route uses — only a signed-in admin can take money.
// Returns { error: Response } when the caller isn't allowed, { error: null } otherwise.
export async function requireAdmin(): Promise<{ error: Response | null }> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return { error: jsonError('Sign in required.', 401) };
  if (session.role !== 'admin') return { error: jsonError('Only an admin can take payments.', 403) };
  return { error: null };
}
