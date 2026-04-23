import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import {
  ALL_USER_ROLES,
  type AdminUser,
  type AuthedUser,
  type UserRole,
} from '@asb/shared';

import {
  useAdminUsersQuery,
  useInviteUserMutation,
  useRevokeUserMutation,
} from '../../lib/queries';
import { useAppStore } from '../../lib/store';
import { t } from '../../lib/translations';
import ErrorBanner from '../ErrorBanner';

/**
 * super_admin-only panel for managing the admin_users whitelist.
 * - invite by email + role (upsert; re-inviting an existing email is idempotent)
 * - revoke by email (can't revoke yourself; server also enforces)
 * Products owned by a revoked user stay in DB; they become "unowned" once
 * Supabase Auth deletes the auth.users row (which is out-of-band from this UI).
 */
export default function AdminUsersPanel({ me }: { me: AuthedUser }) {
  const lang = useAppStore((s) => s.lang);
  const ui = t(lang);

  const usersQuery = useAdminUsersQuery(true);
  const invite = useInviteUserMutation();
  const revoke = useRevokeUserMutation();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('editor');
  // Surfaces different copy depending on whether the server was able to
  // fire a magic-link email (APP_URL configured) vs. whitelist-only.
  const [inviteToast, setInviteToast] = useState<{ emailSent: boolean } | null>(null);

  const roleLabel = (r: UserRole) =>
    r === 'super_admin' ? ui.adminUsersRoleSuperAdmin : ui.adminUsersRoleEditor;

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const result = await invite.mutateAsync({ email: trimmed, role });
      setInviteToast({ emailSent: result.inviteEmailSent });
      setEmail('');
    } catch {
      // banner
    }
  };

  const onRevoke = async (u: AdminUser) => {
    if (u.email === me.email) return;
    if (!window.confirm(`${ui.adminUsersRevokeButton}: ${u.email}?`)) return;
    try {
      await revoke.mutateAsync(u.email);
    } catch {
      // banner
    }
  };

  const users = usersQuery.data ?? [];

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5">
      <h2 className="text-sm font-medium text-white/70">{ui.adminUsersTitle}</h2>

      <form onSubmit={submitInvite} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-white/60">{ui.adminUsersInviteEmail}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmail.com"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
          />
        </div>
        <div>
          <label className="block text-xs text-white/60">{ui.adminUsersInviteRole}</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
          >
            {ALL_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!email.trim() || invite.isPending}
          className="rounded-full accent-bg text-black px-4 py-2 text-sm font-medium disabled:opacity-40 hover:brightness-110"
        >
          {ui.adminUsersInviteButton}
        </button>
      </form>

      {inviteToast && (
        <div
          className={[
            'mt-3 rounded-lg px-3 py-2 text-xs flex items-start justify-between gap-3',
            inviteToast.emailSent
              ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-200 border border-amber-500/20',
          ].join(' ')}
          role="status"
        >
          <span>
            {inviteToast.emailSent
              ? ui.adminUsersInviteEmailSent
              : ui.adminUsersInviteEmailSkipped}
          </span>
          <button
            type="button"
            onClick={() => setInviteToast(null)}
            className="opacity-70 hover:opacity-100 text-xs"
            aria-label="dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <ErrorBanner
        error={usersQuery.error ?? invite.error ?? revoke.error}
        lang={lang}
        onDismiss={() => {
          invite.reset();
          revoke.reset();
        }}
      />

      <ul className="mt-5 divide-y divide-white/5">
        {users.map((u) => {
          const isSelf = u.email === me.email;
          return (
            <li key={u.email} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">{u.email}</span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px]',
                      u.role === 'super_admin'
                        ? 'bg-amber-500/10 text-amber-200'
                        : 'bg-white/5 text-white/60',
                    ].join(' ')}
                  >
                    {roleLabel(u.role)}
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                    {u.activatedAt ? ui.adminUsersStatusActivated : ui.adminUsersStatusPending}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRevoke(u)}
                disabled={isSelf || revoke.isPending}
                aria-label={ui.adminUsersRevokeButton}
                className="rounded-lg p-2 text-white/70 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
        {users.length === 0 && !usersQuery.isLoading && (
          <li className="py-6 text-center text-sm text-white/40">—</li>
        )}
      </ul>
    </section>
  );
}
