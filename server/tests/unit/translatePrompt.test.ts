// ───────────────────────────────────────────
// buildTranslatePrompt behavioral test — 跟 prompt.test.ts 同思路：
// 锁住"应有行为"，不要 snapshot 实现长什么样。
// ───────────────────────────────────────────

import { describe, expect, it } from 'vitest';

import { buildTranslatePrompt } from '../../src/lib/translatePrompt.js';

const sample = {
  name: '客户关系管理 (CRM)',
  description: '整合客户数据、追踪销售漏斗',
  audience: '销售VP',
};

describe('buildTranslatePrompt · 源字段插值', () => {
  it('includes the source name verbatim', () => {
    const out = buildTranslatePrompt(sample);
    expect(out).toContain('客户关系管理 (CRM)');
  });

  it('includes the source description verbatim', () => {
    const out = buildTranslatePrompt(sample);
    expect(out).toContain('整合客户数据、追踪销售漏斗');
  });

  it('includes the source audience verbatim', () => {
    const out = buildTranslatePrompt(sample);
    expect(out).toContain('销售VP');
  });

  it('handles empty description / audience gracefully (just leaves "")', () => {
    const out = buildTranslatePrompt({ ...sample, description: '', audience: '' });
    // 不抛 + 仍然提到 3 字段名
    expect(out).toContain('name:');
    expect(out).toContain('description:');
    expect(out).toContain('audience:');
  });
});

describe('buildTranslatePrompt · 目标 lang 锁', () => {
  it('asks for zh-HK 繁體中文', () => {
    expect(buildTranslatePrompt(sample)).toMatch(/zh-HK.*繁/);
  });

  it('asks for en English', () => {
    expect(buildTranslatePrompt(sample)).toMatch(/"en".*English/i);
  });

  it('asks for ja 日本語', () => {
    expect(buildTranslatePrompt(sample)).toMatch(/"ja".*日本語/);
  });

  it('mentions all 3 target langs as JSON keys in shape', () => {
    const out = buildTranslatePrompt(sample);
    expect(out).toContain('"zh-HK"');
    expect(out).toContain('"en"');
    expect(out).toContain('"ja"');
  });
});

describe('buildTranslatePrompt · 缩写保留规则 (D2)', () => {
  it('lists CRM / CLM / OMS / ERP 等业务缩写', () => {
    const out = buildTranslatePrompt(sample);
    expect(out).toMatch(/CRM/);
    expect(out).toMatch(/CLM/);
    expect(out).toMatch(/OMS/);
    expect(out).toMatch(/ERP/);
  });

  it('lists CFO / CTO / VP 等职位缩写', () => {
    const out = buildTranslatePrompt(sample);
    expect(out).toMatch(/CFO/);
    expect(out).toMatch(/CTO/);
    expect(out).toMatch(/VP/);
  });

  it('gives an explicit "CRM" example so LLM sees the rule applied', () => {
    const out = buildTranslatePrompt(sample);
    // example 锚定：用 "Customer Relationship Management (CRM)" 提示 LLM
    // 不要丢掉括号里的缩写
    expect(out).toMatch(/Customer Relationship Management.*CRM/);
  });
});

describe('buildTranslatePrompt · 输出契约锁', () => {
  it('forbids markdown code fences in output', () => {
    const out = buildTranslatePrompt(sample);
    // prompt 必须显式禁止 markdown 围栏（防 LLM 包成 ```json{}```）
    expect(out).toMatch(/markdown/i);
  });

  it('demands strict JSON only (no explanation text)', () => {
    expect(buildTranslatePrompt(sample)).toMatch(/JSON|json/);
  });

  it('shows the expected JSON shape with name/description/audience keys', () => {
    const out = buildTranslatePrompt(sample);
    // 3 lang × 3 field 都得在示例 shape 里 — 防 LLM 漏 field
    expect(out).toContain('"name"');
    expect(out).toContain('"description"');
    expect(out).toContain('"audience"');
  });
});

describe('buildTranslatePrompt · 边界', () => {
  it('does not throw on special characters in fields', () => {
    expect(() =>
      buildTranslatePrompt({
        name: 'X & Y "quoted" <tag>',
        description: '反斜杠\\test',
        audience: '中英混合 mix',
      }),
    ).not.toThrow();
  });

  it('renders multi-line description without breaking shape', () => {
    const out = buildTranslatePrompt({
      ...sample,
      description: '第一行\n第二行\n第三行',
    });
    expect(out).toContain('第一行');
    expect(out).toContain('第三行');
    // 整 prompt 仍然提到 JSON shape
    expect(out).toContain('"zh-HK"');
  });
});
