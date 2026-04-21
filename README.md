# AI System Builder

Google / AWS Summit 现场 demo。多站巡回（东京 / 香港 / 上海 / 新加坡），讲师在任一演示机改配置，全部演示机实时同步。

> **设计文档**：[`../ai-system-builder-design.md`](../ai-system-builder-design.md)（v4）
> **工程备忘 / 坑位记录**：[`CLAUDE.md`](CLAUDE.md)

---

## 结构

```
ai-system-builder/
├── shared/     # 前后端共享类型 + Zod schema + 默认数据
├── client/     # Vite + React 19 + Tailwind 4（前端）
├── server/     # Express + tsx（后端代理 / STT / Admin / Brand / Geo）
└── supabase/   # migration + seed SQL
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 填入 GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET,
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 3. 应用数据库 migration（用 Supabase SQL Editor 或 supabase CLI）
cat supabase/migrations/0001_init.sql

# 4. 本地开发（同时起前后端）
npm run dev
# → client: http://localhost:5173
# → server: http://localhost:8080
```

## 部署

- **前端**：`npm run build:client` → `client/dist/` 静态文件
- **后端**：`npm run build:server` → Cloud Run (asia-southeast1)
- **数据库**：Supabase (Singapore)

详见设计文档 §9。

## 测试

项目分两层测试：
- **server/tests/** — vitest + supertest，覆盖鉴权中间件 + 所有路由（products / admin / brand / llm）。直连独立的 Supabase 测试工程，每个用例前 truncate。
- **client/e2e/** — Playwright，端到端覆盖 anon、未授权、editor、super_admin 四种角色的登录 + 关键路径。用 Supabase admin SDK 注入 session，跳过真实 OAuth。

### 准备测试工程

1. Supabase Dashboard 新建一个 **独立** 的 free-tier 工程（**不要**用 prod！setup 会 truncate 表）。
2. 对这个工程执行 `supabase/migrations/0001_init.sql` 和 `0002_auth_and_ownership.sql`。
3. 复制模板：`cp .env.test.example .env.test`，填入测试工程的 URL / service key / JWT secret / anon key。

setup.ts 会在启动时比对 `.env` 和 `.env.test` 的 `SUPABASE_URL`，相同则 abort——防止误跑到 prod。

### 跑测试

```bash
# 首次运行 Playwright 需要安装 chromium
npm --workspace client run e2e:install

# server 单测（快）
npm test

# E2E（会自动启动 server + client dev server）
npm run e2e

# E2E headed 调试
npm --workspace client run e2e:headed
```

## 当前实现进度

Phase 0 骨架完成。剩余 PR 见设计文档 §13 阶段 0 必做项。
