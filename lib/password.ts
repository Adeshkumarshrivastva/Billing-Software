import bcrypt from 'bcryptjs';

// Node-only (bcryptjs). Never import this from middleware.ts (Edge runtime) —
// use lib/auth.ts there instead.
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
