import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

import { AdminLoginRequestSchema, type AdminLoginResponse } from '@asb/shared';
import { HttpError } from '../middleware/errors.js';

export const adminRouter = Router();

const TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours (design §8.2)

adminRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = AdminLoginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid request', parsed.error.issues);
    }

    const hash = process.env.ADMIN_PASSWORD_HASH;
    const secret = process.env.JWT_SECRET;
    if (!hash || !secret) {
      throw new HttpError(500, 'INTERNAL', 'Admin auth not configured');
    }

    const ok = await bcrypt.compare(parsed.data.password, hash);
    if (!ok) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Incorrect password');
    }

    const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: TOKEN_TTL_SECONDS });
    const response: AdminLoginResponse = {
      token,
      expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});
