-- ─────────────────────────────────────────────────────────────
-- 0004_quick_scenarios.sql — admin-editable Quick Scenarios
--
-- Background: client uses DEFAULT_QUICK_OPTIONS hardcoded in
-- shared/src/defaults.ts as the fallback list of 8 prompts × 4 langs.
-- Lecturers in the field want to tune these on the fly (per-region wording,
-- audience-specific scenarios, demo flow tweaks) without redeploying.
--
-- Storage: jsonb column on the existing global_config singleton row, shape
-- matches DEFAULT_QUICK_OPTIONS exactly:
--   { 'zh-CN': [{role,industry,challenge}, ...], 'zh-HK': [...], en: [...], ja: [...] }
--
-- null = "use the bundled defaults" (fresh project / not yet customised).
-- An empty record {} or a lang with [] also falls back to defaults at the
-- consuming layer; server stays neutral about defaulting policy.
-- ─────────────────────────────────────────────────────────────

alter table public.global_config
  add column if not exists quick_scenarios jsonb;
