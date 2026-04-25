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

#### 2.3.1 邀请 editor 的双通道（whitelist + magic link）

`POST /api/admin/users` 做三件事：
1. **upsert admin_users 白名单行**（source of truth，失败就 500）
2. **调 `supabase.auth.admin.inviteUserByEmail()`** 发 magic link 邮件（best-effort，失败只 log）
3. **Self-heal `admin_users.user_id`**（code-level 兜底，不依赖 DB trigger）
   —— 从 invite 响应里拿 `user.id`（或 `listUsers()` 查已存在用户），手动 UPDATE
   白名单行把 `user_id` 和 `activated_at` 补上。这样即使 migration 0002 的
   `activate_admin_on_signup` trigger 没装 / 被误删，受邀者也能通过 `requireAdminUser`
   的 user_id join 查到身份，不会报 `Account not authorized`。

**magic link 步骤受 `APP_URL` env gate 控制**：
- 生产 Vercel 配了 `APP_URL=https://summit.aiverygen.ai` → 两步都走，被邀请人收邮件
- 本地 dev / 测试环境**不设** `APP_URL` → 只做 whitelist，不发真邮件（避免测试污染 Supabase auth.users + 避免 dev 期间误发邮件给真人）

响应体有 `inviteEmailSent: boolean`，前端 UI 据此提示 super_admin 是否还要手动通知。

**Supabase Dashboard 必做**（邮件才能收到）：
- Authentication → URL Configuration → Site URL = `https://summit.aiverygen.ai`
- Authentication → URL Configuration → Redirect URLs 加 `https://summit.aiverygen.ai/**`
- （可选）Authentication → Email Templates → Invite user 改中文模板
- （强烈推荐）Authentication → SMTP → 配 Custom SMTP（Resend/SendGrid），默认 Supabase SMTP 每小时只能发几封

**换域名时还要改的 env**（漏一个就 500）：
- Vercel `APP_URL` → 新域名（影响邀请邮件 redirect）
- Vercel `ALLOWED_ORIGINS` → 可选，因为 `app.ts` 已自动放行 `APP_URL` / `VERCEL_URL`
- Supabase Site URL + Redirect URLs（见上）
- Google OAuth Authorized origins/redirects → **不需要改**（callback 走 Supabase）

#### 2.3.2 QQ / 163 邮箱的 magic link 陷阱

**腾讯 / 网易邮箱的"反钓鱼链接预取"**会在邮件送达时主动 GET 邮件里的所有 URL
做安全扫描。Supabase 的 verify URL 是**一次性 token**——扫描器 GET 一下，token
就被消费，真实用户再点就失效。

**现象**：受邀者点邮件链接 → 跳到 `/admin` 但**不带 hash fragment** → 前端拿不到
session → 显示登录页。用户以为是 "还要再走一次 Google 登录"。

**LoginForm 的处理**（`client/src/components/admin/LoginForm.tsx`）：
- **主通道：magic link 自助补发** (`signInWithOtp({ shouldCreateUser: false })`)
  —— 用户在登录页输邮箱，Supabase 重发一封 magic link，手动点即可。仍受同样扫描
  影响但至少有 self-service 出路。
- **副通道：Google OAuth** —— 有 Gmail / Workspace 的用户直接走。
- **域名预警**：输入 `@qq.com / 163 / 126 / sina / sohu / yeah.net / aliyun.com`
  时页面弹橙色提示，建议换邮箱或用手机 App 立刻点链接（桌面客户端扫描更严）。

**彻底绕过**的方案（v2 可能要做）：给受邀者一个"设置密码"页面——密码不是一次性
token，不会被扫描器消费。Supabase 原生不提供 "邀请后设密码" 页，需自建 UI 调
`supabase.auth.updateUser({ password })`。

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

#### 2.5.1 落地页 URL 是 `brand × lang`（8 插槽）

`ProductItem.url` 类型是 `BrandLangMap = Record<Brand, LangMap>`，即每条产品每个
品牌下都有 4 个 lang 的 URL 可填。消费侧统一走 `pickBrandLang(url, brand, lang)`，
fallback 顺序（刻意牺牲 lang 一致性优先保 brand 一致性）：

1. `brand.lang`（精确匹配）
2. `brand.en`（同品牌退回英文）
3. `google.lang`（退到主品牌同语言）
4. `google.en`（最后兜底）
5. `''` → 按钮消失

改 schema 的人须知：
- Admin UI 在 `ProductEditor` 里 URL 输入**跟随 lang tab**——切到日语 tab 会看到
  Google / AWS 两行 URL 输入框都在编辑 `ja` 值。
- Server `rowToProduct` 里有 `normaliseUrl` 兼容老 JSONB shape（`{google:"x"}`），
  新部署**务必跑一次 migration**，把现有 DB 数据 inflate 成新 shape：
  ```bash
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
    node scripts/migrate-product-urls.mjs --dry-run   # 先看
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
    node scripts/migrate-product-urls.mjs             # 再写
  ```
  幂等（二次跑自动跳过已升级的行）。

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

### 3.5 改代码就推（或给理由）

**默认行为**：改完代码 → typecheck/build/unit test 过 → `git commit` → `git push origin main` → Vercel 自动部署。**不需要用户每次催**。

**不推的合法理由**（必须主动告诉用户）：
- 代码半成品 / WIP，commit 也别 commit
- 测试挂了（先修）
- 用户明确说"先别推 / 等我"
- 跨多个逻辑变更，正在分批 commit 中（说一声"还差 N 个 commit"）
- 改的是 dashboard 配置（Vercel env / Supabase / Google OAuth）—— 我没权限，必须用户操作

**不推但没说理由 = bug**。用户问"好了么"前我就该 push 完了。

commit 风格：
- 单个逻辑改动一个 commit，别堆杂烩
- subject 用 `type(scope): 中文摘要`，body 写**为什么**改，不是改了**什么**（diff 自己会说）
- co-author 行带上 `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`

**推完后的返回 URL（生产环境快速参考）**：
- 主域名：**https://summit.aiverygen.ai** ← Summit demo 的对外 URL
- 老 alias：`https://ai-system-builder.vercel.app`（Vercel 自动 307 → 主域，保留兜底）
- Vercel Dashboard：https://vercel.com/dashboard → 项目名 `summit`
- GitHub repo：`weihuxie/ai-system-builder`，main 分支即生产
- 部署链路：`git push origin main` → Vercel webhook 自动 build → 1-2 min 后 Ready
- 推完汇报模板：把改动总结一段 + Vercel Deployments 链接 / 域名给到用户，让 ta 一键去验

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

### 4.5 URL 公开给观众前 · Pre-flight checklist

> v1 定位是讲师演示机独占。任何"把 URL 发到二维码 / slide / 邀请函"
> 之前，下面的 gate 必须全部过。漏一条 = 第一分钟就可能被爬到 quota
> 炸 / key 泄露 / 成本失控。

- [ ] **接 rate limiter** —— `express-rate-limit` 已在 package.json 但
      **未挂到 /api/generate 和 /api/stt**。现在去掉只是 demo 便利，
      公开前必须加：建议每 IP 每分钟 10 次 generate、20 次 stt，
      超了 429。挂点在 `server/src/app.ts` middleware 链。
- [ ] **复查 Supabase RLS** —— products / global_config 的写权限是否
      真的只走 service key；anon key 只能 SELECT。
- [ ] **auth 策略重评** —— §1 说过观众自助未在 v1 考虑。决定是开放
      只读还是加验证码 / 免登录 guest 路径。
- [ ] **成本上限** —— Gemini / Kimi / DeepSeek / OpenAI 的 API key
      都设 monthly quota cap，别等账单飞起来才看见。
- [ ] **eval baseline 刷一遍** —— 跑 `npm --workspace server run eval`
      存 `eval-result.json`，作为"开放时刻"的基线，后面漂移好对账。

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
