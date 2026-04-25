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
// Does THREE things:
//   1. upsert admin_users whitelist row (authoritative — if this fails, we 500)
//   2. generate a one-time invite/login URL via Supabase admin generateLink
//      (NO email sent — we hand the URL back to the super_admin to share via
//      Lark / WeChat / SMS / whatever private channel they trust)
//   3. self-heal admin_users.user_id ↔ auth.users.id link
//
// Why generateLink instead of inviteUserByEmail?
//   - Email channels are unreliable: QQ/163 mail clients pre-fetch links and
//     burn the one-time token before the user sees it (see §2.3.2). Even with
//     custom Resend SMTP, deliverability / spam filters / SMTP quotas are
//     ongoing pain. Sharing the URL out-of-band sidesteps all of this.
//   - The URL is the same one Supabase would have emailed; identical security
//     model (one-time token, expires, invalidates on first click).
//
// Flow for new invitees: generateLink({type:'invite'}) creates the auth.users
// row and returns the action_link. For re-invites of users that already exist
// in auth.users (e.g. previously invited via the old email flow, or another
// Supabase project they already had access to), invite type fails with
// "already registered" — we fall back to type='magiclink' which produces a
// fresh one-time login URL without trying to recreate the user.
//
// Gated on APP_URL env var: if unset (local dev / unit tests), skip link
// generation entirely. Response carries `inviteLink: string | null` so the
// UI can render a "copy & send" affordance.
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

    // Best-effort link generation. Any failure is logged but not thrown —
    // the whitelist row is the source of truth for access; the link is UX sugar.
    let inviteLink: string | null = null;
    let authUserId: string | null = null;
    const appUrl = process.env.APP_URL?.replace(/\/$/, '');
    if (appUrl) {
      // Try invite first (creates auth.users row if absent).
      const { data: inviteData, error: inviteErr } = await sb.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo: `${appUrl}/admin` },
      });
      if (!inviteErr) {
        inviteLink = inviteData?.properties?.action_link ?? null;
        authUserId = inviteData?.user?.id ?? null;
      } else if (/already.*(registered|exists)/i.test(inviteErr.message)) {
        // User already has an auth.users row — fall back to magiclink (no
        // user creation, just a fresh one-time login URL).
        const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: `${appUrl}/admin` },
        });
        if (linkErr) {
          // eslint-disable-next-line no-console
          console.warn(`[invite] magiclink fallback for existing ${email} failed: ${linkErr.message}`);
        } else {
          inviteLink = linkData?.properties?.action_link ?? null;
          authUserId = linkData?.user?.id ?? null;
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[invite] generateLink(invite) for ${email} failed: ${inviteErr.message}`);
      }
    }

    // Self-heal admin_users.user_id — belt-and-suspenders to the DB trigger
    // `activate_admin_on_signup` (migration 0002). Even if that trigger never
    // runs, the whitelist row ends up linked to the auth.users row here,
    // which is what requireAdminUser joins on. Without this, the invitee hits
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

    res.status(201).json({
      ...rowToAdminUser(healedRow),
      inviteLink,
      // Kept for one release as a deprecated alias so any older client cached
      // by the browser doesn't crash on a missing field. Always false now.
      inviteEmailSent: false,
    });
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
