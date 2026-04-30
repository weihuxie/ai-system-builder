import { useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';

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
  // After a successful invite the server returns a one-time URL the super_admin
  // hands to the invitee out-of-band (Lark/WeChat/SMS). `inviteResult` holds
  // the email + URL so the UI can render a copy-affordance until dismissed.
  const [inviteResult, setInviteResult] = useState<
    { email: string; link: string | null } | null
  >(null);
  const [copied, setCopied] = useState(false);

  const roleLabel = (r: UserRole) =>
    r === 'super_admin' ? ui.adminUsersRoleSuperAdmin : ui.adminUsersRoleEditor;

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const result = await invite.mutateAsync({ email: trimmed, role });
      setInviteResult({ email: trimmed, link: result.inviteLink });
      setCopied(false);
      setEmail('');
    } catch {
      // banner
    }
  };

  const copyLink = async () => {
    if (!inviteResult?.link) return;
    try {
      await navigator.clipboard.writeText(inviteResult.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (insecure context, permissions). User can still
      // select & copy manually from the textarea.
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
    <section className="rounded-2xl border border-slate-200 bg-[var(--bg-surface)] p-5">
      <h2 className="text-sm font-medium text-slate-600">{ui.adminUsersTitle}</h2>

      <form onSubmit={submitInvite} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-slate-500">{ui.adminUsersInviteEmail}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmail.com"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">{ui.adminUsersInviteRole}</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
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
          className="rounded-full accent-bg text-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:brightness-110"
        >
          {ui.adminUsersInviteButton}
        </button>
      </form>

      {inviteResult && (
        <div
          className={[
            'mt-3 rounded-lg border p-3',
            inviteResult.link
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-amber-500/20 bg-amber-500/5',
          ].join(' ')}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-xs leading-relaxed">
              <p className={inviteResult.link ? 'text-emerald-200' : 'text-amber-200'}>
                {inviteResult.link
                  ? ui.adminUsersInviteLinkReady.replace('{email}', inviteResult.email)
                  : ui.adminUsersInviteLinkSkipped.replace('{email}', inviteResult.email)}
              </p>
              {inviteResult.link && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {ui.adminUsersInviteLinkHint}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInviteResult(null)}
              className="text-xs opacity-70 hover:opacity-100 shrink-0"
              aria-label="dismiss"
            >
              ✕
            </button>
          </div>

          {inviteResult.link && (
            <div className="mt-3 flex items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={inviteResult.link}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-black/30 px-3 py-2 text-[11px] font-mono text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition shrink-0',
                  copied
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'accent-bg text-white hover:brightness-110',
                ].join(' ')}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? ui.adminUsersInviteLinkCopied : ui.adminUsersInviteLinkCopy}
              </button>
            </div>
          )}
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

      <ul className="mt-5 divide-y divide-slate-200">
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
                        : 'bg-slate-50 text-slate-500',
                    ].join(' ')}
                  >
                    {roleLabel(u.role)}
                  </span>
                  <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                    {u.activatedAt ? ui.adminUsersStatusActivated : ui.adminUsersStatusPending}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRevoke(u)}
                disabled={isSelf || revoke.isPending}
                aria-label={ui.adminUsersRevokeButton}
                className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
        {users.length === 0 && !usersQuery.isLoading && (
          <li className="py-6 text-center text-sm text-slate-400">—</li>
        )}
      </ul>
    </section>
  );
}
