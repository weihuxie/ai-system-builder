# AI System Builder · 工程备忘

> 给未来维护者（和 AI 协作者）看。记录关键决策、踩过的坑、不要重复犯的错。
>
> 正式设计文档见 [`../ai-system-builder-design.md`](../ai-system-builder-design.md)。

---

## 一、项目定位（别忘了）

**Google + AWS Summit 多站巡回 demo**，由**讲师**在演示机上操作（**不是**观众自助）。

- 4 站：东京 / 香港 / 上海 / 新加坡
- 讲师在上海场需搭梯子访问 Gemini API（境内直连不通）
- 品牌可在运行时切换（Google ↔ AWS）
- 一人改配置，所有演示机 Supabase Realtime 同步

上述约束决定了：
- 后端部署在**新加坡 Cloud Run**（延迟均衡 + 讲师梯子出口常见）
- Config 鉴权只做**单密码 + JWT**（讲师共享，轻量）
- 观众自助访问**未在 v1 考虑**；若未来开放，rate limit / 鉴权策略必须重评

---

## 二、架构决策（不要轻易改）

### 2.1 monorepo + npm workspaces
- `shared/` 是 source of truth：ProductItem / Solution / Lang / Brand 类型 + Zod schema
- 改了 `shared/` → 前后端都自动取到新类型
- **禁止**在 `client/` 或 `server/` 本地重新定义已存在于 `shared/` 的类型

### 2.2 API Key 不进前端 bundle
- 前端**禁止**直接 import `@google/genai`
- 所有 AI 调用走后端 `/api/generate` 和 `/api/stt`
- 前端 `.env` 只能有 `VITE_` 前缀变量，且必须是**低敏**（anon key / base URL）

### 2.3 Supabase 为 config 存储层
- 产品库 / 全局配置（brand）在 Postgres
- RLS 开启：前端用 anon key 只能读；写操作必须后端用 service key
- Realtime 订阅 products / global_config 表实现多站同步
- 不用 localStorage 做 Config 持久化（单机数据漂移会害死多站）

### 2.4 Gemini 2.5 Pro（推荐） + 2.5 Flash（STT）
- 同一家 Key，运维最小
- STT 若某语言（可能是日语）不达标，**后端**切 Whisper，前端无感
  - 已实现（`server/src/lib/whisper.ts`）：Gemini 空结果/失败时自动 fallback
  - 启用条件：env 配了 `OPENAI_API_KEY`；没配 → 单通道 Gemini，0 regression
  - 东京场前务必验证：带 key / 不带 key 两条路径都要真跑过一次
- 前端 `MediaRecorder` 录 webm/opus → 后端转文本 → 返回给前端

### 2.5 品牌感知但**不**分产品库
- 产品库共用一份（答 A）
- 品牌差异只体现在：① 视觉（accent/logo/header）② 落地页 URL ③ AI rationale 叙述倾向
- **不要**给 ProductItem 加 `brand` / `availableIn` 字段

---

## 三、写代码前的惯例

### 3.1 类型一律从 `@asb/shared` 取
```ts
import type { ProductItem, Solution, Lang, Brand } from '@asb/shared';
import { ProductItemSchema } from '@asb/shared';
```

### 3.2 AI 输出必须过 Zod
```ts
const parsed = SolutionSchema.safeParse(jsonObject);
if (!parsed.success) throw new AIInvalidError(parsed.error);
```

### 3.3 所有 API 错误返回结构化 JSON
```ts
{ code: 'AI_PARSE' | 'AI_INVALID' | 'UNAUTHORIZED' | ..., message: string, details?: unknown }
```
前端读 `code` 字段决定 UI（红 banner / 静默重试 / 跳登录）。

### 3.4 环境变量访问
- 后端：`process.env.X`
- 前端：`import.meta.env.VITE_X`
- **禁止**前端用 `process.env.X`（v1 demo 就是这个坑：Key 打进 bundle）

---

## 四、已知坑位（陆续补充）

### 4.1 Vite 4 + Tailwind 4 的 PostCSS 迁移
Tailwind 4 不再需要 `tailwind.config.ts` + `postcss.config.js` 配一套，改用 `@tailwindcss/vite` 插件 + `@import "tailwindcss";` 的 CSS 写法。详见 [tailwindcss.com/docs/v4-beta](https://tailwindcss.com/docs/v4-beta)。

### 4.2 Gemini `responseSchema` 对 object + additionalProperties 支持不完整
`rationale: Record<productId, string>` 的 schema 只能声明 type=OBJECT，具体键靠**后端宽松校验**，不能指望 Gemini 按 key 强约束。

### 4.3 Supabase Realtime 默认不订阅所有表
需要在 Supabase Dashboard → Database → Replication 手动开启 `products` 和 `global_config` 的 Realtime。遇到 "改了不同步" 第一个查这里。

### 4.4 上海场演示前必做
- 演示机手动 ping 后端域名 + Supabase + Gemini API 都通
- 梯子不稳时有 **断网兜底**：首屏能展示静态产品列表（不 AI 推荐）
- 操作 Config 前**先截图**：Supabase 改动实时，没后悔药

---

## 五、本地开发

```bash
npm install          # 首次
npm run dev          # 同时起 client (5173) + server (8080)
npm run dev:client   # 只起前端
npm run dev:server   # 只起后端
npm run build        # 全量构建
```

缺 `GEMINI_API_KEY` 时：`/api/generate` 返回 503 + `{ code: 'LLM_REQUIRED' }`，前端应在 banner 提示（和 `ai-studio` 项目的处理方式一致，不做 silent fallback 到模板）。

### 5.1 LLM 管线的两层测试

- **离线 prompt 回归**（每次 PR 跑）

  ```bash
  npm --workspace server run test:unit
  ```

  锁死 `buildRecommendationPrompt()` 在 4 lang × 2 brand 组合下的输出。
  改 prompt 模板 / 换叙述 / 调品牌词 → snapshot 失败 → 看 diff 是否故意，
  是就 `vitest --update`，不是就回滚。

- **在线 golden eval**（Summit 前手动跑一次）

  ```bash
  GEMINI_API_KEY=... npm --workspace server run eval
  ```

  `server/evals/golden.json` 里 12 条 (brand, lang, userInput) → 期望产品
  ID，真实打 Gemini，报 pass/partial/fail + 延迟。CI 不跑（有成本 + 非
  确定性），但每次 demo 前、大改 prompt 后务必跑一轮，看 pass 率别掉。

---

## 六、风险登记

见设计文档 §11（R-1 ~ R-21），每次架构级改动请回填 R-22+。
