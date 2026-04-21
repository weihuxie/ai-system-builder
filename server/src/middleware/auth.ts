import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import type { AuthedUser, UserRole } from '@asb/shared';

import { HttpError } from './errors.js';
import { getSupabase } from '../lib/supabase.js';

// ───────────────────────────────
// Three-layer auth chain
//   requireUser        → verify Supabase JWT, attach req.session { id, email }
//   requireAdminUser   → look up admin_users, attach req.user = { id, email, role }
//   requireSuperAdmin  → ensure req.user.role === 'super_admin'
//
// JWT verification is local (jwt.verify with SUPABASE_JWT_SECRET) — no network hop.
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
  aud: string;
  exp: number;
}

export const requireUser: RequestHandler = (req, _res, next) => {
  const auth = req.header('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token'));
  }
  const token = auth.slice('Bearer '.length).trim();
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    return next(new HttpError(500, 'INTERNAL', 'SUPABASE_JWT_SECRET not configured'));
  }
  try {
    const payload = jwt.verify(token, secret) as SupabaseJwtPayload;
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
