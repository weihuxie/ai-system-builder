import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { Lang } from '@asb/shared';

import { getSupabase } from '../../lib/supabase';
import { t } from '../../lib/translations';

/**
 * /admin unauthenticated state — single "Sign in with Google" button.
 * Supabase redirects back to /admin; on return, AdminPage picks up the
 * session via onAuthStateChange and calls /api/admin/me.
 */
export default function LoginForm({ lang }: { lang: Lang }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ui = t(lang);

  const signIn = async () => {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setBusy(true);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin`,
        queryParams: { prompt: 'select_account' },
      },
    });
    // On success the browser is being redirected; we won't reach here in that path.
    if (oauthErr) {
      setBusy(false);
      setError(oauthErr.message);
    }
  };

  return (
    <div className="mx-auto mt-20 w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-6">
      <h2 className="text-xl font-semibold">{ui.adminLoginTitle}</h2>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full accent-bg text-black py-2 text-sm font-medium disabled:opacity-40 hover:brightness-110 transition"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        {busy ? ui.adminSigningIn : ui.adminSignInWithGoogle}
      </button>
      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
