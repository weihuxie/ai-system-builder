// ───────────────────────────────────────────
// Product translation prompt — source lang fixed to zh-CN (决策 F1)
//
// 用在 admin ProductEditor 新增/编辑产品时，把简中字段一键翻成 zh-HK / en /
// ja 3 种语言。LLM 必须返结构化 JSON，contract 用 prompt 锁死。
//
// 关键约束:
//   - 保留英文缩写不译 (CRM/CLM/OMS/SaaS/AI/CFO/CTO/VP 等 — 决策 D2)
//   - audience 用各语言职位标准说法
//   - 严格 JSON 不要 markdown 包裹
// ───────────────────────────────────────────

export interface TranslateInputFields {
  name: string;
  description: string;
  audience: string;
}

export function buildTranslatePrompt(fields: TranslateInputFields): string {
  return `你是产品文案的多语言翻译专家。

源语言：简体中文 (zh-CN)
- name:        "${fields.name}"
- description: "${fields.description}"
- audience:    "${fields.audience}"

任务：把以上 3 个字段翻成以下 3 种目标语言：
  - "zh-HK" (繁體中文)
  - "en"    (English)
  - "ja"    (日本語)

要求：
1. 保留英文缩写、技术术语、职位缩写不译：CRM / CLM / OMS / ERP / SaaS / AI / CFO / CTO / VP / CMO / COO / API / SDK 等。
   例：源 "客户关系管理 (CRM)" → en 必须保留 "Customer Relationship Management (CRM)"，不要丢括号里的 CRM。
2. 产品上下文专业不机器味：
   - name 简洁，避免直译
   - audience 用各语言的标准职位说法（zh-HK 用 "財務長/銷售VP" 等繁体习惯；ja 用 "CFO" / "営業VP"；en 用 "CFO" / "VP of Sales"）
   - description 保留产品价值点，可适当意译让目标语言读者顺
3. 字段为空时返空串，不要凭空捏造内容
4. 严格 JSON 输出，不要 markdown 围栏（不要 \\\`\\\`\\\`），不要任何解释文字

JSON shape (键名必须完全这样)：
{
  "zh-HK": { "name": "...", "description": "...", "audience": "..." },
  "en":    { "name": "...", "description": "...", "audience": "..." },
  "ja":    { "name": "...", "description": "...", "audience": "..." }
}`;
}
