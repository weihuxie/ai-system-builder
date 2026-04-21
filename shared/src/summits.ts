// ───────────────────────────────────────────
// Summit 巡回日程（source of truth）
//
// 用途：
//   1. 倒推 deadline — 脚本 / CI 可读日期计算距下一场还剩多少天
//   2. 现场 lang / brand 默认值 — 每站的官方场次语言和品牌不一样
//   3. 灾备 / 预热时机 — Summit 前 N 天自动跑烟囱测试（未来）
//
// 事实来源：各家官网活动页（registrationUrl 字段存链接）。有变更以
// 官方为准，改这个常量，别散在代码里硬编码日期。
// ───────────────────────────────────────────

import type { Brand, Lang } from './types.js';

export type SummitCity = 'tokyo' | 'hongkong' | 'shanghai' | 'singapore';

export interface SummitEvent {
  city: SummitCity;
  /** 该站所属品牌（决定 theme / accent） */
  brand: Brand;
  /** 官方活动全称，以官网为准 */
  officialName: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** 官方场馆 */
  venue: string;
  /** 现场默认 UI 语言（讲师一进站就走这个 lang） */
  defaultLang: Lang;
  /** 官方注册链接（追溯用，讲师也能贴给观众） */
  registrationUrl?: string;
}

// 2026 Summit 巡回 —— 已确认的填实，未确认的保留 TODO 便于一眼看见缺口。
export const SUMMIT_SCHEDULE: readonly SummitEvent[] = [
  {
    city: 'hongkong',
    brand: 'aws',
    officialName: 'AWS Summit Hong Kong 2026',
    date: '2026-06-17',
    venue: 'Hong Kong Convention and Exhibition Centre',
    defaultLang: 'en',
    registrationUrl:
      'https://registration.awsevents.com/flow/awsevents/summithkg26/genreg',
  },
  // TODO(urls pending): tokyo / shanghai / singapore —— 等用户补官网链接
];

/** 按当前日期取"下一场 Summit"。None if schedule 为空或全部已过。 */
export function nextSummit(
  now: Date = new Date(),
  schedule: readonly SummitEvent[] = SUMMIT_SCHEDULE,
): SummitEvent | null {
  const todayISO = now.toISOString().slice(0, 10);
  const upcoming = schedule
    .filter((s) => s.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

/** 距下一场还有多少天（向下取整）；没 Summit 就返回 null。 */
export function daysUntilNextSummit(now: Date = new Date()): number | null {
  const next = nextSummit(now);
  if (!next) return null;
  const diffMs = new Date(next.date + 'T00:00:00Z').getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
