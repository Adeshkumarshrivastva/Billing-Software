import { SignJWT, jwtVerify } from 'jose';

// Session tokens are signed JWTs in an httpOnly cookie. This file only touches
// `jose` (Edge-runtime safe) so it can be imported from middleware.ts as well
// as from API routes — password hashing (Node-only) lives in lib/password.ts.

export const SESSION_COOKIE_NAME = 'pmc_session';
const SESSION_TTL = '30d';

function secretKey() {
  const secret = process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me';
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { sub: string; email: string; name: string; phone: string; role: 'admin' | 'user' };

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.name !== 'string' || typeof payload.phone !== 'string') return null;
    const role = payload.role === 'admin' ? 'admin' : 'user';
    return { sub: payload.sub, email: payload.email, name: payload.name, phone: payload.phone, role };
  } catch {
    return null;
  }
}
