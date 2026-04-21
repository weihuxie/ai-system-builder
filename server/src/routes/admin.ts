import { Router } from 'express';
import { z } from 'zod';

import { InviteUserRequestSchema, type AdminUser, type AuthedUser } from '@asb/shared';
import { getSupabase } from '../lib/supabase.js';
import { adminChain, superAdminChain } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export const adminRouter = Router();

// ───────────────────────────────
// Row shape from admin_users (snake_case → camelCase mapper).
// ───────────────────────────────
interface AdminUserRow {
  email: string;
  user_id: string | null;
  role: 'editor' | 'super_admin';
  invited_at: string;
  activated_at: string | null;
  invited_by: string | null;
}

function rowToAdminUser(r: AdminUserRow): AdminUser {
  return {
    email: r.email,
    userId: r.user_id,
    role: r.role,
    invitedAt: r.invited_at,
    activatedAt: r.activated_at,
    invitedBy: r.invited_by,
  };
}

// ───────────────────────────────
// GET /api/admin/me
// Returns the current logged-in admin identity. Any whitelisted user may call.
// Client uses this to decide which panels to render (super_admin vs editor).
// ───────────────────────────────
adminRouter.get('/me', ...adminChain, (req, res) => {
  // adminChain guarantees req.user is populated — assert to narrow.
  const user: AuthedUser = req.user!;
  res.json(user);
});

// ───────────────────────────────
// GET /api/admin/users (super_admin only)
// List the whitelist so super_admin can manage invites.
// ───────────────────────────────
adminRouter.get('/users', ...superAdminChain, async (_req, res, next) => {
  try {
    const { data, error } = await getSupabase()
      .from('admin_users')
      .select('*')
      .order('invited_at', { ascending: false });
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    const rows = (data ?? []) as AdminUserRow[];
    res.json(rows.map(rowToAdminUser));
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────
// POST /api/admin/users (super_admin only) — invite
// Creates an admin_users row; user_id is filled by the trigger on first login.
// Re-inviting an email that already exists is idempotent (updates role).
// ───────────────────────────────
adminRouter.post('/users', ...superAdminChain, async (req, res, next) => {
  try {
    const parsed = InviteUserRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid invite', parsed.error.issues);
    }
    const { email, role } = parsed.data;
    const invitedBy = req.user!.id;

    const { data, error } = await getSupabase()
      .from('admin_users')
      .upsert(
        { email, role, invited_by: invitedBy },
        { onConflict: 'email', ignoreDuplicates: false },
      )
      .select()
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    res.status(201).json(rowToAdminUser(data as AdminUserRow));
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────
// DELETE /api/admin/users/:email (super_admin only) — revoke
// Products owned by the revoked user stay (owner_id will be nulled when the
// auth.users row is deleted — we don't cascade-delete the auth user here).
// ───────────────────────────────
adminRouter.delete('/users/:email', ...superAdminChain, async (req, res, next) => {
  try {
    const emailParsed = z.string().email().max(254).safeParse(req.params.email);
    if (!emailParsed.success) throw new HttpError(400, 'VALIDATION', 'Invalid email');

    if (emailParsed.data === req.user!.email) {
      throw new HttpError(400, 'VALIDATION', 'Cannot revoke yourself');
    }

    const { error } = await getSupabase()
      .from('admin_users')
      .delete()
      .eq('email', emailParsed.data);
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
