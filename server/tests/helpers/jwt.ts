import jwt from 'jsonwebtoken';

// Mints a Supabase-shaped JWT so the server's requireUser middleware accepts
// it without a real sign-in round-trip. The payload matches what Supabase
// issues (sub, email, aud=authenticated, role=authenticated, exp).
export function mintJwt(opts: {
  sub: string;
  email: string;
  expiresInSec?: number;
  secretOverride?: string;
}): string {
  const secret = opts.secretOverride ?? process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('SUPABASE_JWT_SECRET missing — cannot mint test token');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.expiresInSec ?? 3600);
  const payload = {
    sub: opts.sub,
    email: opts.email,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp,
  };
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
