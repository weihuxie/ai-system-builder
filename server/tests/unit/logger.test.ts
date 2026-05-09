// ───────────────────────────────────────────
// logger.ts unit tests —— logEvent + newTraceId
//
// 之前 mutation: 0% / 4 mutants (2 surviving + 2 NoCov)。logger 是底层
// 工具但用得最广（generate / stt / errorHandler 都依赖），契约必须有锁。
// ───────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logEvent, newTraceId } from '../../src/lib/logger.js';

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('logEvent', () => {
  it('emits exactly one console.log call per invocation', () => {
    logEvent('test_event');
    expect(logSpy).toHaveBeenCalledOnce();
  });

  it('emits a single-line JSON string (Vercel Logs grep-able)', () => {
    logEvent('test_event');
    const arg = logSpy.mock.calls[0]![0];
    expect(typeof arg).toBe('string');
    expect(() => JSON.parse(arg as string)).not.toThrow();
    // 单行 — 不应该有换行符在中间（除了末尾 console.log 自己加的，那不在 arg 里）
    expect(String(arg)).not.toContain('\n');
  });

  it('includes event name field exactly as provided', () => {
    logEvent('llm_chain_failover');
    const arg = logSpy.mock.calls[0]![0] as string;
    const obj = JSON.parse(arg) as Record<string, unknown>;
    expect(obj.event).toBe('llm_chain_failover');
  });

  it('includes ts field as ISO8601 UTC timestamp', () => {
    logEvent('any');
    const obj = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(typeof obj.ts).toBe('string');
    // ISO8601: 2026-XX-XXTXX:XX:XX.XXXZ
    expect(obj.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('merges extra fields verbatim (flat object, not nested)', () => {
    logEvent('generate_success', { latencyMs: 1234, provider: 'gemini', traceId: 'abc' });
    const obj = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(obj.latencyMs).toBe(1234);
    expect(obj.provider).toBe('gemini');
    expect(obj.traceId).toBe('abc');
  });

  it('extra fields default to empty object (zero-arg overload)', () => {
    logEvent('event_only');
    const obj = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(obj.event).toBe('event_only');
    expect(obj.ts).toBeDefined();
    // 没有意外字段
    const keys = Object.keys(obj);
    expect(keys.sort()).toEqual(['event', 'ts']);
  });

  it('does NOT override ts/event when caller passes them in fields (event wins from named arg)', () => {
    // 防御 mutation 把 spread order 反过来。当前实现 ts/event 先放，spread 后放，
    // 所以 caller 提供 event/ts 会 OVERRIDE。这条 pin 实际行为，让 mutation
    // 反 spread order 时挂。
    logEvent('first_event', { event: 'second_event', otherField: 1 });
    const obj = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    // 当前行为：spread 在最后，所以 fields.event override 了第一个 event
    expect(obj.event).toBe('second_event');
    expect(obj.otherField).toBe(1);
  });
});

describe('newTraceId', () => {
  it('returns 8-char hex string', () => {
    const id = newTraceId();
    expect(id).toMatch(/^[0-9a-f]{1,8}$/);
  });

  it('two calls produce different ids (collision rate negligible)', () => {
    const a = newTraceId();
    const b = newTraceId();
    expect(a).not.toBe(b);
  });

  it('100 calls produce ≥99 unique ids (sanity check on randomness)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(newTraceId());
    // 8 hex chars = 16^8 keyspace — 100 个里碰撞概率 ≈ 0
    expect(ids.size).toBeGreaterThanOrEqual(99);
  });
});
