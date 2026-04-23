#!/usr/bin/env node
// ───────────────────────────────────────────
// One-shot migration: products.url JSONB legacy → BrandLangMap
//
// Before:  { google: "https://…", aws: "https://…" }
// After:   { google: { 'zh-CN': url, 'zh-HK': url, en: url, ja: url },
//            aws:    { … } }
//
// Why:
//   Landing-page URL schema upgraded from BrandMap (brand-only) to
//   BrandLangMap (brand × lang). Each product now can point 日本 viewers
//   to workspace.google.com/intl/ja/ while keeping the global URL for en.
//   See shared/src/types.ts BrandLangMap + shared/src/i18n.ts pickBrandLang.
//
// Safety:
//   - Idempotent: rows already in new shape are skipped (no UPDATE).
//   - Per-row: prints BEFORE and AFTER JSON for audit.
//   - --dry-run: just prints, doesn't UPDATE.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/migrate-product-urls.mjs [--dry-run]
// ───────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[migrate] SUPABASE_URL and SUPABASE_SERVICE_KEY required');
  console.error('[migrate]   Get service key from Supabase dashboard → Project settings → API');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Is a url JSONB entry already in the new BrandLangMap shape? */
function isNewShape(url) {
  if (!url || typeof url !== 'object') return false;
  const hasBrandKeys = 'google' in url || 'aws' in url;
  if (!hasBrandKeys) return false;
  // In new shape each brand value is an object (LangMap); in legacy it's a string.
  const googleIsObject = url.google == null || typeof url.google === 'object';
  const awsIsObject = url.aws == null || typeof url.aws === 'object';
  return googleIsObject && awsIsObject;
}

/** Inflate a single brand entry (string | partial LangMap | null) → full LangMap. */
function inflate(v) {
  if (typeof v === 'string') {
    return { 'zh-CN': v, 'zh-HK': v, en: v, ja: v };
  }
  if (v && typeof v === 'object') {
    return {
      'zh-CN': typeof v['zh-CN'] === 'string' ? v['zh-CN'] : '',
      'zh-HK': typeof v['zh-HK'] === 'string' ? v['zh-HK'] : '',
      en: typeof v.en === 'string' ? v.en : '',
      ja: typeof v.ja === 'string' ? v.ja : '',
    };
  }
  return { 'zh-CN': '', 'zh-HK': '', en: '', ja: '' };
}

function upgradeUrl(url) {
  const obj = url && typeof url === 'object' ? url : {};
  return {
    google: inflate(obj.google),
    aws: inflate(obj.aws),
  };
}

async function main() {
  console.log(`[migrate] mode=${DRY_RUN ? 'dry-run' : 'WRITE'}`);
  const { data: rows, error } = await supabase.from('products').select('id, url');
  if (error) {
    console.error('[migrate] fetch failed:', error.message);
    process.exit(2);
  }
  console.log(`[migrate] ${rows.length} products total`);

  let upgraded = 0;
  let skipped = 0;
  for (const row of rows) {
    if (isNewShape(row.url)) {
      console.log(`  ↷ ${row.id.padEnd(20)} already new-shape`);
      skipped++;
      continue;
    }
    const next = upgradeUrl(row.url);
    console.log(`  ▲ ${row.id.padEnd(20)} legacy → new`);
    console.log(`      before: ${JSON.stringify(row.url)}`);
    console.log(`      after:  ${JSON.stringify(next)}`);

    if (!DRY_RUN) {
      const { error: updErr } = await supabase
        .from('products')
        .update({ url: next })
        .eq('id', row.id);
      if (updErr) {
        console.error(`  ✗ ${row.id} update failed: ${updErr.message}`);
        process.exit(3);
      }
    }
    upgraded++;
  }

  console.log('');
  console.log(`[migrate] done. upgraded=${upgraded} skipped=${skipped}${DRY_RUN ? ' (dry-run — no writes)' : ''}`);
}

main().catch((e) => {
  console.error('[migrate] fatal:', e);
  process.exit(1);
});
