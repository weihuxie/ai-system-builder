// Flat config (ESLint 9+). Single config covers shared / client / server.
// Conservative ruleset — focus is catching real bugs, not enforcing style.
// (Style is left to the existing implicit conventions; we only step in for
// safety / correctness issues that tsc misses.)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vercel/**',
      'client/playwright.config.ts',
      'client/test-results/**',
      'server/evals/**',
      'scripts/**',
      'supabase/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // set-state-in-effect is a React 19 perf-style rule that flags many
      // legitimate patterns (auth state subscription, derived state syncing).
      // Downgrade from error → warning so it surfaces but doesn't block CI.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    rules: {
      // Prefer `unknown` to `any`; require an explicit cast / parse step for
      // anything truly dynamic. Catches the lazy-typing failure mode tsc allows.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused locals = dead code OR forgotten cleanup. Allow underscore prefix
      // for "intentional ignore" (matches the existing _c / _u / _oe pattern).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Empty catch swallows errors silently — common bug source.
      'no-empty': ['error', { allowEmptyCatch: false }],
      // Prevent the "ts-ignore creep" we caught zero of in audit; keep it that way.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
          'ts-nocheck': true,
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
);
