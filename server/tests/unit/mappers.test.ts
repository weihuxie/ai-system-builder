// ───────────────────────────────────────────
// Mappers (rowToProduct / productToRow / normaliseUrl 等) unit tests
//
// 为什么补：mutation baseline 显示 mappers.ts 0% / 90 NoCoverage —
// 整个文件零测试。inflateBrandUrls 兼容 legacy schema 的归一化逻辑
// (CLAUDE.md §2.5.1 提到的旧 JSONB shape) 是 prod 数据库迁移期间
// 唯一防爆点，必须有契约测试锁。
//
// 这里用纯单测：mappers.ts 是无副作用的转换函数集合。
// ───────────────────────────────────────────

import { describe, expect, it } from 'vitest';

import { productToRow, rowToProduct, type ProductRow } from '../../src/lib/mappers.js';

const fullLang = { 'zh-CN': 'zh', 'zh-HK': 'hk', en: 'en', ja: 'ja' };

const minimalRow = (overrides: Partial<ProductRow> = {}): ProductRow => ({
  id: 'CRM',
  name: fullLang,
  description: fullLang,
  audience: fullLang,
  url: { google: fullLang, aws: fullLang },
  is_participating: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  owner_id: null,
  ...overrides,
});

describe('rowToProduct · happy path (new BrandLangMap url shape)', () => {
  it('converts snake_case row → camelCase ProductItem', () => {
    const row = minimalRow();
    const p = rowToProduct(row);
    expect(p.id).toBe('CRM');
    expect(p.isParticipating).toBe(true);
    expect(p.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(p.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(p.ownerId).toBeNull();
  });

  it('preserves full BrandLangMap when url is already inflated', () => {
    const p = rowToProduct(minimalRow());
    expect(p.url.google).toEqual(fullLang);
    expect(p.url.aws).toEqual(fullLang);
  });

  it('passes ownerEmail through (denormalized arg)', () => {
    const p = rowToProduct(minimalRow({ owner_id: 'uuid-1' }), 'editor@example.com');
    expect(p.ownerEmail).toBe('editor@example.com');
    expect(p.ownerId).toBe('uuid-1');
  });

  it('defaults ownerEmail to null when not passed', () => {
    expect(rowToProduct(minimalRow()).ownerEmail).toBeNull();
  });
});

describe('rowToProduct · legacy url shape (CLAUDE.md §2.5.1 兼容)', () => {
  it('inflates legacy { google: "url", aws: "url" } strings to LangMap', () => {
    const p = rowToProduct(
      minimalRow({
        url: { google: 'https://g.com', aws: 'https://a.com' },
      }),
    );
    // legacy string → 4 lang 全部 fill 同一个 url
    expect(p.url.google).toEqual({
      'zh-CN': 'https://g.com',
      'zh-HK': 'https://g.com',
      en: 'https://g.com',
      ja: 'https://g.com',
    });
    expect(p.url.aws).toEqual({
      'zh-CN': 'https://a.com',
      'zh-HK': 'https://a.com',
      en: 'https://a.com',
      ja: 'https://a.com',
    });
  });

  it('handles half-legacy half-new shape mid-migration', () => {
    const p = rowToProduct(
      minimalRow({
        url: {
          google: 'https://g.com', // legacy
          aws: { 'zh-CN': 'a-cn', 'zh-HK': 'a-hk', en: 'a-en', ja: 'a-ja' }, // new
        },
      }),
    );
    expect(p.url.google.en).toBe('https://g.com');
    expect(p.url.aws.en).toBe('a-en');
  });

  it('fills missing lang keys with empty string in partial LangMap', () => {
    const p = rowToProduct(
      minimalRow({
        url: { google: { en: 'only-en' }, aws: { ja: 'only-ja' } },
      }),
    );
    expect(p.url.google).toEqual({ 'zh-CN': '', 'zh-HK': '', en: 'only-en', ja: '' });
    expect(p.url.aws).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: 'only-ja' });
  });

  it('coerces non-string lang values to empty string (defensive)', () => {
    const p = rowToProduct(
      minimalRow({
        url: { google: { 'zh-CN': 'ok', en: 123 as unknown as string } },
      }),
    );
    expect(p.url.google['zh-CN']).toBe('ok');
    expect(p.url.google.en).toBe(''); // number coerced to ''
  });
});

describe('rowToProduct · url defensive edge cases', () => {
  it('returns empty maps when url is undefined', () => {
    const p = rowToProduct(minimalRow({ url: undefined }));
    expect(p.url.google).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: '' });
    expect(p.url.aws).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: '' });
  });

  it('returns empty maps when url is null', () => {
    const p = rowToProduct(minimalRow({ url: null as unknown as ProductRow['url'] }));
    expect(p.url.google).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: '' });
  });

  it('returns empty maps when url is a string (totally malformed)', () => {
    const p = rowToProduct(minimalRow({ url: 'totally-wrong' }));
    expect(p.url.google).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: '' });
  });

  it('treats missing brand key as empty (asymmetric brands)', () => {
    const p = rowToProduct(minimalRow({ url: { google: { en: 'g' } } }));
    expect(p.url.google.en).toBe('g');
    expect(p.url.aws).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: '' });
  });
});

describe('rowToProduct · industries normalisation (migration 0005)', () => {
  it('returns [] when industries column is missing (pre-migration row)', () => {
    const p = rowToProduct(minimalRow());
    expect(p.industries).toEqual([]);
  });

  it('returns [] when industries is null', () => {
    const p = rowToProduct(minimalRow({ industries: null }));
    expect(p.industries).toEqual([]);
  });

  it('returns [] when industries is not an array', () => {
    const p = rowToProduct(minimalRow({ industries: 'not-array' as unknown }));
    expect(p.industries).toEqual([]);
  });

  it('preserves valid string array', () => {
    const p = rowToProduct(minimalRow({ industries: ['manufacturing', 'finance'] }));
    expect(p.industries).toEqual(['manufacturing', 'finance']);
  });

  it('drops non-string entries from mixed array (defensive)', () => {
    const p = rowToProduct(
      minimalRow({ industries: ['manufacturing', 123, null, '', 'finance'] as unknown[] }),
    );
    // 数字 / null / 空串都被 filter 掉
    expect(p.industries).toEqual(['manufacturing', 'finance']);
  });
});

describe('productToRow · partial PATCH semantics', () => {
  it('only includes fields that are explicitly set (strict — no undefined keys)', () => {
    // 用 toStrictEqual 而非 toEqual：vitest toEqual 容忍 { id: undefined } ≡ {}，
    // 让 PATCH undefined-check 的 mutation 漏网（if (p.id !== undefined) → if (true)
    // 会让 row.id 被赋值成 undefined，但 toEqual 看不出区别）。toStrictEqual
    // 严格匹配 + Object.keys 显式断言 keys 数量，杀这类 mutation。
    const row = productToRow({ id: 'X', isParticipating: false });
    expect(row).toStrictEqual({ id: 'X', is_participating: false });
    expect(Object.keys(row).sort()).toEqual(['id', 'is_participating']);
    // 其它字段必须不出现（PATCH 语义关键 — 否则会把别的列写空）
    expect('name' in row).toBe(false);
    expect('description' in row).toBe(false);
    expect('owner_id' in row).toBe(false);
  });

  it('PATCH 单字段：只 set name 时其它 5 个字段都不出现 (kills 5 ConditionalExpression mutants)', () => {
    const row = productToRow({ name: { 'zh-CN': '', 'zh-HK': '', en: 'X', ja: '' } });
    expect(Object.keys(row)).toEqual(['name']);
  });

  it('PATCH 单字段：只 set description / audience / url / industries 各自只出现一个 key', () => {
    expect(Object.keys(productToRow({ description: { 'zh-CN': '', 'zh-HK': '', en: '', ja: '' } }))).toEqual(['description']);
    expect(Object.keys(productToRow({ audience: { 'zh-CN': '', 'zh-HK': '', en: '', ja: '' } }))).toEqual(['audience']);
    expect(Object.keys(productToRow({ url: { google: { 'zh-CN': '', 'zh-HK': '', en: '', ja: '' }, aws: { 'zh-CN': '', 'zh-HK': '', en: '', ja: '' } } }))).toEqual(['url']);
    expect(Object.keys(productToRow({ industries: ['retail'] }))).toEqual(['industries']);
  });

  it('converts camelCase → snake_case for DB columns', () => {
    const row = productToRow({
      id: 'X',
      isParticipating: true,
      ownerId: 'uuid-1',
    });
    expect(row.is_participating).toBe(true);
    expect(row.owner_id).toBe('uuid-1');
  });

  it('handles ownerId=null explicitly (clears owner)', () => {
    const row = productToRow({ id: 'X', ownerId: null });
    // null 必须保留为 null (不能丢)，否则更新时 owner 不会被清空
    expect('owner_id' in row).toBe(true);
    expect(row.owner_id).toBeNull();
  });

  it('passes through name / description / audience / url / industries unchanged', () => {
    const row = productToRow({
      id: 'X',
      name: fullLang,
      description: fullLang,
      audience: fullLang,
      url: { google: fullLang, aws: fullLang },
      industries: ['retail'],
    });
    expect(row.name).toBe(fullLang);
    expect(row.description).toBe(fullLang);
    expect(row.audience).toBe(fullLang);
    expect(row.url).toEqual({ google: fullLang, aws: fullLang });
    expect(row.industries).toEqual(['retail']);
  });

  it('returns empty object when input is empty (strict — no implicit undefined keys)', () => {
    // toStrictEqual + keys.length=0 → 杀 if undefined-check mutation
    expect(productToRow({})).toStrictEqual({});
    expect(Object.keys(productToRow({})).length).toBe(0);
  });
});

describe('inflateBrandUrls · L47 LogicalOperator + ConditionalExpression', () => {
  // L47 surviving mutation:
  //   - LogicalOperator: `v && typeof v === 'object'` → `v || typeof v === 'object'`
  //   - ConditionalExpression: 整个条件 → `true`
  // 这两条都让"非 object 非 string 的输入"走错分支。补几条 falsy 输入测试。

  it('non-object non-string returns empty LangMap (number)', () => {
    // 这个 case 走的就是 line 56 默认分支。如果 mutation 让条件 → true，
    // 函数会尝试从 number 上读 .zh-CN 等 → 全是 undefined → 仍然返 empty
    // LangMap，看似行为一致 — 但分支差异在 typeof obj['xx'] === 'string'
    // check 上。我们再 pin 几条 case 让 mutation 难以等价。
    const result = rowToProduct(minimalRow({ url: { google: 42 } }));
    expect(result.url.google).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: '' });
  });

  it('non-object non-string returns empty LangMap (true)', () => {
    const result = rowToProduct(minimalRow({ url: { google: true } }));
    expect(result.url.google).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: '' });
  });

  it('non-object non-string returns empty LangMap (Symbol)', () => {
    const result = rowToProduct(minimalRow({ url: { google: Symbol('s') } as never }));
    expect(result.url.google).toEqual({ 'zh-CN': '', 'zh-HK': '', en: '', ja: '' });
  });
});

describe('rowToProduct ↔ productToRow round-trip', () => {
  it('product through row then back preserves observable fields', () => {
    const original = rowToProduct(minimalRow({ owner_id: 'uuid-1', industries: ['retail'] }));
    const partialRow = productToRow(original);
    // round-trip 应当还原所有非时间戳字段
    expect(partialRow.id).toBe(original.id);
    expect(partialRow.name).toBe(original.name);
    expect(partialRow.is_participating).toBe(original.isParticipating);
    expect(partialRow.owner_id).toBe(original.ownerId);
    expect(partialRow.industries).toEqual(original.industries);
  });
});
