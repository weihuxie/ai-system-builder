import { Router } from 'express';

import {
  DEFAULT_QUICK_OPTIONS,
  QuickOptionsByLangSchema,
  type QuickOption,
  type Lang,
} from '@asb/shared';

import { getSupabase } from '../lib/supabase.js';
import { superAdminChain } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export const quickScenariosRouter = Router();

const GLOBAL_CONFIG_ID = 1;

// ───────────────────────────────────────────
// Public GET → current quick scenarios used by homepage QuickScenarios component.
// Falls back to bundled DEFAULT_QUICK_OPTIONS when:
//   - DB row's quick_scenarios is null (never customised)
//   - DB shape doesn't parse (corrupted)
//   - a particular lang's array is empty (partial customisation)
//
// Returning defaults rather than an error means a fresh project / a Shanghai
// venue with a flaky DB still shows scenarios — the homepage never goes blank.
// ───────────────────────────────────────────

quickScenariosRouter.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await getSupabase()
      .from('global_config')
      .select('quick_scenarios, updated_at')
      .eq('id', GLOBAL_CONFIG_ID)
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);

    const parsed = QuickOptionsByLangSchema.safeParse(data?.quick_scenarios);
    const stored = parsed.success ? parsed.data : null;

    // Per-lang fallback: a lang stays on defaults if its array is empty in DB.
    // This means partial customisation (e.g. only zh-CN edited) is allowed.
    const merged: Record<Lang, QuickOption[]> = {
      'zh-CN':
        stored && stored['zh-CN'].length > 0 ? stored['zh-CN'] : DEFAULT_QUICK_OPTIONS['zh-CN'],
      'zh-HK':
        stored && stored['zh-HK'].length > 0 ? stored['zh-HK'] : DEFAULT_QUICK_OPTIONS['zh-HK'],
      en: stored && stored.en.length > 0 ? stored.en : DEFAULT_QUICK_OPTIONS.en,
      ja: stored && stored.ja.length > 0 ? stored.ja : DEFAULT_QUICK_OPTIONS.ja,
    };

    res.json({
      scenarios: merged,
      // Boolean tells admin UI whether to show "currently using defaults" vs
      // "you have customisations on file". UI uses this to render a reset button.
      isCustomised: parsed.success && stored !== null,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────
// PUT (super_admin) — replace the whole quick_scenarios jsonb.
// Body: { scenarios: { 'zh-CN': QuickOption[], ... } }
// Or:   { reset: true } to clear customisations and fall back to bundled defaults.
// ───────────────────────────────────────────

quickScenariosRouter.put('/', ...superAdminChain, async (req, res, next) => {
  try {
    const reset = req.body?.reset === true;
    let nextValue: Record<Lang, QuickOption[]> | null = null;
    if (!reset) {
      const parsed = QuickOptionsByLangSchema.safeParse(req.body?.scenarios);
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION', 'Invalid quick scenarios payload', parsed.error.issues);
      }
      nextValue = parsed.data;
    }

    const now = new Date().toISOString();
    const { data, error } = await getSupabase()
      .from('global_config')
      .update({
        quick_scenarios: nextValue,
        updated_at: now,
        updated_by: req.user!.id,
      })
      .eq('id', GLOBAL_CONFIG_ID)
      .select('quick_scenarios, updated_at')
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);

    // Mirror GET response shape so the admin UI can immediately re-render
    // without an extra refetch.
    const stored = (data?.quick_scenarios as Record<Lang, QuickOption[]> | null) ?? null;
    const merged: Record<Lang, QuickOption[]> = {
      'zh-CN':
        stored && stored['zh-CN'] && stored['zh-CN'].length > 0
          ? stored['zh-CN']
          : DEFAULT_QUICK_OPTIONS['zh-CN'],
      'zh-HK':
        stored && stored['zh-HK'] && stored['zh-HK'].length > 0
          ? stored['zh-HK']
          : DEFAULT_QUICK_OPTIONS['zh-HK'],
      en: stored && stored.en && stored.en.length > 0 ? stored.en : DEFAULT_QUICK_OPTIONS.en,
      ja: stored && stored.ja && stored.ja.length > 0 ? stored.ja : DEFAULT_QUICK_OPTIONS.ja,
    };

    res.json({
      scenarios: merged,
      isCustomised: stored !== null,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});
