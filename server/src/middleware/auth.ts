import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { HttpError } from './errors.js';

export interface AdminTokenPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminTokenPayload;
  }
}

/**
 * Require a valid admin JWT (from Authorization: Bearer <token>).
 * Issued by POST /api/admin/login (see routes/admin.ts).
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const auth = req.header('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token'));
  }
  const token = auth.slice('Bearer '.length).trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new HttpError(500, 'INTERNAL', 'JWT_SECRET not configured'));
  }
  try {
    const payload = jwt.verify(token, secret) as AdminTokenPayload;
    if (payload.role !== 'admin') {
      return next(new HttpError(403, 'FORBIDDEN', 'Not an admin token'));
    }
    req.admin = payload;
    return next();
  } catch {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
};
