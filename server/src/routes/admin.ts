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
//
// Does TWO things (best-effort):
//   1. upsert admin_users whitelist row (authoritative — if this fails, we 500)
//   2. fire Supabase inviteUserByEmail → magic-link email to the invitee
//      (opportunistic — logged on failure, does not fail the request)
//
// The whitelist + signup trigger is enough to let the invitee log in via
// Google OAuth. The magic-link email is a convenience so the super_admin
// doesn't have to notify out-of-band.
//
// Gated on APP_URL env var: if unset, skip step 2 entirely (tests + local
// dev don't send real emails). Response carries `inviteEmailSent` so the
// UI can tell super_admin whether they still need to ping the invitee
// manually.
// ───────────────────────────────
adminRouter.post('/users', ...superAdminChain, async (req, res, next) => {
  try {
    const parsed = InviteUserRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid invite', parsed.error.issues);
    }
    const { email, role } = parsed.data;
    const invitedBy = req.user!.id;

    const sb = getSupabase();
    const { data, error } = await sb
      .from('admin_users')
      .upsert(
        { email, role, invited_by: invitedBy },
        { onConflict: 'email', ignoreDuplicates: false },
      )
      .select()
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);

    // Best-effort magic-link email. Any failure is logged but not thrown —
    // the whitelist row is the source of truth for access; email is UX sugar.
    let inviteEmailSent = false;
    let authUserId: string | null = null;
    const appUrl = process.env.APP_URL?.replace(/\/$/, '');
    if (appUrl) {
      const { data: inviteData, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/admin`,
      });
      if (!inviteErr) {
        inviteEmailSent = true;
        authUserId = inviteData?.user?.id ?? null;
      } else if (/already.*(registered|exists)/i.test(inviteErr.message)) {
        // Invitee already has an auth.users row — look it up so we can still
        // self-heal admin_users.user_id (the DB trigger only fires on NEW
        // signups, so re-invites of existing users never get linked otherwise).
        const { data: list, error: listErr } = await sb.auth.admin.listUsers({ perPage: 200 });
        if (listErr) {
          // eslint-disable-next-line no-console
          console.warn(`[invite] listUsers failed during relink of ${email}: ${listErr.message}`);
        } else {
          authUserId = list?.users?.find((u) => u.email === email)?.id ?? null;
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[invite] inviteUserByEmail(${email}) failed: ${inviteErr.message}`);
      }
    }

    // Self-heal admin_users.user_id — belt-and-suspenders to the DB trigger
    // `activate_admin_on_signup` (migration 0002). Even if that trigger never
    // runs (not installed / accidentally dropped / invitee signs in via a
    // magic link whose token got pre-fetched by their mail client), the
    // whitelist row ends up linked to the auth.users row here, which is what
    // requireAdminUser joins on. Without this, the invitee hits
    // "Account not authorized" even after a successful auth.
    let healedRow: AdminUserRow = data as AdminUserRow;
    if (authUserId && healedRow.user_id !== authUserId) {
      const nowIso = new Date().toISOString();
      const { data: updated, error: linkErr } = await sb
        .from('admin_users')
        .update({ user_id: authUserId, activated_at: nowIso })
        .eq('email', email)
        .select()
        .single();
      if (linkErr) {
        // eslint-disable-next-line no-console
        console.warn(`[invite] self-heal admin_users.user_id for ${email} failed: ${linkErr.message}`);
      } else if (updated) {
        healedRow = updated as AdminUserRow;
      }
    }

    res.status(201).json({ ...rowToAdminUser(healedRow), inviteEmailSent });
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
