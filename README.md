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
# 填入 GEMINI_API_KEY, SUPABASE_*, ADMIN_PASSWORD_HASH, JWT_SECRET

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

## 当前实现进度

Phase 0 骨架完成。剩余 PR 见设计文档 §13 阶段 0 必做项。
