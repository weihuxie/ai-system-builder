// ───────────────────────────────────────────
// 结构化日志 —— 一行 JSON 打到 stdout，Vercel Logs 直接就能筛
//
// 为什么自己写而不上 pino/winston：
//   - Vercel Function 冷启动对依赖敏感，越少越好
//   - 我们只关心 LLM 管线那几个字段，不需要 log level / transport / rotate
//   - 一行 JSON 足够让事后复盘有源可查
//
// 约定：
//   - 所有字段放扁平 object（不要嵌套），方便 Vercel Logs 里搜
//   - 敏感字段（prompt 原文、audio buffer）不进日志；只记长度/hash
//   - event 名走 snake_case，便于 grep 和未来迁移到 DataDog
// ───────────────────────────────────────────

export interface LogEvent {
  /** 事件名，snake_case，如 'generate_success' / 'stt_timeout' */
  event: string;
  /** 其它字段随意，但建议固定用 traceId / latencyMs / outcome 这些惯用名 */
  [key: string]: unknown;
}

/**
 * Emit a single-line JSON log. Use for anything we'd want to grep in Vercel Logs later.
 * Goes to stdout — Vercel captures all console output as function logs.
 */
export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  const line: LogEvent = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

/** Generate a short trace ID for request-scoped correlation. */
export function newTraceId(): string {
  // 8 hex chars is enough for demo — collisions per day are negligible at our QPS.
  return Math.random().toString(16).slice(2, 10);
}
