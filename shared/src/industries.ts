// Industry tags for products.
//
// Used by:
//   - ProductEditor: super_admin / editor multi-selects which industries a
//     product targets (purely a UI affordance — purely additive metadata)
//   - ProductBottomList: visitor / staff filters the catalog by industry chip
//
// Storage:
//   - products.industries jsonb (default '[]'::jsonb) — see migration 0005
//   - shared as `industries: string[]` on ProductItem (optional; missing
//     means same as empty array)
//
// Empty array semantics:
//   - "applies to all industries" — product surfaces in every industry filter.
//     This is the right default for cross-cutting products like CLM, Expense,
//     CRM where the tool doesn't care about your vertical. Forces editors to
//     opt in to industry-specific tagging only when it matters.
//
// Why 10 buckets and not more?
//   - Summit demo audience tends to come from a familiar set: manufacturing /
//     finance / retail / tech / etc. 10 fits in a single chip row at desktop
//     widths without wrapping. Future products can add new IDs at the call
//     site (the type is `string`, not a strict enum) — this list is the
//     curated UI default, not a hard validator constraint.

export const ALL_INDUSTRIES = [
  'manufacturing', // 制造业
  'finance', // 金融（含银行 / 保险 / 金融科技）
  'retail', // 零售（含 FMCG 快消）
  'ecommerce', // 电商
  'tech', // 科技 / 互联网 / SaaS
  'automotive', // 汽车
  'logistics', // 物流
  'healthcare', // 医疗 / 生物
  'education', // 教育
  'services', // 专业服务（咨询 / 法律 / 财务）
] as const;

export type Industry = (typeof ALL_INDUSTRIES)[number];
