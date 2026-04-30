// Coarse role buckets for the homepage product filter.
//
// Why bucketing instead of raw role chips?
// `product.audience` is a free-text comma/separator-delimited string of roles
// (e.g. "销售VP、客户成功经理、市场运营") and across 9 demo products there are
// 25+ distinct role mentions. Showing 25+ chips would be paralyzing; bucketing
// to 8 functional categories keeps the filter scannable.
//
// Why heuristic regex (not a `category` column on products)?
// Adding a schema field would force admins to recategorize every product they
// edit — 1 product manager mistake = 1 missing bucket. Heuristic regex over
// audience text is "good enough": new products get auto-classified at runtime
// without any tagging step. Misclassifications surface as visible miscount,
// easy to spot in QA. If false-positives become a problem we can add a
// curated override field on top of (not instead of) this.
//
// Bucket coverage rationale: these 8 cover Summit demo's product roster
// (sales / legal / finance / IT / operations / marketing / procurement /
// supply chain). Adding more categories adds noise; cutting fewer drops
// resolution.

export const ALL_AUDIENCE_BUCKETS = [
  'sales',
  'legal',
  'finance',
  'it',
  'ops',
  'marketing',
  'procurement',
  'supply',
] as const;

export type AudienceBucket = (typeof ALL_AUDIENCE_BUCKETS)[number];

// Each pattern OR-matches against the lowercased audience string. Patterns
// stay broad on purpose — same role expressed in different langs (e.g.
// "Sales Director" / "销售总监" / "営業部長") all funnel to the same bucket.
const PATTERNS: Record<AudienceBucket, RegExp> = {
  sales: /sales|bd\b|销售|営業|客戶成功|客户成功|customer success|cs\b/i,
  legal: /legal|法务|法務|dpo|ciso|compliance|合规|合規|法律|审查|審查|法総/i,
  finance: /cfo|finance|accountant|cashier|treasurer|treasury|财务|財務|会计|會計|出纳|出納|经理|payroll|expense|清结算|清結算|settle/i,
  it: /cto|cio|engineer|developer|technical|tech\b|ai\b|automation|自动化|自動化|技术|技術|研发|研發|infrastructure/i,
  ops: /coo|operation|operations|customer support|客户支持|客戶支持|运营|運營|海外事业|海外事業|delivery/i,
  marketing: /cmo|marketing|brand\b|growth|市场|市場|品牌|publicity|outreach/i,
  procurement: /procurement|sourcing|buyer|采购|採購|rfq|supplier mgmt/i,
  supply: /supply chain|supply.chain|logistics|inventory|warehouse|供应链|供應鏈|物流|库存|庫存|scp\b|srm\b/i,
};

/**
 * Map a free-text audience string to the set of role buckets it covers.
 * Empty Set if no pattern matches (rare; new products that don't fit any
 * category — they still show up in the unfiltered grid, just won't be
 * surfaced by any chip's filter).
 */
export function audienceBucketsFor(audience: string): Set<AudienceBucket> {
  const out = new Set<AudienceBucket>();
  if (!audience) return out;
  for (const b of ALL_AUDIENCE_BUCKETS) {
    if (PATTERNS[b].test(audience)) out.add(b);
  }
  return out;
}
