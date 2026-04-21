# 多租户权限升级 · 实施 Plan

> 从单密码 JWT 升级到 Gmail OAuth + 产品所有权 + 角色分层。
>
> 背景：公司多条产品线，每条由不同人负责自己的配置；展会期间统一 dashboard 展示。

---

## TL;DR

- **10 个阶段，约 6 人日（纯开发）/ 8–10 自然日（含 review + 测试）**
- **3 个硬前置**：Google Cloud OAuth 凭证、super_admin 种子邮箱、老密码登录是否保留的决策
- **最大风险**：上海场讲师梯子必须能到 `accounts.google.com`，不是只能到 Gemini（见 CLAUDE.md §4.4）
- **7 个决策点**见 §14

---

## 1. 当前状态（已核对）

| 位置 | 现状 |
|---|---|
| 登录接口 | `POST /api/admin/login` bcrypt 比对 → `jwt.sign({role:'admin'})`（`server/src/routes/admin.ts`） |
| 被保护的写接口 | `PUT /api/brand`、`PUT /api/llm-chain`、`POST/PUT/DELETE /api/products` 共用 `requireAdmin`（`server/src/middleware/auth.ts`） |
| JWT payload | `{ role: 'admin', iat, exp }` — **没有用户身份** |
| Supabase server client | `SUPABASE_SERVICE_KEY`，绕过 RLS |
| Supabase browser client | anon key，只用于 Realtime |
| `products` 表 | 无 `owner_id` |
| RLS policies | `products`: anon 读 participating + service_role 全开；`global_config` 同 |
| 前端鉴权 | `AdminPage.tsx` 检查 `!!getToken()`（sessionStorage） |
| Realtime | 已订阅 `products` + `global_config` |
| shared 类型 | 无 `UserRole` / `AdminUser` / `ownerId` |
| Toast 方案 | **无**。只有 `ErrorBanner`，保存成功无反馈 |
| i18n | `translations.ts` 已有 `adminSaved` 字段但未使用 |

---

## 2. 目标架构

```
┌─────────────┐     OAuth     ┌──────────────┐
│  Browser    │───────────────▶  Supabase    │  (Google provider, no hd restriction)
│  /admin     │◀──── JWT ─────│  Auth        │
└──────┬──────┘               └──────────────┘
       │ Bearer <Supabase JWT>
       ▼
┌─────────────────────────────────────────────────┐
│ Express /api/*                                   │
│   requireUser     → 验证 JWT（本地 verify）      │
│   requireAdminUser → 查 admin_users 取 role      │
│   requireSuperAdmin → 要求 role='super_admin'     │
│   canEditProduct   → owner_id 或 super_admin 校验 │
└────┬─────────────────────────────────────────────┘
     │ service-key writes（仍然绕过 RLS）
     ▼
┌─────────────────────────────────────────────────┐
│ Postgres                                         │
│   admin_users（email pk, user_id fk, role）      │
│   products + owner_id → auth.users.id            │
│   RLS（authenticated）作为 defense-in-depth       │
└─────────────────────────────────────────────────┘
```

**已锁定的设计决策**（来自用户确认）：

1. Supabase Auth 的 Google provider，不限 hosted domain（任何 gmail 都能发起登录，白名单 `admin_users` 控制授权）
2. 写仍走 Express + service key（保留 CLAUDE.md §2.3 的数据校验漏斗）
3. 授权在 Express 层做（editor vs super_admin、owner 校验）
4. RLS 升级为"防御性"层，不是首要执行点
5. 不做审批流；editor 保存即 Realtime 生效
6. 一键复制产品 / 保存成功 toast "已上线" / editor 看不到 Brand+LLM 面板

---

## 3. 数据库迁移（`supabase/migrations/0002_auth_and_ownership.sql`）

按顺序执行（每块独立，`if not exists` 保护）。

### 3.1 新建 `admin_users`

```sql
create table if not exists public.admin_users (
  email       text primary key,
  user_id     uuid references auth.users(id) on delete set null,
  role        text not null check (role in ('editor', 'super_admin')),
  invited_at  timestamptz not null default now(),
  activated_at timestamptz,
  invited_by  uuid references auth.users(id) on delete set null
);

create index if not exists admin_users_user_id_idx on public.admin_users(user_id);
```

### 3.2 首次登录自动关联 user_id 的 trigger

```sql
create or replace function public.activate_admin_on_signup()
returns trigger language plpgsql security definer as $$
begin
  update public.admin_users
    set user_id = new.id,
        activated_at = now()
    where email = new.email
      and user_id is null;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.activate_admin_on_signup();
```

> ⚠️ `auth.users` 上的 trigger 必须 `security definer`。先在 staging 测一遍，出错新登录会 500。备选：去掉 trigger，在 Express 中间件里每次按 email 查（慢一点但稳）。

### 3.3 `products` 加 `owner_id`

```sql
alter table public.products
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists products_owner_id_idx on public.products(owner_id);
```

### 3.4 老数据处理（见 §9.1 决策）

默认**选项 A**：`owner_id=null` = "孤儿池"，只 super_admin 可见可改，editor 看不到。后续 super_admin 按需在 UI 里分配。

### 3.5 RLS policies（新加 authenticated 角色策略）

service_role 原有策略保留。新增：

```sql
-- products: authenticated read 全部（但 editor 只在 UI 层过滤 owner_id 自己的）
drop policy if exists "products: authenticated read" on public.products;
create policy "products: authenticated read"
  on public.products for select
  to authenticated
  using (
    exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
    or owner_id = auth.uid()
    or is_participating = true
  );

-- products: insert / update / delete — owner 或 super_admin
create policy "products: authenticated insert"
  on public.products for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

create policy "products: authenticated update"
  on public.products for update
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  )
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

create policy "products: authenticated delete"
  on public.products for delete
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

-- global_config: 只有 super_admin 能 update
create policy "global_config: authenticated super_admin write"
  on public.global_config for update
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin'));

-- admin_users: 启用 RLS
alter table public.admin_users enable row level security;

create policy "admin_users: self read"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

create policy "admin_users: super_admin all"
  on public.admin_users for all
  to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'super_admin'))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'super_admin'));

create policy "admin_users: service_role all"
  on public.admin_users for all
  to service_role
  using (true) with check (true);
```

### 3.6 Realtime

```sql
alter publication supabase_realtime add table public.admin_users;
```

---

## 4. Supabase Dashboard 配置（手工 checklist）

1. **Authentication → Providers → Google**：打开，粘贴 Google Cloud OAuth `client_id` + `client_secret`，"Authorized domains" **留空**（spec 要求：任何 gmail 都能尝试，白名单控制授权）
2. **Authentication → URL Configuration**：
   - Site URL: `https://<生产域名>`（无末尾斜杠）
   - Additional Redirect URLs：
     - `http://localhost:5173/admin`
     - `http://localhost:5173/admin/callback`
     - `https://<生产域名>/admin`
     - `https://<生产域名>/admin/callback`
     - 预览域名用通配符：`https://*-<team>.vercel.app/admin`
3. **Google Cloud Console → Credentials**：Authorized redirect URIs 必须包含 `https://<project-ref>.supabase.co/auth/v1/callback`（Google 只会回调到 Supabase，Supabase 再转到 Site URL）
4. **SQL Editor**：种第一个 super_admin：
   ```sql
   insert into public.admin_users (email, role)
   values ('<你的邮箱>', 'super_admin')
   on conflict (email) do update set role = 'super_admin';
   ```
5. **Database → Replication**：确认 `admin_users` 在 `supabase_realtime` 里

---

## 5. `shared/` 改动

### `shared/src/types.ts`

```ts
export type UserRole = 'editor' | 'super_admin';
export const ALL_USER_ROLES: readonly UserRole[] = ['editor', 'super_admin'] as const;

export interface AdminUser {
  email: string;
  userId: string | null;
  role: UserRole;
  invitedAt: string;
  activatedAt: string | null;
  invitedBy: string | null;
}

export interface AuthedUser {
  id: string;
  email: string;
  role: UserRole;
}

// ProductItem 加字段
export interface ProductItem {
  id: string;
  // ...原有字段...
  ownerId: string | null;
}

export interface InviteUserRequest { email: string; role: UserRole; }
```

### `shared/src/schemas.ts`

```ts
export const UserRoleSchema = z.enum(['editor', 'super_admin']);

export const AdminUserSchema = z.object({
  email: z.string().email().max(254),
  userId: z.string().uuid().nullable(),
  role: UserRoleSchema,
  invitedAt: z.string(),
  activatedAt: z.string().nullable(),
  invitedBy: z.string().uuid().nullable(),
});

export const InviteUserRequestSchema = z.object({
  email: z.string().email().max(254),
  role: UserRoleSchema,
});

// ProductItemSchema 加 ownerId
export const ProductItemSchema = z.object({
  // ...原有...
  ownerId: z.string().uuid().nullable(),
});
```

**废弃**（保留一版 release 后删）：`AdminLoginRequest`、`AdminLoginResponse`、`AdminLoginRequestSchema`

---

## 6. 后端改动

### 6.1 `server/src/middleware/auth.ts` 重写

三层中间件：

```ts
// 1. 验证 Supabase JWT，挂 req.user = { id, email }
export const requireUser: RequestHandler

// 2. requireUser + 查 admin_users 拿 role，挂 req.user.role
export const requireAdminUser: RequestHandler

// 3. 要求 role === 'super_admin'
export const requireSuperAdmin: RequestHandler

// 非中间件的 helper
export async function canEditProduct(user: AuthedUser, productId: string): Promise<boolean>
```

**JWT 验证策略选 B（本地 verify）**：

| 选项 | 优点 | 缺点 |
|---|---|---|
| A. `supabase.auth.getUser(token)` | role / 撤销实时 | 每请求一次网络跳 |
| **B. 本地 `jwt.verify(token, SUPABASE_JWT_SECRET)`** ✅ | 无网络跳 | Token 过期前（1h）仍然有效 |

选 B + 对 `admin_users` 每请求做一次 DB lookup（role 和是否被踢出是新鲜的，只有身份验证是本地的）。

**新增环境变量**：
```
SUPABASE_JWT_SECRET=    # Supabase Dashboard → Settings → API → JWT Secret
```

**删除**：`ADMIN_PASSWORD_HASH`、`JWT_SECRET`（见 §9.2 决策）

### 6.2 `server/src/routes/admin.ts` 重写

- **删除** `POST /admin/login`
- **新增** `GET /admin/me` → 返回当前 `AuthedUser | { code: 'FORBIDDEN' }`
- **新增** `GET /admin/users`（super_admin）→ 白名单列表含激活状态
- **新增** `POST /admin/users`（super_admin）→ `{ email, role }` upsert
- **新增** `DELETE /admin/users/:email`（super_admin）→ 仅从白名单删，不 drop auth.users

### 6.3 `server/src/routes/products.ts` 改

- `GET /products`（匿名）：**注意**当前实现用 service key 返回全部，会泄漏 `is_participating=false` 的产品给未登录用户。**本次不修**，但记一笔 follow-up（见 §15）。
- `POST /products`：`requireAdmin` → `requireAdminUser`。editor 强制 `ownerId = req.user.id`；super_admin 允许传显式 `ownerId`
- `PUT /products/:id`：`requireAdmin` → `requireAdminUser` + `canEditProduct`。editor 改别人的产品返回 403 `OWNERSHIP_REQUIRED`
- `DELETE /products/:id`：同上
- **新增** `POST /products/:id/clone`：
  1. 读原产品（service key）
  2. 计算新 id：`{原id}-copy` → 冲突则 `-copy-2`..`-copy-10`，都冲突返回 409
  3. `name.zh-CN` 等加 "（副本）"后缀（i18n 抽到 `shared/src/i18n.ts` 的 suffix 字典）
  4. `isParticipating = false`、`ownerId = req.user.id`
  5. 插入后返回新行

### 6.4 `server/src/routes/brand.ts` + `llm.ts`

`requireAdmin` → `requireSuperAdmin`。editor 在 UI 层看不到，这里是 defense-in-depth。

### 6.5 新增错误码

`shared/src/types.ts` 的 `ApiErrorCode`：
```ts
| 'NOT_WHITELISTED'    // 合法 Google 登录，但不在白名单
| 'OWNERSHIP_REQUIRED' // editor 试图改别人的产品
```

---

## 7. 前端改动

### 7.1 `client/src/lib/supabase.ts`

```ts
// 当前：{ auth: { persistSession: false } }
// 改成：
{ auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
```

### 7.2 新增 `client/src/lib/auth.ts`

```ts
export async function signInWithGoogle(): Promise<void>
export async function signOut(): Promise<void>
export function useSession(): { session: Session | null; loading: boolean }
export function useMe(): { user: AuthedUser | null; isSuperAdmin: boolean; loading: boolean }
```

在根（`main.tsx` 或新建 `AuthProvider`）订阅一次：
```ts
supabase.auth.onAuthStateChange((event, session) => {
  // 推到 zustand store
});
```

### 7.3 `client/src/lib/api.ts` 改写

去掉 `getToken()` / `setToken()` / sessionStorage，改成：
```ts
async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
```
`apiFetch` 改成 async 获取 token 后附 `Authorization: Bearer <token>`。

### 7.4 `client/src/lib/queries.ts`

- **删除** `useAdminLoginMutation`
- **新增** `useMeQuery`、`useAdminUsersQuery`、`useInviteUserMutation`、`useRemoveUserMutation`、`useCloneProductMutation`
- `useUpsertProductMutation` / `useDeleteProductMutation` 签名不变，但 `OWNERSHIP_REQUIRED` 错误要走 ErrorBanner 翻译

### 7.5 `AdminPage.tsx` 重构

```tsx
{session === null ? <GoogleLoginButton/>
 : me.loading ? <Spinner/>
 : me.user === null ? <NotWhitelisted/>
 : <>
    {me.isSuperAdmin && <BrandSwitch/>}
    {me.isSuperAdmin && <LlmChainConfig/>}
    {me.isSuperAdmin && <AdminUsersPanel/>}
    <ProductList role={me.user.role} userId={me.user.id}/>
   </>}
```

### 7.6 新增组件

- `GoogleLoginButton.tsx` — 单按钮，`supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/admin' } })`
- `AdminUsersPanel.tsx` — 邀请表单 + 白名单列表 + 激活状态 + 删除。仅 super_admin 渲染
- `NotWhitelisted.tsx` — "此邮箱未获授权，请联系管理员" + 登出按钮

### 7.7 `ProductList.tsx` 改

- 接受 `{ role, userId }` 参数
- editor：客户端过滤 `ownerId === userId`
- super_admin：加 "我的 / 全部" tab 切换；每行显示 owner email（后端 `/products` 响应里 left join `admin_users.email`）
- 新增 **Clone** 按钮（Edit 和 Delete 中间）

### 7.8 Toast 方案

推荐 **`sonner`**（~3kb，shadcn 风格，无额外配置）：
- `main.tsx` 挂 `<Toaster />`
- `useUpsertProductMutation.onSuccess` → `toast.success(ui.adminSavedLive)` （新 key "已上线"）
- 保留 `ErrorBanner` 做 inline 错误；`toast.error` 做一闪而过的错误

### 7.9 新增 i18n keys

`translations.ts`：
- `adminSignInWithGoogle`、`adminNotWhitelisted`
- `adminCloneProduct`、`adminCopySuffix`（各语言的 "（副本）"）
- `adminProductOwner`、`adminViewMine`、`adminViewAll`
- `adminInviteTitle`、`adminInviteEmailLabel`、`adminInviteRoleLabel`、`adminInviteButton`
- `adminUserActivated`、`adminUserPending`
- `adminSavedLive`（"已上线" toast 文案）
- `adminRoleSuperAdmin`、`adminRoleEditor`
- `errorNotWhitelisted`、`errorOwnershipRequired`

---

## 8. 路由

`main.tsx` 现有 `/admin` → `AdminPage`。OAuth 回调会带 `#access_token=...`，Supabase `detectSessionInUrl: true` 自动消费。**无需新路由**，但可选加 `/admin/callback` 做过渡跳转以保持 URL 整洁。

---

## 9. 迁移 / 灰度 / 决策

### 9.1 现有产品 `owner_id = NULL` 的处理

| 选项 | 行为 | 工作量 | 风险 |
|---|---|---|---|
| **A. 孤儿池** ✅ | NULL = editor 不可见，super_admin 可见可改 | 0 | editor 初期只能用 clone |
| B. 批量指定给首个 super_admin | `update products set owner_id='<uuid>' where owner_id is null` | 5 分钟 | 可能需要后续重分配 |
| C. NULL 任何 editor 可改 | 额外 RLS 条件 `or owner_id is null` | 1 小时 | 违反 spec |

**推荐 A**。super_admin 在 ProductList 的 "全部" tab 里点"编辑"改 owner，把 CRM 移交给具体产品线负责人。

### 9.2 老密码登录：删还是留 fallback？

| 选项 | 优点 | 缺点 |
|---|---|---|
| **A. 删掉** ✅ | 干净，强制走 OAuth | 断网时没 breakglass（可用 SQL seed 救） |
| B. 保留 super_admin 专用 fallback 密码 | 网络故障时救场 | 代码有味道，需轮换 |
| C. 仅 dev 环境保留 | 本地方便 | 有人忘开/关 |

**推荐 A**。breakglass 路径 = 直接 SQL 种种新 super_admin 邮箱。

⚠️ **上海场风险**：讲师梯子必须能到 `accounts.google.com`，不是只到 Gemini。现场前测试。

### 9.3 剩余决策见 §14

---

## 10. 测试清单（上生产前必过）

**主流程**
- [ ] 匿名用户访 `/` — 能生成，无 session
- [ ] 匿名用户访 `/admin` — 只见 Google 登录按钮
- [ ] editor 登录 — 只见自己的产品 + 不见 Brand/LLM/Users
- [ ] super_admin 登录 — 看到全部
- [ ] super_admin 邀请 alice → alice 登录 → trigger 把 user_id 填进 admin_users → alice 刷新看到 editor UI

**Owner 隔离**
- [ ] editor A 创建产品 FOO — `owner_id` 自动 = A
- [ ] editor B 登录 — ProductList 不见 FOO
- [ ] editor B `curl PUT /api/products/FOO` — 返回 403 `OWNERSHIP_REQUIRED`
- [ ] super_admin 切 "全部" → 见 FOO + owner email → 改 owner 给 B → B 刷新后可见

**Clone**
- [ ] editor clone CRM → `CRM-copy`、`owner_id` = 当前 editor、`isParticipating = false`、`name.zh-CN` 带"（副本）"
- [ ] 再 clone CRM → `CRM-copy-2`
- [ ] clone 11 次 → 409
- [ ] editor clone 别人的产品（super_admin 的 CRM）— **应该成功**（新 owner 是自己）

**Super_admin 面板**
- [ ] 邀请格式错误 email — 400
- [ ] 邀请已存在 email 改 role — upsert
- [ ] 删白名单 → 被删用户下次 API 403（admin_users lookup 每请求新鲜）
- [ ] 删自己 → UI 下次请求后自动登出

**Realtime**
- [ ] alice 改产品 → bob 的 `/` 视图 Realtime 更新
- [ ] super_admin 切 brand → 4 城演示机同步切

**RLS 绕过尝试**
- [ ] 前端 devtools 直接 `supabase.from('products').update(...)` 改别人的产品 — RLS 阻止
- [ ] 伪造 JWT（错误 secret）— `requireUser` 拒绝

**Breakglass**
- [ ] `SUPABASE_JWT_SECRET` 错 — 所有 admin 500 + 明确错误
- [ ] Supabase 挂了 — `/admin/me` 500，UI 显示错误，数据不损坏

---

## 11. 工作量 + 排期

| # | 阶段 | 人日 | 依赖 |
|---|---|---|---|
| 1 | DB migration + Dashboard 配置 | 0.5 | — |
| 2 | `shared/` 类型 + schema | 0.3 | 可与 1 并行 |
| 3 | 后端 auth middleware | 0.75 | — |
| 4 | 后端 route refactor (products + admin + brand + llm) | 1.0 | 3 |
| 5 | 后端 clone endpoint | 0.5 | 4 |
| 6 | 前端 Supabase OAuth 接入 | 0.5 | 2 |
| 7 | 前端 AdminPage 按 role 渲染 | 0.5 | 6, 4 |
| 8 | 前端 AdminUsersPanel | 0.5 | 7 |
| 9 | 前端 Clone 按钮 + toast | 0.5 | 7 |
| 10 | 全面测试 + bug 修 | 1.0 | — |
| **合计** | | **6.0 人日** | |
| **自然日**（含 review + 一轮 bug） | | **8–10 天** | |

**关键路径**：1 → 3 → 4 → 7 → 10 ≈ 4 天最短。

**建议排期**：

- **D1 上午**：用户完成 §12 前置（Google Cloud OAuth、种 super_admin、apply migration 到 staging）
- **D1 下午**：阶段 1 + 2 + 开始 3
- **D2**：阶段 3 + 4
- **D3**：阶段 5 + 6
- **D4**：阶段 7 + 8 + 9
- **D5–6**：阶段 10，Vercel preview 全面测
- **D7**：生产部署（Vercel 蓝绿，保留 48h 回滚）

---

## 12. 前置准备（用户需要先做的事）

| 事项 | 在哪做 | 阻塞哪个阶段 |
|---|---|---|
| Google Cloud OAuth 2.0 Client ID | console.cloud.google.com → APIs & Services → Credentials。类型 Web。Redirect URI: `https://<project>.supabase.co/auth/v1/callback` | §4 Dashboard 配置 |
| Supabase Google provider 启用 | Supabase Dashboard → Authentication → Providers。粘贴 ↑ 凭证 | §4 |
| super_admin 种子邮箱列表 | 列清楚即可，§4 的 SQL 里用 | §4 |
| §9.2 决策（老密码删 / 留） | — | 阶段 4 |
| §9.1 决策（NULL owner 处理） | — | 阶段 1（migration） |
| Vercel 环境变量更新 | Dashboard 或 `vercel env add`。**加** `SUPABASE_JWT_SECRET`，**删** `ADMIN_PASSWORD_HASH` + `JWT_SECRET` | 部署 |

---

## 13. 踩坑提示

1. **Supabase JWT 默认 1h 过期**，refresh token 1 周。讲师开 `/admin` 4 小时再点保存 → `autoRefreshToken` 应处理，但要测，尤其上海场。
2. **Realtime 不受影响** — 当前 anon Realtime 用 `select to anon` 策略，本次不动。
3. **Vercel preview 通配符重定向**：2024 起 Supabase 支持 `https://*-<team>.vercel.app/admin`，否则每个 preview 都要手工加白名单。
4. **Service role 绕过 RLS 是按角色的**。Express 用 service key 不管有没有新 policy 都能工作，新加的 authenticated policies 纯粹是防御层。
5. **`auth.users` trigger 踩坑**：trigger 报错会让所有新 Google 登录静默 500。staging 先测，函数体保持极简。
6. **上海场梯子**：必须覆盖 `accounts.google.com`，不只是 Gemini。
7. **`GET /api/products` 预先存在的漏洞**：匿名用户能看到 `is_participating=false` 的产品（服务端用 service key 没过滤）。**本次不修**，开 follow-up task。
8. **"（副本）"后缀嵌套**：clone 再 clone 会变 "xxx（副本）（副本）"。推荐 clone 时先 strip 已有后缀再 append。
9. **`ProductItemInputSchema` 要防 owner 伪造**：editor 建产品时服务端必须强制 `owner_id = req.user.id`，不管客户端传什么。super_admin 才能显式指定。
10. **中间件顺序**：`requireUser` → `requireAdminUser`（查 DB）→ `requireSuperAdmin`（读 attached role）。别让裸 JWT 绕过 DB lookup。

---

## 14. 决策点汇总（等用户确认）

| # | 决策 | 推荐默认 |
|---|---|---|
| D1 | JWT 验证：Supabase API 调 vs 本地 verify | 本地 verify + admin_users 每请求查 |
| D2 | 老产品 NULL owner 怎么办 | 选项 A：孤儿池 |
| D3 | 老密码登录 | 删掉 |
| D4 | `on_auth_user_created` trigger vs 运行时查 email | trigger |
| D5 | Toast 库 | sonner |
| D6 | Clone 后缀重复处理 | strip 原后缀再 append |
| D7 | `/products` 响应里 denormalize owner email | 是（left join admin_users） |

---

## 15. 本次不做但值得 follow-up

- **修 `GET /api/products` 的匿名泄漏**：当前 service key 无过滤返回全部，应改成只返回 `is_participating=true`
- **admin 路由加 rate limit**：已有 `express-rate-limit`，对 `/admin/users` 加每用户限流防刷
- **Audit log**：当前 schema 里 `updated_by` 写死 `'admin'`，这次身份真实了，应该记 `req.user.id`

---

## 关键文件清单（实施参考）

- `server/src/middleware/auth.ts` — **重写**
- `server/src/routes/admin.ts` — **重写**
- `server/src/routes/products.ts` — 加 ownership + clone
- `server/src/routes/brand.ts`、`server/src/routes/llm.ts` — 改 middleware
- `shared/src/types.ts` — 加 `UserRole`、`AdminUser`、`AuthedUser`、`ProductItem.ownerId`
- `shared/src/schemas.ts` — 加对应 schema
- `shared/src/i18n.ts`（新建）— Clone 后缀字典
- `client/src/lib/supabase.ts` — auth 配置
- `client/src/lib/auth.ts`（新建）— session/user hooks
- `client/src/lib/api.ts` — token 改从 Supabase 拿
- `client/src/lib/queries.ts` — 加 me / users / clone，删 login
- `client/src/pages/AdminPage.tsx` — 按 role 渲染
- `client/src/components/admin/GoogleLoginButton.tsx`（新建）
- `client/src/components/admin/AdminUsersPanel.tsx`（新建）
- `client/src/components/admin/NotWhitelisted.tsx`（新建）
- `client/src/components/admin/ProductList.tsx` — 过滤 + clone 按钮 + owner 列
- `client/src/lib/translations.ts` — 新增 keys
- `client/src/main.tsx` — 挂 `<Toaster />`
- `supabase/migrations/0002_auth_and_ownership.sql`（新建）— §3 全部
