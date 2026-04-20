import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { Lang } from '@asb/shared';

import { useAdminLoginMutation } from '../../lib/queries';
import { t } from '../../lib/translations';
import ErrorBanner from '../ErrorBanner';

export default function LoginForm({ lang, onSuccess }: { lang: Lang; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const login = useAdminLoginMutation();
  const ui = t(lang);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || login.isPending) return;
    try {
      await login.mutateAsync(password);
      onSuccess();
    } catch {
      // banner handles it
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-20 w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-6"
    >
      <h2 className="text-xl font-semibold">{ui.adminLoginTitle}</h2>
      <label className="mt-6 block text-xs text-white/60">{ui.adminPasswordLabel}</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
      />
      <button
        type="submit"
        disabled={!password || login.isPending}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full accent-bg text-black py-2 text-sm font-medium disabled:opacity-40 hover:brightness-110 transition"
      >
        {login.isPending && <Loader2 size={16} className="animate-spin" />}
        {login.isPending ? ui.adminLoggingIn : ui.adminLoginButton}
      </button>
      <ErrorBanner error={login.error} lang={lang} onDismiss={() => login.reset()} />
    </form>
  );
}
