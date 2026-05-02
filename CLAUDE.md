# AI System Builder · 工程备忘

> 给未来维护者（和 AI 协作者）看。记录关键决策、踩过的坑、不要重复犯的错。
>
> 正式设计文档见 [`../ai-system-builder-design.md`](../ai-system-builder-design.md)。

---

## 一、项目定位（别忘了）

**Google + AWS Summit 多站巡回 demo**，由**讲师**在演示机上操作（**不是**观众自助）。

- 4 站：东京 / 香港 / 上海 / 新加坡
- 上海场境内直连 Gemini API 不通，应对方式：admin 把 LLM 链拖成
  **DeepSeek + Kimi 优先**（两家国内可达），关 Gemini 防 30s timeout
- 品牌可在运行时切换（Google ↔ AWS）
- 一人改配置，所有演示机 Supabase Realtime 同步

上述约束决定了：
- **部署在 Vercel**（项目名 `summit`，主域 `summit.aiverygen.ai`）—— v1 计划
  过 Cloud Run 但实际走了 Vercel：API 用 Serverless Functions，前端走 Vercel
  Edge CDN，运维成本最低
- **鉴权用 Google OAuth + Supabase Auth + admin_users 白名单**（编辑者 / 超级
  管理员双角色）—— v1 计划过单密码 + JWT，2026-04 升级到 OAuth + RBAC：
  - 邀请走 `supabase.auth.admin.generateLink` 生成一次性链接（详 §2.3.1）
  - 编辑者只看到自己的产品 + 平台只读参考；超管看全部
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

**表清单（截至 migration 0004）**：

| 表 / 列 | 内容 | 由谁写 |
|---|---|---|
| `products` | 产品库（id, name, description, audience, url, isParticipating, owner_id） | editor 写自己；super_admin 写全部 |
| `admin_users` | 邀请白名单（email, user_id, role, invited_by, invited_at, activated_at） | 仅 super_admin |
| `global_config.brand` | 当前品牌（google / aws） | super_admin |
| `global_config.llm_chain` (jsonb) | LLM 调用链（providerId / model / enabled 数组） | super_admin |
| `global_config.temperature` (real) | 全局温度，0-2 | super_admin |
| `global_config.quick_scenarios` (jsonb, 0004) | 首页快速场景（4 lang × N 条），null 走 bundled defaults | super_admin |
| `products.industries` (jsonb, 0005) | 产品行业标签 string[]（manufacturing/finance/...），空 = 通用 wildcard | super_admin / editor 自己产品 |

**约束**：
- RLS 开启：前端用 anon key 只能读 `is_participating=true` 的产品；写操作走后端 service key
- Realtime 订阅 `products` / `global_config` 表实现多站同步
  - **注意**：`global_config.quick_scenarios` 改动也走这个频道但 client realtime.ts
    没显式 invalidate `queryKeys.quickScenarios`——多 tab 同步靠 staleTime=60s 自然 refetch
- 不用 localStorage 做 Config 持久化（单机数据漂移会害死多站）

**Migration 顺序**（部署到新 Supabase 项目时按序跑，全部 IF NOT EXISTS 幂等）：
- `0001_init.sql` — products + global_config 基本 schema
- `0002_auth_and_ownership.sql` — admin_users + auth trigger + products.owner_id + RLS
- `0003_llm_chain.sql` — global_config 加 llm_chain / temperature 列
- `0004_quick_scenarios.sql` — global_config 加 quick_scenarios 列
- `0005_product_industries.sql` — products 加 industries jsonb default '[]'
- 一键脚本：`scripts/test-setup.sql` 把 0001-0005 拼起来贴 Supabase SQL Editor 即可

#### 2.3.1 邀请 editor 的当前流程（whitelist + 一次性链接）

**演进历史**：v1 用 `inviteUserByEmail` 自动发邮件，被 QQ/163 邮件预取 + Supabase
SMTP 限速反复折磨，2026-04 改成"生成链接 super_admin 自己发"——绕开邮件投递。

`POST /api/admin/users` 做三件事：

1. **upsert admin_users 白名单行**（source of truth，失败就 500）
2. **调 `supabase.auth.admin.generateLink()`** 生成一次性登录 URL，**不发邮件**
   —— 优先 `type:'invite'`（创建 auth.users 行），返回 "already registered" 时
   fallback 到 `type:'magiclink'`（已存在用户的一次性登录）。响应里把 `action_link`
   原样返回到前端 `inviteLink: string | null` 字段。
3. **Self-heal `admin_users.user_id`**（code-level 兜底，不依赖 DB trigger）
   —— 从 generateLink 响应拿 `user.id`，手动 UPDATE 白名单行的 `user_id` 和
   `activated_at`。即使 migration 0002 的 `activate_admin_on_signup` trigger 没装
   也能通过 `requireAdminUser` 的 user_id join 查到身份。

**Step 2 受 `APP_URL` env gate 控制**：
- 生产 Vercel 配了 `APP_URL=https://summit.aiverygen.ai` → 生成链接，前端展示复制框
- 本地 dev / 测试环境**不设** `APP_URL` → 只做 whitelist，`inviteLink: null`
  （避免测试污染 Supabase auth.users）

响应体只有 `inviteLink: string | null` 一个字段（2026-04-30 删掉了过渡期保留的
`inviteEmailSent: false` 兼容字段）。

**前端 UI**：`AdminUsersPanel` 邀请成功后展开一个绿色卡片，里面是只读输入框（链接）
+ 复制按钮 + "通过飞书/微信/短信发给对方" 提示语。super_admin 自己挑信任的渠道。

**链接安全特性**：
- 一次性 token —— 任何人点过一次后失效
- 默认有效期由 Supabase 决定（invite ~24h，magiclink ~1h）
- 通过 Lark/微信等私密渠道发送 → 绕开邮件扫描器预取（QQ/163 的杀手）

**Supabase Dashboard 必做**：
- Authentication → URL Configuration → Site URL = `https://summit.aiverygen.ai`
- Authentication → URL Configuration → Redirect URLs 加 `https://summit.aiverygen.ai/**`
  （注意是 `/**` 通配符，没有就匹配不到 `/admin` 子路径）
- （可选）Authentication → Email Templates → Invite user 改中文模板
- **不再需要** custom SMTP（Resend/SendGrid）—— 不发邮件了。配了也无所谓不影响

**换域名时还要改的 env**（漏一个就 500）：
- Vercel `APP_URL` → 新域名（生成 invite link 时作为 `redirect_to` 传给 Supabase；
  受邀者点完链接后 Supabase 把他重定向回这里，必须跟 Supabase Redirect URLs 白名单匹配）
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

### 2.4 LLM + STT 配置

**LLM 推荐**（`/api/generate`）走 admin-editable chain：
- 默认 chain：`gemini-2.5-flash` → `kimi-k2.6` → `deepseek-chat` → `gemini-2.5-flash-lite`
- 上海场调整：admin 把 DeepSeek + Kimi 拖到顶，关 Gemini（详 §4.4）
- 完整逻辑：`server/src/routes/generate.ts` 顺序遍历，第一个 OK 就 break；失败按 overload/quota/fatal 分类，全失败 502 + trace

**STT**（`/api/stt`）走主备：
- **主：OpenAI Whisper-1** （2026-04-26 升主，Summit 嘈杂场地准确率 > Gemini Flash STT）
  - 启用条件：env 配了 `OPENAI_API_KEY`，没配自动 skip 直接走 Gemini
  - 收费 ~$0.006/min，Summit 4 站全程预估 < $1
- **备：Gemini Flash STT** —— Whisper 挂或没配 key 时兜底
- 前端 `MediaRecorder` 录 webm/opus，开了 `noiseSuppression / echoCancellation /
  autoGainControl` 三个浏览器内置音频处理（嘈杂场地免费收益）
- 东京场前务必验证：带 key / 不带 key 两条路径都要真跑过一次

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

**推完后的汇报检查清单（每次都必须回这 4 行）**：

```
✅ Commit:    <hash> <subject>
✅ 部署状态:  Ready / Building / Failed
✅ 主域名:    https://summit.aiverygen.ai
✅ 直链:      https://summit-<hash>-weihuxies-projects.vercel.app   ← 用 vercel inspect 拿
```

**少一行 = bug**。即使是 docs-only 改动也要给主域，让用户一键去验。
不要让用户问"部署了么 / URL 是啥" —— 提前给。

**用 Vercel CLI 验证部署状态**（不要靠等 / 猜）：

```bash
vercel ls --yes                                    # 看最新一次 deploy 是否 Ready
vercel inspect https://summit.aiverygen.ai         # 看 prod alias 当前指向哪个 commit
vercel --prod --yes                                # webhook 没触发时手动 deploy
```

**生产环境快速参考**：
- 主域名：**https://summit.aiverygen.ai** ← Summit demo 的对外 URL
- 老 alias：`https://ai-system-builder.vercel.app`（Vercel 自动 307 → 主域，保留兜底）
- Vercel Dashboard：https://vercel.com/dashboard → 项目名 `summit`（不是 ai-system-builder）
- GitHub repo：`weihuxie/ai-system-builder`，main 分支即生产
- 部署链路：`git push origin main` → Vercel webhook 自动 build → 1-2 min 后 Ready
- **GitHub→Vercel webhook 偶尔不触发**（实际遇到过）：push 后 vercel ls 没新行 → `vercel --prod --yes` 手动推

---

## 四、已知坑位（陆续补充）

### 4.1 Vite 4 + Tailwind 4 的 PostCSS 迁移
Tailwind 4 不再需要 `tailwind.config.ts` + `postcss.config.js` 配一套，改用 `@tailwindcss/vite` 插件 + `@import "tailwindcss";` 的 CSS 写法。详见 [tailwindcss.com/docs/v4-beta](https://tailwindcss.com/docs/v4-beta)。

### 4.2 Gemini `responseSchema` 对 object + additionalProperties 支持不完整
`rationale: Record<productId, string>` 的 schema 只能声明 type=OBJECT，具体键靠**后端宽松校验**，不能指望 Gemini 按 key 强约束。

### 4.3 Supabase Realtime 默认不订阅所有表
需要在 Supabase Dashboard → Database → Replication 手动开启 `products` 和 `global_config` 的 Realtime。遇到 "改了不同步" 第一个查这里。

### 4.4 上海场演示前必做

**网络 / AI 接入**：
- 演示前 admin 进 `/admin → AI 模型链`，把链拖成：
  ```
  1. deepseek    deepseek-chat       ✅ enabled  ← 国内可达
  2. kimi        kimi-k2.6           ✅ enabled  ← 国内可达
  3. gemini      gemini-2.5-flash    ❌ disabled ← 关掉防 30s timeout
  ```
- 这样改不需要部署，realtime 会同步到所有演示机
- 演示机手动 ping `summit.aiverygen.ai` + `api.deepseek.com` + `api.moonshot.cn` 都通

**STT / 语音**：
- 上海场嘈杂场地 + Whisper API 国内被墙 → **演示流程默认走键盘 + Quick
  Scenarios**（首页 8 张快速场景卡）。如果坚持要语音，需要走梯子或换国内 ASR
  （阿里云 / 腾讯云）—— v1 没接，后续话题
- 浏览器降噪已默认开启（noiseSuppression / echoCancellation / autoGainControl）

**前端访问**：
- 演示前在酒店 / 家里**先开过一次** `summit.aiverygen.ai`，让 SPA bundle 落
  本地缓存（offlineCache）。现场首屏即使 Vercel 抖也能加载
- 讲师**演示前在墙外环境登录好** Google OAuth（accounts.google.com 在国内
  墙了，session cookie 带过去就能继续用）

**操作纪律**：
- 操作 Config 前**先截图**：Supabase 改动实时，没后悔药
- 上台前 5 分钟把 admin 切到正确品牌、确认 AI 模型链顺序、验证 8 个快速场景
  能正常生成推荐

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

### 5.0 测试环境（`.env.test`）搭建

跑 server 集成测试 + Playwright e2e 之前必须有 `.env.test`。**绝对不能复用
prod SUPABASE_URL** —— `server/tests/helpers/setup.ts` 有硬 guard，URL 跟
`.env` 一样直接抛错（怕 truncate 把生产数据洗了）。

**步骤**：

1. **建独立 test Supabase 项目**：https://supabase.com/dashboard → New project，
   名字 `ai-system-builder-test`，Free 套餐够。等 1-2 min provisioning 完
2. **跑 schema SQL**：测试项目 → SQL Editor → New query → 整坨贴
   `scripts/test-setup.sql`（已含 0001+0002+0003+0004） → Run
3. **取 4 个值** 写 `.env.test`（从 `.env.test.example` 复制起手）：
   - `SUPABASE_URL` = Project Settings → API → Project URL
   - `SUPABASE_ANON_KEY` = API keys → `anon public`（legacy JWT 格式 `eyJ...` 或新 `sb_publishable_...` 都行）
   - `SUPABASE_SERVICE_KEY` = API keys → `service_role`（reveal）
   - `SUPABASE_JWT_SECRET` = **如果项目还在 legacy HS256**：JWT Settings → JWT Secret；
     **如果项目已迁移到 ECC P-256（新版 Supabase 默认）**：JWT_SECRET 用任意随机
     字符串即可（tests 自己签自己验 HS256，跟 Supabase 的 ECC 无关）
4. `.env.test` 已 gitignore，不会进 repo

**验证**：
```bash
npm --workspace server run test           # integration tests，~5 min
npm --workspace client run e2e            # Playwright e2e，~2 min
```

**Schema 漂移坑**：以后再加 migration（0005+）时，要同步：
- 写新 `supabase/migrations/000X_xxx.sql` 文件
- 把内容拼到 `scripts/test-setup.sql` 末尾（保持 IF NOT EXISTS 幂等）
- 让用户手动在 prod 和 test Supabase 各跑一次（dashboard SQL Editor）

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
