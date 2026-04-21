import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { AuthedUser, UserRole } from '@asb/shared';

import { HttpError } from './errors.js';
import { getSupabase } from '../lib/supabase.js';

// ───────────────────────────────
// Three-layer auth chain
//   requireUser        → verify Supabase JWT, attach req.session { id, email }
//   requireAdminUser   → look up admin_users, attach req.user = { id, email, role }
//   requireSuperAdmin  → ensure req.user.role === 'super_admin'
//
// JWT verification: Supabase migrated to asymmetric ES256 signing keys in 2025.
// We first try remote JWKS (ES256/RS256), then fall back to legacy HS256 with
// SUPABASE_JWT_SECRET (used by tests' self-signed tokens and pre-migration projects).
// Role lookup is a fresh DB query every request, so invitations / revocations
// take effect on the next API call without waiting for JWT expiry.
// ───────────────────────────────

declare module 'express-serve-static-core' {
  interface Request {
    session?: { id: string; email: string };
    user?: AuthedUser;
  }
}

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud?: string;
  exp?: number;
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (jwksCache) return jwksCache;
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  jwksCache = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  return jwksCache;
}

async function verifyToken(token: string): Promise<SupabaseJwtPayload> {
  // Try remote JWKS (asymmetric — current Supabase signing)
  const jwks = getJwks();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks);
      return payload as SupabaseJwtPayload;
    } catch {
      // Fall through to HS256
    }
  }
  // Fallback: legacy HS256 symmetric secret (tests, pre-migration projects)
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('No JWT verification key available');
  return jwt.verify(token, secret) as SupabaseJwtPayload;
}

export const requireUser: RequestHandler = async (req, _res, next) => {
  const auth = req.header('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token'));
  }
  const token = auth.slice('Bearer '.length).trim();
  try {
    const payload = await verifyToken(token);
    if (!payload.sub || !payload.email) {
      return next(new HttpError(401, 'UNAUTHORIZED', 'Token missing sub/email'));
    }
    req.session = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
};

export const requireAdminUser: RequestHandler = async (req, _res, next) => {
  if (!req.session) {
    return next(new HttpError(500, 'INTERNAL', 'requireUser must run before requireAdminUser'));
  }
  const { data, error } = await getSupabase()
    .from('admin_users')
    .select('role')
    .eq('user_id', req.session.id)
    .maybeSingle();
  if (error) return next(new HttpError(500, 'INTERNAL', error.message));
  if (!data) {
    return next(new HttpError(403, 'NOT_WHITELISTED', 'Email not in admin_users whitelist'));
  }
  req.user = {
    id: req.session.id,
    email: req.session.email,
    role: data.role as UserRole,
  };
  return next();
};

export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return next(new HttpError(403, 'FORBIDDEN', 'super_admin required'));
  }
  return next();
};

// Middleware tuples for router.use / route spreads.
export const adminChain: RequestHandler[] = [requireUser, requireAdminUser];
export const superAdminChain: RequestHandler[] = [requireUser, requireAdminUser, requireSuperAdmin];

/**
 * Ownership check for product writes.
 * super_admin: always yes. editor: only if products.owner_id matches user.id.
 */
export async function canEditProduct(user: AuthedUser, productId: string): Promise<boolean> {
  if (user.role === 'super_admin') return true;
  const { data, error } = await getSupabase()
    .from('products')
    .select('owner_id')
    .eq('id', productId)
    .maybeSingle();
  if (error || !data) return false;
  return data.owner_id === user.id;
}
