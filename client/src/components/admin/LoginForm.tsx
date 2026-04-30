import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { Lang } from '@asb/shared';

import { getSupabase } from '../../lib/supabase';
import { t } from '../../lib/translations';

/**
 * /admin unauthenticated state — dual-auth entry:
 *
 *   1. Magic link (primary, via signInWithOtp)
 *      - For invitees coming in via the Supabase invite email whose one-time
 *        token got consumed by their mail client's link scanner (QQ/163/126
 *        "anti-phishing" pre-fetch is notorious for this). Let them self-serve
 *        a fresh link.
 *      - shouldCreateUser: false — only auth.users rows that already exist
 *        (via invite) can receive a magic link. This prevents random spam.
 *
 *   2. Google OAuth (secondary, legacy one-click path)
 *      - Keeps working for users with Gmail / Workspace emails.
 *
 * On successful auth the browser is either redirected (Google) or the user
 * clicks their fresh magic link from email (OTP). AdminPage picks up the
 * session via onAuthStateChange and calls /api/admin/me for gating.
 */

// Email domains known to pre-fetch links in emails (corrupts single-use
// tokens). We warn the user before sending so they can switch to Gmail /
// Workspace / Outlook on-prem if available.
const PREFETCH_DOMAINS = ['qq.com', '163.com', '126.com', 'sina.com', 'sohu.com', 'yeah.net', 'aliyun.com'];

export default function LoginForm({ lang }: { lang: Lang }) {
  const [googleBusy, setGoogleBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ui = t(lang);

  const riskyDomain = useMemo(() => {
    const match = otpEmail.trim().toLowerCase().match(/@([^@\s]+)$/);
    const domain = match?.[1];
    if (!domain) return null;
    return PREFETCH_DOMAINS.includes(domain) ? domain : null;
  }, [otpEmail]);

  const signInGoogle = async () => {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setGoogleBusy(true);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin`,
        queryParams: { prompt: 'select_account' },
      },
    });
    // On success the browser is being redirected; we won't reach here in that path.
    if (oauthErr) {
      setGoogleBusy(false);
      setError(oauthErr.message);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = otpEmail.trim().toLowerCase();
    if (!email) return;
    setError(null);
    setOtpSentTo(null);
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setOtpBusy(true);
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
        // Don't allow signup via this form — only users the super_admin has
        // already invited (and thus exist in auth.users) can receive a link.
        shouldCreateUser: false,
      },
    });
    setOtpBusy(false);
    if (otpErr) {
      // Map Supabase's technical message to something actionable.
      if (/signups.*not.*allowed|user.*not.*found/i.test(otpErr.message)) {
        setError(ui.adminLoginOtpNotInvited);
      } else if (/rate.*limit|too.*many.*request/i.test(otpErr.message)) {
        setError(ui.adminLoginOtpRateLimit);
      } else {
        setError(otpErr.message);
      }
      return;
    }
    setOtpSentTo(email);
  };

  return (
    <div className="mx-auto mt-20 w-full max-w-sm rounded-2xl border border-slate-200 bg-[var(--bg-surface)] p-6">
      <h2 className="text-xl font-semibold">{ui.adminLoginTitle}</h2>
      <p className="mt-2 text-xs text-slate-500 leading-relaxed">{ui.adminLoginInviteHint}</p>

      <form onSubmit={sendMagicLink} className="mt-5">
        <label className="block text-xs text-slate-500">{ui.adminLoginOtpLabel}</label>
        <input
          type="email"
          value={otpEmail}
          onChange={(e) => {
            setOtpEmail(e.target.value);
            if (otpSentTo) setOtpSentTo(null);
          }}
          placeholder="name@company.com"
          disabled={otpBusy}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
        />

        {riskyDomain && (
          <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
            {ui.adminLoginDomainWarning.replace('{domain}', riskyDomain)}
          </p>
        )}

        <button
          type="submit"
          disabled={!otpEmail.trim() || otpBusy}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full accent-bg text-white py-2 text-sm font-medium disabled:opacity-40 hover:brightness-110 transition"
        >
          {otpBusy && <Loader2 size={16} className="animate-spin" />}
          {otpBusy ? ui.adminLoginOtpSending : ui.adminLoginOtpSend}
        </button>
      </form>

      {otpSentTo && (
        <p className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 leading-relaxed">
          {ui.adminLoginOtpSent.replace('{email}', otpSentTo)}
        </p>
      )}

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <div className="flex-1 h-px bg-slate-100" />
        <span>{ui.adminLoginOr}</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      <button
        type="button"
        onClick={signInGoogle}
        disabled={googleBusy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-800 disabled:opacity-40 hover:bg-slate-100 transition"
      >
        {googleBusy && <Loader2 size={16} className="animate-spin" />}
        {googleBusy ? ui.adminSigningIn : ui.adminSignInWithGoogle}
      </button>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
