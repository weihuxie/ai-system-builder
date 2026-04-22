// ───────────────────────────────────────────
// 统一超时策略 —— LLM 调用硬卡截止线
//
// 为什么单独一个文件：
//   - generate（文本）和 STT（音频）超时预算不同
//   - 两个路径都要判「这是不是 timeout 错误」，helper 复用一份
//
// 设计原则：
//   - 超时一律被 provider 层吃掉 → 转成 'overload'，让 fallback 链接上
//   - fetch() 用 AbortSignal.timeout()（真取消底层连接）
//   - SDK 调用（@google/genai 不收 signal）用 Promise.race（不取消但不等）
// ───────────────────────────────────────────

/** 文本生成硬超时：15s。超了就 fallback 下一家 provider。 */
export const GENERATE_TIMEOUT_MS = 15_000;

/** STT 硬超时：30s。音频转写比文本慢，给足 buffer；再超就是网络问题。 */
export const STT_TIMEOUT_MS = 30_000;

export function isAbortOrTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name;
  return name === 'TimeoutError' || name === 'AbortError' || /timeout/i.test(err.message);
}

/**
 * Race a promise against a timeout. For SDK calls that don't accept an
 * AbortSignal (e.g. @google/genai). The underlying request may continue to
 * completion on the server, but we stop waiting and let the caller move on.
 */
export async function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timeout after ${ms}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
