# ZokoMart Admin 前端 —— 分阶段落地实施计划

> **For agentic workers:** 可配合 superpowers:subagent-driven-development 或 superpowers:executing-plans
> 按任务逐条执行。所有步骤用 `- [ ]` 复选框跟踪。

**Goal:** 基于 Vben Admin 5.x 的设计与核心能力，搭建一个**精简单应用**（单个 Vite 工程，放在 `frontend/`），对接已完成的 ZokoMart Admin 后端，落地进销存全链路后台（RBAC → 基础数据 → 供应商产品 → 采购链 → 库存 → 销售/物流）。

**Architecture:** Vue3 单页应用，Vue Router（静态壳路由 + 由后端菜单树动态生成业务路由）+ Pinia（鉴权/用户态）+ Axios（统一响应拦截，识别 `code===0`）。按钮级权限用 `v-perm` 指令 + `usePermission`。UI 用 Ant Design Vue，业务列表/表单沉淀为通用组件（`BasicTable` / `SchemaForm` / `CascadeFilter`）。鉴权用后端 Sa-Token：登录拿 token，请求头 `Authorization` 携带**原始 token**（无 `Bearer` 前缀）。

**Tech Stack:** Vue 3.5 · Vite 5 · TypeScript 5 · Pinia 2 · Vue Router 4 · Axios · Ant Design Vue 4 · UnoCSS · Day.js · Vitest（单元/组件）· Playwright（E2E）· ESLint + Prettier · pnpm。

---

## 如何使用本计划

- **阶段(Phase) = 可独立验收的里程碑**。每个阶段末尾有「阶段验收」，通过后再进入下一阶段。阶段顺序与后端能力一致（后端 Phase 0-8 已全部完成并推送，接口可直接联调）。
- **测试策略**：
  - **Vitest** 覆盖纯逻辑：`request` 拦截器、`token` 工具、`auth` store、`buildRoutes` 菜单转路由、`usePermission`、以及关键页面组件的渲染/交互（用 `@vue/test-utils` + 对 `api` 做 mock）。
  - **Playwright** 覆盖关键业务全链 E2E（登录、采购全链、销售+物流全链、权限边界）。E2E 跑在真实后端（本地 MySQL+Redis 起后端）之上。
  - **样板 CRUD 页**不强求逐页 E2E：给品牌模块一个完整的「页面 + 组件测试 + 一条 E2E」模板，其余同构模块**照此复制**，仅在计划里列出差异点。
- **每个任务结束即 commit**；commit message 用 `feat:/test:/chore:/docs:` 前缀。前端仓库：`https://github.com/txdyc/front.admin.zokomart.africa.git`，主分支 `main`。
- 路径若省略 `frontend/` 前缀会显式说明；源码根为 `frontend/src/`。
- **不要把后端字段名猜错**：本计划「接口契约速查」一节列出的是后端**实际**返回结构（已对照后端 VO/控制器核对），前端 TS 类型与之一一对应。

---

## 接口契约速查（与后端实际实现对齐，务必遵守）

### 统一响应包装

```jsonc
// 成功
{ "code": 0, "msg": "success", "data": <T> }
// 失败（HTTP 仍为 200，业务码非 0）
{ "code": 403, "msg": "forbidden", "data": null }
```

- **成功判据：`code === 0`**（不是 200）。其余均按业务错误处理，用 `msg` 提示。
- 常见错误码：`400` 参数校验失败、`401` 未登录/登录失效、`403` 无权限、`404` 不存在、`500` 系统异常；业务细分码：`40001` 库存不足、`40002` 低于最小采购量、`40003` 非法状态流转。
- 分页结构：`data` 为 `{ records: T[], total, current, size }`。分页查询入参统一 `current`（页码，从 1）、`size`（每页），其余为各接口的筛选字段。

### 鉴权

- 登录：`POST /api/auth/login`，body `{ "username", "password" }` → `data: { token, user }`。
- 登出：`POST /api/auth/logout`（需登录）。
- 当前用户：`GET /api/auth/user-info` → `data` = `LoginUserVO`。
- **请求头**：`Authorization: <token>`（**原始 token，无 Bearer 前缀**；header 名固定 `Authorization`，token 风格为 uuid）。
- 默认超管账号：`superadmin / Admin@123`（后端启动幂等种入）。

`LoginUserVO`（`/login` 的 `user` 与 `/user-info` 同构）：

```ts
interface LoginUserVO {
  id: number;
  username: string;
  nickname: string | null;
  isSuper: number;           // 1 = 超级管理员（前端按钮权限对其全放行）
  roles: string[];           // 角色码，如 ["BUYER"]；超管为 ["*"]
  permissions: string[];     // 权限码，如 ["purchase:plan:create", ...]；超管为 ["*"]
  menus: MenuVO[];           // 已按 parentId 组装好的菜单树
}
```

`MenuVO`（菜单树节点，用于动态路由与侧边栏）：

```ts
interface MenuVO {
  id: number;
  parentId: number;          // 0 为根
  name: string;              // 显示名 / 路由名来源
  type: number;              // 1 目录 / 2 菜单(页面) / 3 按钮(仅权限，不生成路由)
  permCode: string | null;   // 按钮级权限码（type=3 才有意义）
  routePath: string | null;  // 前端路由，如 "/system/user"
  component: string | null;  // 组件路径，如 "system/user/index" → src/views/system/user/index.vue
  icon: string | null;       // 形如 "ant-design:setting-outlined"
  sort: number;
  visible: number;           // 0 隐藏 / 1 显示
  status: number;            // 0 停用 / 1 启用
  children: MenuVO[];
}
```

> 后端 V7 已种入完整菜单树（目录/菜单/按钮）与 5 个角色模板（`BUYER/APPROVER/WAREHOUSE/SALES/LOGISTICS`）。前端**不写死菜单**，一律由 `user-info` 的 `menus` 生成。

### 业务接口一览（前缀 `/api`，权限码即后端 `@SaCheckPermission`）

| 模块 | 方法 / 路径 | 说明 | 权限码 |
|------|------------|------|--------|
| 认证 | POST /auth/login · POST /auth/logout · GET /auth/user-info | 登录/登出/用户信息 | 免登 / 登录 |
| 用户 | GET·POST /system/users，GET·PUT·DELETE /system/users/{id} | 用户 CRUD | `system:user:list\|create\|update\|delete` |
| 用户 | PUT /system/users/{id}/roles · 重置密码接口 | 赋角色 / 重置密码 | `system:user:update` / `system:user:resetPwd` |
| 角色 | GET·POST /system/roles，GET·PUT·DELETE /system/roles/{id} | 角色 CRUD（含 `menuIds`） | `system:role:list\|create\|update\|delete` |
| 菜单 | GET /system/menus/tree，POST /system/menus，PUT·DELETE /system/menus/{id} | 菜单树读取 + 增删改（无平铺 list，读取走 `/tree`） | `system:menu:list\|create\|update\|delete` |
| 品牌 | GET·POST /brands，PUT·DELETE /brands/{id} | CRUD | `brand:list\|create\|update\|delete` |
| 供应商 | GET·POST /suppliers，PUT·DELETE /suppliers/{id} | CRUD | `supplier:list\|create\|update\|delete` |
| 供应商 | GET /suppliers/{id}/brands · GET /suppliers/{id}/categories | 联动筛选（该供应商有产品的品牌/分类） | `supplierProduct:list` |
| 分类 | GET·POST /categories，PUT·DELETE /categories/{id}，GET /categories/tree | 树形 CRUD | `category:list\|create\|update\|delete` |
| 物流商 | GET·POST /logistics-providers，PUT·DELETE /logistics-providers/{id} | CRUD | `logisticsProvider:list\|create\|update\|delete` |
| 平台 SPU | GET·POST /product-spus，PUT·DELETE /product-spus/{id} | CRUD | `product:spu:list\|create\|update\|delete` |
| 平台 SKU | GET·POST /product-skus，PUT·DELETE /product-skus/{id}，GET /product-spus/{id}/skus | CRUD + 按 SPU 查 SKU | `product:sku:*` / `product:spu:list` |
| 供应商产品 | GET·POST /supplier-products，PUT·DELETE /supplier-products/{id} | CRUD（筛选 `supplierId/brandId/categoryId/keyword/status`） | `supplierProduct:list\|create\|update\|delete` |
| 采购计划 | GET·POST /purchase-plans，PUT·DELETE /purchase-plans/{id} | CRUD（草稿含明细） | `purchase:plan:list\|create\|update\|delete` |
| 采购计划 | POST /purchase-plans/{id}/submit · /approve · /reject | 提交/通过/退回 | `purchase:plan:submit` / `purchase:plan:approve` |
| 采购订单 | GET /purchase-orders（筛选 `planId/supplierId/status`），GET /purchase-orders/{id} | 列表/详情 | `purchase:order:list` |
| 采购订单 | PUT /purchase-orders/{id}/items/payment · POST /purchase-orders/{id}/confirm | 明细付款 / 生成实际采购单 | `purchase:order:pay` / `purchase:order:confirm` |
| 实际采购单 | GET /actual-purchase-orders[/{id}] · POST /actual-purchase-orders/{id}/inbound | 列表/详情 / 入库 | `purchase:order:list` / `inventory:inbound` |
| 库存 | GET /inventory/stocks（筛选 `supplierId/brandId/categoryId/keyword`） | 库存列表 | `inventory:list` |
| 库存 | PUT /inventory/stocks/{supplierProductId} | 手工调整到目标数量（带 `remark`） | `inventory:edit` |
| 销售 | POST /sales-orders · GET /sales-orders（筛选 `completed`）· GET /sales-orders/{id} | 下单/列表/详情 | `sales:order:create\|list` |
| 物流 | POST /sales-orders/{id}/dispatch · PUT /sales-orders/{id}/status · PUT /sales-orders/{id}/items/reject · POST /sales-orders/{id}/complete | 派送/状态/拒收/完成 | `logistics:dispatch\|status\|reject\|complete` |

> 销售列表「本人范围」由后端按是否含 `sales:order:list:all` 自动决定：无该权限者只返回本人订单。前端无需特殊处理，仅在有该权限时可展示「全部/本人」切换（可选）。

### 关键请求体片段（以后端测试为准）

```jsonc
// 创建供应商产品
{ "supplierId":1, "name":"...", "brandId":2, "categoryId":3, "productCode":"P001",
  "wholesalePrice":100, "retailPrice":200, "minPurchaseQty":1, "imageUrl":"", "skuId":null, "status":1 }
// 创建采购计划（草稿 + 明细）
{ "remark":"", "items":[ { "supplierProductId":10, "purchaseQty":5 } ] }
// 采购订单明细付款
{ "itemIds":[100,101], "paymentStatus":"PAID" }   // UNSET|PAID|UNPAID
// 库存手工调整（调到目标数量）
{ "quantity":12, "remark":"建账" }
// 创建销售订单（下单即扣库存）
{ "customerName":"Kofi", "customerPhone":"024...", "customerAddress":"Accra",
  "items":[ { "supplierProductId":10, "qty":3, "unitPrice":200 } ] }  // unitPrice 可省略，默认零售价
// 派送
{ "logisticsProviderId":1, "deliveryFee":15 }
// 更新销售订单状态
{ "status":"SIGNED" }   // DISPATCHING|SIGNED|SIGNED_PAID|UNREACHABLE|REJECTED
// 拒收
{ "itemId":500, "rejectQty":1 }
// 赋角色
{ "roleIds":[901] }
```

### 状态枚举（用于前端标签/按钮可用性，详见 PRD 附录 A）

- 采购计划：`DRAFT 草稿 / PENDING 待审批 / APPROVED 已通过 / REJECTED 已退回`（仅 `DRAFT/REJECTED` 可编辑、删除、提交）。
- 采购订单：`PENDING_PAYMENT / CONFIRMED`；明细付款 `UNSET / PAID / UNPAID`。
- 实际采购单：`PENDING_INBOUND / INBOUND_DONE`；明细入库 `PENDING / DONE`。
- 销售订单：`PENDING_DISPATCH → DISPATCHING → {SIGNED, SIGNED_PAID, UNREACHABLE, REJECTED}`；`completed` 0/1。拒收仅在 `SIGNED/SIGNED_PAID`；完成可从 `SIGNED/SIGNED_PAID`，`UNREACHABLE` 不可直接完成。

---

## 文件结构总览（落地后）

```
frontend/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts            # 别名 @ / dev proxy /api → :8080 / Vitest 配置
├── tsconfig.json
├── uno.config.ts             # UnoCSS（原子化样式）
├── playwright.config.ts
├── .env.development          # VITE_API_BASE=/api
├── .env.production           # VITE_API_BASE=https://admin.zokomart.africa/api（占位）
├── .eslintrc.cjs / .prettierrc / .gitignore
├── src/
│   ├── main.ts               # 装配 app：Pinia/Router/Antd/指令/样式
│   ├── App.vue
│   ├── utils/
│   │   ├── request.ts        # axios 实例 + 拦截器（核心）
│   │   └── token.ts          # token 读写（localStorage）
│   ├── api/
│   │   ├── auth.ts
│   │   ├── system/{user,role,menu}.ts
│   │   ├── basedata/{brand,supplier,category,logisticsProvider}.ts
│   │   ├── product/{spu,sku,supplierProduct}.ts
│   │   ├── purchase/{plan,order,actualOrder}.ts
│   │   ├── inventory/stock.ts
│   │   └── sales/{order,logistics}.ts
│   ├── types/                # api.d.ts + 各实体 d.ts（与后端 VO 对齐）
│   ├── store/
│   │   └── auth.ts           # token + 用户信息 + 权限 + 菜单
│   ├── router/
│   │   ├── index.ts          # 路由实例 + 守卫
│   │   ├── static.ts         # 登录、404、403、根 redirect
│   │   └── dynamic.ts        # buildRoutes(menus): MenuVO[] → RouteRecordRaw[]
│   ├── directives/perm.ts    # v-perm 按钮级权限
│   ├── hooks/
│   │   ├── usePermission.ts  # hasPerm(code)
│   │   └── useCrudTable.ts   # 列表分页/筛选/增删改通用逻辑
│   ├── layouts/BasicLayout.vue  # 侧边菜单 + 顶栏 + 多页签 + 内容区
│   ├── components/
│   │   ├── BasicTable.vue    # 封装 a-table（分页、loading、操作列）
│   │   ├── SchemaForm.vue    # 配置式表单（a-form），新增/编辑共用
│   │   └── CascadeFilter.vue # 供应商→品牌→分类 联动筛选器
│   ├── views/
│   │   ├── login/index.vue
│   │   ├── dashboard/index.vue
│   │   ├── system/{user,role,menu}/index.vue
│   │   ├── basedata/{brand,supplier,category,logistics-provider}/index.vue
│   │   ├── product/{spu,sku,supplier-product}/index.vue
│   │   ├── purchase/{plan,order}/index.vue
│   │   ├── inventory/stock/index.vue
│   │   ├── sales/order/index.vue
│   │   ├── logistics/track/index.vue
│   │   └── error/{403,404}.vue
│   └── styles/index.css
└── tests/
    ├── unit/                 # *.spec.ts（Vitest）
    └── e2e/                  # *.e2e.ts（Playwright）
```

> **组件路径必须与后端 V7 菜单 `component` 字段对齐**：如 `system/user/index` → `src/views/system/user/index.vue`，`product/supplier-product/index` → `src/views/product/supplier-product/index.vue`。动态路由用 `import.meta.glob('/src/views/**/*.vue')` 按该字符串解析。

---

## Phase 0 — 工程脚手架与基础设施

**目标产物：** `pnpm dev` 可启动；登录页能登录、token 持久化；登录后由后端菜单动态渲染侧边栏与路由；`v-perm` 按钮权限生效；401 自动登出。Vitest + Playwright 跑通各 1 条样例。

### Task 0.1: 初始化 git 与工程骨架

- [ ] **Step 1: 初始化仓库**
```bash
cd frontend
git init -b main
git remote add origin https://github.com/txdyc/front.admin.zokomart.africa.git
```
- [ ] **Step 2: `frontend/.gitignore`**
```gitignore
node_modules/
dist/
dist-ssr/
*.local
.DS_Store
.idea/
.vscode/*
!.vscode/extensions.json
# 测试产物
test-results/
playwright-report/
coverage/
# 本地环境覆盖
.env.local
.env.*.local
```
- [ ] **Step 3: `frontend/package.json`**
```json
{
  "name": "zokomart-admin-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --fix",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "type-check": "vue-tsc --noEmit"
  },
  "dependencies": {
    "vue": "^3.5.13",
    "vue-router": "^4.5.0",
    "pinia": "^2.3.0",
    "axios": "^1.7.9",
    "ant-design-vue": "^4.2.6",
    "@ant-design/icons-vue": "^7.0.1",
    "@iconify/vue": "^4.3.0",
    "dayjs": "^1.11.13"
  },
  "devDependencies": {
    "vite": "^5.4.11",
    "@vitejs/plugin-vue": "^5.2.1",
    "typescript": "^5.7.2",
    "vue-tsc": "^2.2.0",
    "unocss": "^0.65.0",
    "unplugin-vue-components": "^0.28.0",
    "vitest": "^2.1.8",
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^25.0.1",
    "@playwright/test": "^1.49.0",
    "eslint": "^9.17.0",
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "@typescript-eslint/parser": "^8.18.0",
    "eslint-plugin-vue": "^9.32.0",
    "prettier": "^3.4.2"
  }
}
```
- [ ] **Step 4: 安装依赖**
```bash
pnpm install
npx playwright install chromium
```
- [ ] **Step 5: Commit** — `chore: init frontend project (vite + vue3 + antd)`

### Task 0.2: 构建配置（vite / tsconfig / uno / env）

- [ ] **Step 1: `frontend/vite.config.ts`**
```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss/vite';
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    Components({ resolvers: [AntDesignVueResolver({ importStyle: false })], dts: 'src/types/components.d.ts' }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
  // Vitest
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.spec.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
} as any);
```
- [ ] **Step 2: `frontend/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ESNext", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "jsx": "preserve", "esModuleInterop": true, "skipLibCheck": true,
    "resolveJsonModule": true, "isolatedModules": true, "useDefineForClassFields": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest/globals", "node"],
    "baseUrl": ".", "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue", "tests/**/*.ts"]
}
```
- [ ] **Step 3: `frontend/uno.config.ts`**
```ts
import { defineConfig, presetUno, presetAttributify } from 'unocss';
export default defineConfig({ presets: [presetUno(), presetAttributify()] });
```
- [ ] **Step 4: 环境变量**

`frontend/.env.development`:
```
VITE_API_BASE=/api
```
`frontend/.env.production`:
```
VITE_API_BASE=https://admin.zokomart.africa/api
```
- [ ] **Step 5: `frontend/index.html`**（标准 Vite 模板，`<div id="app">` + `src/main.ts`）。
- [ ] **Step 6: Commit** — `chore: vite/tsconfig/uno/env config`

### Task 0.3: 类型定义（与后端契约对齐）

- [ ] **Step 1: `src/types/api.d.ts`**
```ts
export interface ApiResult<T = any> { code: number; msg: string; data: T; }
export interface PageResult<T> { records: T[]; total: number; current: number; size: number; }
export interface PageQuery { current?: number; size?: number; [k: string]: any; }

export interface MenuVO {
  id: number; parentId: number; name: string; type: number;
  permCode: string | null; routePath: string | null; component: string | null;
  icon: string | null; sort: number; visible: number; status: number; children: MenuVO[];
}
export interface LoginUserVO {
  id: number; username: string; nickname: string | null; isSuper: number;
  roles: string[]; permissions: string[]; menus: MenuVO[];
}
export interface LoginVO { token: string; user: LoginUserVO; }
```
- [ ] **Step 2: Commit** — `chore: api types aligned with backend`

### Task 0.4: Axios 封装（核心，先写测试）

**Files:** Create `src/utils/token.ts`, `src/utils/request.ts`, `tests/unit/request.spec.ts`

- [ ] **Step 1: 写失败测试 `tests/unit/request.spec.ts`**
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter'; // 若不引入额外依赖，可改为 mock axios 实例；见下
import { request } from '@/utils/request';

// 简化：直接断言「code!==0 时 reject、code===0 时返回 data」
describe('request 拦截器', () => {
  it('code===0 返回 data', async () => {
    // 用 vi.spyOn 拦截底层 adapter，返回 {code:0,msg:"ok",data:{x:1}}
    // 断言 await request.get('/x') === {x:1}
  });
  it('code===401 触发登出并 reject', async () => {
    // 返回 {code:401,...}，断言 reject 且 token 被清除
  });
});
```
> 说明：为避免额外依赖，实际实现可用 `vi.mock('axios')` 或注入自定义 adapter。本步骤目标是**锁定契约**：`code===0 → resolve(data)`；`code!==0 → reject(new Error(msg))`；`code===401 → 清 token + 跳登录`。
- [ ] **Step 2: `src/utils/token.ts`**
```ts
const KEY = 'zokomart_token';
export const getToken = () => localStorage.getItem(KEY) || '';
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);
```
- [ ] **Step 3: `src/utils/request.ts`**
```ts
import axios, { type AxiosInstance } from 'axios';
import { message } from 'ant-design-vue';
import type { ApiResult } from '@/types/api';
import { getToken, clearToken } from './token';

export const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 15000,
});

request.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = t; // 原始 token，无 Bearer
  return config;
});

request.interceptors.response.use(
  (resp) => {
    const res = resp.data as ApiResult;
    if (res.code === 0) return res.data;
    if (res.code === 401) {
      clearToken();
      message.error('登录已失效，请重新登录');
      // 避免 SSR/测试环境报错
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(new Error(res.msg || 'unauthorized'));
    }
    message.error(res.msg || '请求失败');
    return Promise.reject(new Error(res.msg || 'error'));
  },
  (err) => {
    message.error(err?.message || '网络错误');
    return Promise.reject(err);
  },
);

// 便捷泛型封装：返回 data（非 AxiosResponse）
export const http = {
  get: <T>(url: string, params?: any) => request.get(url, { params }) as Promise<T>,
  post: <T>(url: string, data?: any) => request.post(url, data) as Promise<T>,
  put: <T>(url: string, data?: any) => request.put(url, data) as Promise<T>,
  del: <T>(url: string, params?: any) => request.delete(url, { params }) as Promise<T>,
};
```
- [ ] **Step 4: 跑测试通过** — `pnpm test:unit -t request`
- [ ] **Step 5: Commit** — `feat(http): axios wrapper with code===0 contract + 401 logout`

### Task 0.5: API 模块 —— auth

- [ ] **Step 1: `src/api/auth.ts`**
```ts
import { http } from '@/utils/request';
import type { LoginVO, LoginUserVO } from '@/types/api';

export const apiLogin = (body: { username: string; password: string }) =>
  http.post<LoginVO>('/auth/login', body);
export const apiLogout = () => http.post<void>('/auth/logout');
export const apiUserInfo = () => http.get<LoginUserVO>('/auth/user-info');
```
- [ ] **Step 2: Commit** — `feat(api): auth endpoints`

### Task 0.6: 鉴权 store（Pinia，先写测试）

**Files:** Create `src/store/auth.ts`, `tests/unit/auth-store.spec.ts`

- [ ] **Step 1: 写测试**：`login()` 后 `token`/`user`/`permissions` 就位；`hasPerm('x:y')` 在超管（`isSuper=1` 或 `permissions=['*']`）时恒 true；`logout()` 清空。
- [ ] **Step 2: `src/store/auth.ts`**
```ts
import { defineStore } from 'pinia';
import { apiLogin, apiLogout, apiUserInfo } from '@/api/auth';
import type { LoginUserVO, MenuVO } from '@/types/api';
import { getToken, setToken, clearToken } from '@/utils/token';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    user: null as LoginUserVO | null,
    menus: [] as MenuVO[],
    permissions: [] as string[],
    routesBuilt: false,
  }),
  getters: {
    isSuper: (s) => s.user?.isSuper === 1 || s.permissions.includes('*'),
    hasPerm: (s) => (code: string) =>
      s.user?.isSuper === 1 || s.permissions.includes('*') || s.permissions.includes(code),
  },
  actions: {
    async login(username: string, password: string) {
      const vo = await apiLogin({ username, password });
      setToken(vo.token);
      this.token = vo.token;
      this.applyUser(vo.user);
    },
    async loadUserInfo() {
      const u = await apiUserInfo();
      this.applyUser(u);
    },
    applyUser(u: LoginUserVO) {
      this.user = u;
      this.menus = u.menus || [];
      this.permissions = u.permissions || [];
    },
    async logout() {
      try { await apiLogout(); } catch { /* 忽略 */ }
      this.reset();
    },
    reset() {
      clearToken();
      this.token = ''; this.user = null; this.menus = []; this.permissions = []; this.routesBuilt = false;
    },
  },
});
```
- [ ] **Step 3: 测试通过 + Commit** — `feat(store): auth store with permission getters`

### Task 0.7: 动态路由（菜单树 → 路由，先写测试）

**Files:** Create `src/router/dynamic.ts`, `src/router/static.ts`, `src/router/index.ts`, `tests/unit/build-routes.spec.ts`

- [ ] **Step 1: 写 `build-routes.spec.ts`**：给定一棵含「目录(type1)/页面(type2)/按钮(type3)」的 `MenuVO[]`，`buildRoutes` 应：① 跳过 `type=3`；② `type=1` 生成挂在 `BasicLayout` 下的父级；③ `type=2` 生成叶子路由，`component` 由 glob 解析；④ `visible=0` 仍生成路由但 `meta.hidden=true`。
- [ ] **Step 2: `src/router/dynamic.ts`**
```ts
import type { RouteRecordRaw } from 'vue-router';
import type { MenuVO } from '@/types/api';

const modules = import.meta.glob('/src/views/**/*.vue');

function resolveComp(component: string | null) {
  if (!component) return undefined;
  const path = `/src/views/${component}.vue`;
  return modules[path]; // 未命中返回 undefined → 在守卫里兜底到 404
}

export function buildRoutes(menus: MenuVO[]): RouteRecordRaw[] {
  const walk = (nodes: MenuVO[]): RouteRecordRaw[] =>
    nodes
      .filter((n) => n.type !== 3 && n.status === 1)
      .map((n) => {
        const route: RouteRecordRaw = {
          path: n.routePath || `/_${n.id}`,
          name: `menu_${n.id}`,
          component: n.type === 2 ? (resolveComp(n.component) as any) : undefined,
          meta: { title: n.name, icon: n.icon, hidden: n.visible === 0, permCode: n.permCode },
          children: n.children?.length ? walk(n.children) : undefined,
        } as RouteRecordRaw;
        return route;
      });
  return walk(menus);
}
```
- [ ] **Step 3: `src/router/static.ts`**
```ts
import type { RouteRecordRaw } from 'vue-router';
import BasicLayout from '@/layouts/BasicLayout.vue';

export const LAYOUT_NAME = 'root';
export const staticRoutes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/views/login/index.vue'), meta: { hidden: true } },
  { path: '/403', name: '403', component: () => import('@/views/error/403.vue'), meta: { hidden: true } },
  { path: '/:pathMatch(.*)*', name: '404', component: () => import('@/views/error/404.vue'), meta: { hidden: true } },
];
// 业务路由统一挂在这个根布局下（动态 addRoute 时以它为 parent）
export const rootRoute: RouteRecordRaw = {
  path: '/', name: LAYOUT_NAME, component: BasicLayout, redirect: '/dashboard', children: [],
};
```
- [ ] **Step 4: `src/router/index.ts`（含守卫：未登录→/login；已登录但路由未建→拉 user-info 建路由再放行）**
```ts
import { createRouter, createWebHistory } from 'vue-router';
import { staticRoutes, rootRoute, LAYOUT_NAME } from './static';
import { buildRoutes } from './dynamic';
import { useAuthStore } from '@/store/auth';

const router = createRouter({ history: createWebHistory(), routes: [rootRoute, ...staticRoutes] });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.path === '/login') return auth.token ? '/' : true;
  if (!auth.token) return { path: '/login', query: { redirect: to.fullPath } };

  if (!auth.routesBuilt) {
    if (!auth.user) await auth.loadUserInfo();
    const dyn = buildRoutes(auth.menus);
    dyn.forEach((r) => router.addRoute(LAYOUT_NAME, r));
    // dashboard 兜底
    router.addRoute(LAYOUT_NAME, { path: '/dashboard', name: 'dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '工作台' } });
    auth.routesBuilt = true;
    return to.fullPath; // 重新匹配新加的路由
  }
  return true;
});

export default router;
```
- [ ] **Step 5: 测试通过 + Commit** — `feat(router): dynamic routes from backend menu tree`

### Task 0.8: 按钮权限指令 + hook

- [ ] **Step 1: `src/hooks/usePermission.ts`**
```ts
import { useAuthStore } from '@/store/auth';
export function usePermission() {
  const auth = useAuthStore();
  return { hasPerm: (code: string) => auth.hasPerm(code) };
}
```
- [ ] **Step 2: `src/directives/perm.ts`**
```ts
import type { Directive } from 'vue';
import { useAuthStore } from '@/store/auth';
// 用法：<a-button v-perm="'brand:create'">新增</a-button>
export const perm: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    const auth = useAuthStore();
    if (!auth.hasPerm(binding.value)) el.parentNode?.removeChild(el);
  },
};
```
- [ ] **Step 3: 单测**：无权限时元素被移除；超管恒保留。
- [ ] **Step 4: Commit** — `feat(perm): v-perm directive + usePermission`

### Task 0.9: 布局 + 登录页 + 错误页 + main.ts

- [ ] **Step 1: `src/layouts/BasicLayout.vue`** —— `a-layout`：左侧 `a-menu`（数据源 `authStore.menus`，递归渲染，过滤 `visible=0`，图标用 `@iconify/vue`），顶栏（用户名下拉 → 登出），内容区 `<router-view>` + 简单多页签（可后续增强）。
- [ ] **Step 2: `src/views/login/index.vue`** —— `a-form`（username/password，默认占位 `superadmin`），提交调 `authStore.login()`，成功后 `router.replace(redirect || '/')`。
- [ ] **Step 3: `src/views/error/403.vue` 与 `404.vue`**，`src/views/dashboard/index.vue`（占位欢迎页）。
- [ ] **Step 4: `src/main.ts`**
```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import 'uno.css';
import '@/styles/index.css';
import App from './App.vue';
import router from './router';
import { perm } from './directives/perm';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(Antd);
app.directive('perm', perm);
app.mount('#app');
```
- [ ] **Step 5: Commit** — `feat(layout): basic layout + login + error pages`

### Task 0.10: 测试基建 + 首条 E2E

- [ ] **Step 1: `frontend/playwright.config.ts`**
```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true },
});
```
- [ ] **Step 2: `tests/e2e/login.e2e.ts`**
```ts
import { test, expect } from '@playwright/test';
test('超管登录后进入工作台并看到菜单', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder(/用户名|username/i).fill('superadmin');
  await page.getByPlaceholder(/密码|password/i).fill('Admin@123');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(/\/(dashboard)?$/);
  await expect(page.getByText('系统管理')).toBeVisible();
});
```
> 前置：本地已启动后端（`backend/` 内 `JAVA_HOME=JDK21 mvn spring-boot:run`，连本地 MySQL+Redis）。
- [ ] **Step 3: 跑通** — `pnpm test:e2e`
- [ ] **Step 4: Commit** — `test(e2e): superadmin login smoke`

### 阶段验收 0
- `pnpm dev` 启动；超管可登录，侧边栏由后端菜单渲染，刷新后保持登录；无权限按钮被 `v-perm` 移除；401 自动登出回登录页。`pnpm test:unit` 与 `pnpm test:e2e` 均绿。

---

## Phase 1 — 登录与 RBAC 系统管理（#1）

**目标产物：** 用户 / 角色 / 菜单三张管理页可用；角色可勾选菜单树授权；用户可赋角色、重置密码、启停。

### Task 1.1: API 模块（system/user|role|menu）
- [ ] **Step 1:** `src/api/system/user.ts`、`role.ts`、`menu.ts`，覆盖契约速查中各端点（分页、增删改、`/{id}/roles`、重置密码、菜单树）。给出 `user.ts` 完整示例，其余同构：
```ts
// src/api/system/user.ts
import { http } from '@/utils/request';
import type { PageResult, PageQuery } from '@/types/api';
import type { UserVO, UserSaveDTO } from '@/types/system';

export const apiUserPage = (q: PageQuery) => http.get<PageResult<UserVO>>('/system/users', q);
export const apiUserGet = (id: number) => http.get<UserVO>(`/system/users/${id}`);
export const apiUserCreate = (b: UserSaveDTO) => http.post<number>('/system/users', b);
export const apiUserUpdate = (id: number, b: UserSaveDTO) => http.put<void>(`/system/users/${id}`, b);
export const apiUserDelete = (id: number) => http.del<void>(`/system/users/${id}`);
export const apiUserSetRoles = (id: number, roleIds: number[]) => http.put<void>(`/system/users/${id}/roles`, { roleIds });
export const apiUserResetPwd = (id: number, password: string) => http.put<void>(`/system/users/${id}/password`, { password });
```
- [ ] **Step 2:** `src/types/system.d.ts`（`UserVO/UserSaveDTO/RoleVO/RoleSaveDTO/MenuSaveDTO` 等，与后端 VO/DTO 字段对齐：`RoleVO` 含 `menuIds:number[]`）。
- [ ] **Step 3: Commit** — `feat(api): system user/role/menu`

### Task 1.2: 通用组件 BasicTable + useCrudTable
- [ ] **Step 1:** `src/components/BasicTable.vue`（props：`columns`、`fetch(params)`，内部管 `loading/dataSource/pagination`，暴露 `reload()`）。
- [ ] **Step 2:** `src/hooks/useCrudTable.ts`（封装 `current/size/filters` 响应式 + `load()`，把后端 `PageResult` 映射到 antd `pagination`）。
- [ ] **Step 3:** 组件单测：mock `fetch` 返回 2 条，断言渲染行数与分页 total。
- [ ] **Step 4: Commit** — `feat(ui): BasicTable + useCrudTable`

### Task 1.3: 用户管理页
- [ ] **Step 1:** `src/views/system/user/index.vue` —— `BasicTable` + 顶部筛选（用户名 keyword、状态）+ 操作列（编辑/赋角色/重置密码/启停/删除，均用 `v-perm` 包裹对应权限码）。新增/编辑用弹窗 `SchemaForm`。
- [ ] **Step 2:** 赋角色弹窗：拉 `apiRolePage` 多选；提交 `apiUserSetRoles`。
- [ ] **Step 3:** 组件测试：mock api，新增提交载荷正确；无 `system:user:create` 权限时「新增」按钮不渲染。
- [ ] **Step 4: Commit** — `feat(system): user management page`

### Task 1.4: 角色管理页（含菜单授权树）
- [ ] **Step 1:** `src/views/system/role/index.vue` —— 列表 + 新增/编辑（name/code/sort/status + `a-tree` 勾选菜单，数据源 `apiMenuTree`，`checkedKeys` ↔ `menuIds`）。
- [ ] **Step 2:** 组件测试：勾选叶子节点后提交 `menuIds` 包含该节点。
- [ ] **Step 3: Commit** — `feat(system): role management with menu authorization`

### Task 1.5: 菜单管理页
- [ ] **Step 1:** `src/views/system/menu/index.vue` —— 树表（`a-table` 树形或 `a-tree` + 右侧表单）；字段 type/permCode/routePath/component/icon/sort/visible/status/parentId。
- [ ] **Step 2: Commit** — `feat(system): menu management page`

### Task 1.6: 权限边界 E2E
- [ ] **Step 1:** `tests/e2e/rbac.e2e.ts`：超管建「采购员」用户→赋 V7 的 `BUYER` 角色→该用户登录→可见「采购管理」菜单、不可见「系统管理」；访问 `/system/user` 被守卫拦到 403 或不可达。
- [ ] **Step 2: Commit** — `test(e2e): rbac permission boundary`

### 阶段验收 1
- 三张系统页 CRUD 正常；角色授权后，普通用户登录只见被授权菜单与按钮；E2E 权限边界通过。

---

## Phase 2 — 基础数据（#2 品牌 / #3 供应商 / #4 分类 / #7 物流商）

**目标产物：** 四个基础数据维护页。**品牌页为完整模板**（页面 + 组件测试 + E2E），其余照此复制。

### Task 2.1: 品牌模块（完整模板）
- [ ] **Step 1:** `src/types/basedata.d.ts`（`BrandVO/BrandSaveDTO` 等）。
- [ ] **Step 2:** `src/api/basedata/brand.ts`（分页/增改删，端点 `/brands`）。
- [ ] **Step 3:** `src/components/SchemaForm.vue`（配置式表单：`schema: {field,label,component,rules,options}[]`，新增/编辑共用，返回 `validate()` + `getValues()`）。
- [ ] **Step 4:** `src/views/basedata/brand/index.vue` —— `BasicTable` + 筛选（name keyword、status）+ 操作列（编辑/删除 `v-perm`）+ 新增/编辑弹窗（`SchemaForm`：name/code/logoUrl/sort/status/remark）。
- [ ] **Step 5:** 组件测试 `tests/unit/brand-page.spec.ts`：mock api，列表渲染、提交载荷、删除调用。
- [ ] **Step 6:** E2E `tests/e2e/brand.e2e.ts`：超管登录→品牌页→新增（用时间戳名）→列表可见→删除。
- [ ] **Step 7: Commit** — `feat(basedata): brand module (template)`

### Task 2.2: 供应商模块（照品牌模板复制）
- [ ] **Step 1:** 复制结构；字段差异：`name/code/contactPerson/contactPhone/address/status/remark`；端点 `/suppliers`。
- [ ] **Step 2:** 组件测试（提交载荷字段）+ Commit — `feat(basedata): supplier module`

### Task 2.3: 分类模块（树形，差异较大）
- [ ] **Step 1:** `src/api/basedata/category.ts`（含 `GET /categories/tree`）。
- [ ] **Step 2:** `src/views/basedata/category/index.vue` —— 用 `a-table` 树形展示（数据源 `apiCategoryTree`），新增时可选 `parentId`（0 为根）；编辑/删除（删除前后端会校验子节点与引用，失败按 `msg` 提示）。
- [ ] **Step 3:** 组件测试 + Commit — `feat(basedata): category tree module`

### Task 2.4: 物流服务商模块（照品牌模板复制）
- [ ] **Step 1:** 字段 `name/code/contactPerson/contactPhone/status/remark`；端点 `/logistics-providers`。
- [ ] **Step 2: Commit** — `feat(basedata): logistics provider module`

### 阶段验收 2
- 四页 CRUD 正常；分类树正确；删除被引用记录时前端正确显示后端拒绝原因；品牌 E2E 绿。

---

## Phase 3 — 平台商品目录 SPU/SKU（#5）

**目标产物：** SPU、SKU 两级维护页（本期仅目录维护，不联动流转）。

### Task 3.1: SPU 模块
- [ ] **Step 1:** `src/api/product/spu.ts`、`src/types/product.d.ts`（`ProductSpuVO`：name/brandId/categoryId/mainImage/description/status）。
- [ ] **Step 2:** `src/views/product/spu/index.vue` —— 列表 + 新增/编辑（品牌、分类用下拉，数据源 brand/category api）。
- [ ] **Step 3: Commit** — `feat(product): spu module`

### Task 3.2: SKU 模块
- [ ] **Step 1:** `src/api/product/sku.ts`（含 `GET /product-spus/{id}/skus`）。
- [ ] **Step 2:** `src/views/product/sku/index.vue` —— 顶部选 SPU → 列出其 SKU；新增/编辑（skuCode/spec/image/price/status）。
- [ ] **Step 3:** 组件测试 + Commit — `feat(product): sku module`

### 阶段验收 3
- SPU/SKU CRUD 正常；按 SPU 查 SKU 正确。

---

## Phase 4 — 供应商产品（#6，核心操作单元）

**目标产物：** 供应商产品维护页 + **供应商→品牌→分类联动筛选器**（后续采购/库存/销售复用）。

### Task 4.1: 联动筛选器组件 CascadeFilter
- [ ] **Step 1:** `src/api/product/supplierProduct.ts`（含 `GET /suppliers/{id}/brands`、`GET /suppliers/{id}/categories`、`GET /supplier-products`）。
- [ ] **Step 2:** `src/components/CascadeFilter.vue` —— 三个联动下拉：选供应商→加载其品牌/分类；`v-model` 输出 `{ supplierId, brandId, categoryId, keyword, status }`；暴露 `change` 事件。
- [ ] **Step 3:** 组件测试：选供应商触发品牌/分类加载；切换供应商清空下游。
- [ ] **Step 4: Commit** — `feat(component): cascade supplier→brand→category filter`

### Task 4.2: 供应商产品页
- [ ] **Step 1:** `src/views/product/supplier-product/index.vue` —— `CascadeFilter` + `BasicTable`；列：图片/名称/产品编码/品牌/分类/批发价/零售价/MOQ/状态。新增/编辑弹窗（含图片地址、`minPurchaseQty≥1`、价格 `≥0` 前端校验，与后端一致）。
- [ ] **Step 2:** 组件测试：提交载荷字段齐全；MOQ<1 前端拦截。
- [ ] **Step 3:** E2E `tests/e2e/supplier-product.e2e.ts`：建供应商→建供应商产品→联动筛选可见。
- [ ] **Step 4: Commit** — `feat(supplier-product): management page with cascade filter`

### 阶段验收 4
- 供应商产品 CRUD 正常；联动筛选正确；唯一/校验错误按后端 `msg` 提示。

---

## Phase 5 — 采购计划与审批（#8、#9）

**目标产物：** 采购计划「联动选品→逐行填数量→存草稿→提交」；审批页「通过/退回」。

### Task 5.1: API + 类型
- [ ] **Step 1:** `src/api/purchase/plan.ts`（CRUD + submit/approve/reject）、`src/types/purchase.d.ts`（`PurchasePlanVO`、`PurchasePlanItemVO`、`PurchasePlanSaveDTO{remark,items:[{supplierProductId,purchaseQty}]}`）。
- [ ] **Step 2: Commit** — `feat(api): purchase plan`

### Task 5.2: 采购计划编辑页（核心交互）
- [ ] **Step 1:** `src/views/purchase/plan/index.vue` —— 两态：①列表（状态/供应商筛选，操作：查看/编辑(仅 DRAFT/REJECTED)/删除/提交）；②编辑抽屉/页：`CascadeFilter` 筛出供应商产品 → 可编辑表格，每行带出 MOQ 与批发价，录入 `purchaseQty`（前端校验 `≥MOQ`，0 表示不采购）→ 实时汇总金额 → 保存草稿（`items` 仅含 `qty>0` 行）。
- [ ] **Step 2:** 组件测试：`purchaseQty<MOQ` 行报错且不可提交；汇总金额 = Σ 批发价×qty；保存载荷过滤 qty=0 行。
- [ ] **Step 3:** REJECTED 计划可重新编辑并提交；展示退回原因 `approveRemark`。
- [ ] **Step 4: Commit** — `feat(purchase): plan create/edit with MOQ validation`

### Task 5.3: 审批页
- [ ] **Step 1:** 在计划列表对 `PENDING` 计划提供「通过」「退回(填原因)」按钮（`v-perm="'purchase:plan:approve'"`）。通过调 `/approve`，退回调 `/reject`（带 `approveRemark`）。
- [ ] **Step 2:** E2E `tests/e2e/purchase-plan.e2e.ts`：建供应商产品→建计划→提交→审批通过→断言生成采购订单（跳采购订单页可见）。
- [ ] **Step 3: Commit** — `feat(purchase): plan approval (approve/reject)`

### 阶段验收 5
- 计划草稿/提交/编辑/删除受状态约束；MOQ 校验生效；审批通过后按供应商生成采购订单；E2E 绿。

---

## Phase 6 — 采购订单付款、实际采购单与入库（#10、#11）

**目标产物：** 采购订单明细付款标记 → 确认生成实际采购单；实际采购单入库（库存↑）。

### Task 6.1: API + 类型
- [ ] **Step 1:** `src/api/purchase/order.ts`（list/detail、`items/payment`、`confirm`）、`src/api/purchase/actualOrder.ts`（list/detail、`inbound`）。类型含 `PurchaseOrderVO/Item(payment_status)`、`ActualPurchaseOrderVO/Item(inbound_status)`。
- [ ] **Step 2: Commit** — `feat(api): purchase order + actual order`

### Task 6.2: 采购订单付款页
- [ ] **Step 1:** `src/views/purchase/order/index.vue` —— 列表（按 `planId/supplierId/status` 筛选）+ 详情抽屉（明细表格，逐行/批量切换付款状态 `UNSET/PAID/UNPAID`，调 `items/payment`）+「确认生成实际采购单」按钮（`/confirm`，至少一条 PAID）。
- [ ] **Step 2:** 组件测试：批量选中行设 PAID 的载荷 `{itemIds,paymentStatus}` 正确；无 PAID 时确认按钮禁用/后端拒绝提示。
- [ ] **Step 3: Commit** — `feat(purchase): order payment + confirm to actual order`

### Task 6.3: 实际采购单入库页（Tab 或独立页）
- [ ] **Step 1:** 实际采购单列表 + 详情（明细 `inbound_status`）+「整单入库」按钮（`/inbound`，`v-perm="'inventory:inbound'"`）。入库成功后状态变 `INBOUND_DONE`。
- [ ] **Step 2:** E2E `tests/e2e/purchase-inbound.e2e.ts`：付款→确认→入库→断言实际采购单 `INBOUND_DONE`（与后端 `PurchaseFlowApiTest` 同链路）。
- [ ] **Step 3: Commit** — `feat(purchase): inbound for actual order`

### 阶段验收 6
- 付款→实际采购单→入库全链可在 UI 走通；状态与按钮可用性随状态机变化；E2E 绿。

---

## Phase 7 — 库存管理（#12）

**目标产物：** 联动筛选库存列表 + 手工调整到目标数量（写流水由后端处理）。

### Task 7.1: 库存页
- [ ] **Step 1:** `src/api/inventory/stock.ts`（`GET /inventory/stocks`、`PUT /inventory/stocks/{supplierProductId}`）。
- [ ] **Step 2:** `src/views/inventory/stock/index.vue` —— `CascadeFilter` + `BasicTable`（列：供应商/品牌/分类/产品/当前库存）；「调整」弹窗（目标 `quantity` + `remark`，`v-perm="'inventory:edit'"`，前端 `≥0` 校验）。
- [ ] **Step 3:** 组件测试：调整载荷 `{quantity,remark}`；负数拦截。
- [ ] **Step 4:** E2E `tests/e2e/inventory.e2e.ts`：入库后库存可见→手工调整→列表回显新值。
- [ ] **Step 5: Commit** — `feat(inventory): stock list + manual adjust`

### 阶段验收 7
- 库存联动筛选与回显正确；手工调整生效；E2E 绿。

---

## Phase 8 — 销售管理（#13、#15）

**目标产物：** 选品（库存为源）→ 下单（可改价 + 客户信息，下单即扣库存）→ 列表（本人 + `completed` 筛选）。

### Task 8.1: API + 类型
- [ ] **Step 1:** `src/api/sales/order.ts`（create/list/detail）、`src/types/sales.d.ts`（`SalesOrderVO/Item`、`SalesOrderSaveDTO{customerName,customerPhone,customerAddress,items:[{supplierProductId,qty,unitPrice?}]}`）。
- [ ] **Step 2: Commit** — `feat(api): sales order`

### Task 8.2: 销售下单页
- [ ] **Step 1:** `src/views/sales/order/index.vue` —— 两态：①列表（`completed` 切换 已完成/未完成；列：单号/客户/金额/状态/completed）②下单抽屉：`CascadeFilter`（来源 `/inventory/stocks`，回显库存与零售价）选品 → 录 `qty`（前端校验 ≤ 当前库存，下单时后端再校验防超卖）+ 可改 `unitPrice`（默认零售价）+ 客户三项必填 → 提交。
- [ ] **Step 2:** 组件测试：默认单价=零售价、可改；客户必填校验；提交载荷正确；库存不足时（后端 `40001`）按 `msg` 提示。
- [ ] **Step 3: Commit** — `feat(sales): order create + own/completed list`

### 阶段验收 8
- 下单扣库存、改价、客户必填、本人/完成筛选均正确；库存不足整单失败提示具体产品。

---

## Phase 9 — 物流管理（#14）

**目标产物：** 派送 → 状态机 → 拒收（回补库存）→ 完成结算（实收金额）。

### Task 9.1: API
- [ ] **Step 1:** `src/api/sales/logistics.ts`（dispatch/status/items-reject/complete）。
- [ ] **Step 2: Commit** — `feat(api): logistics actions`

### Task 9.2: 物流操作页
- [ ] **Step 1:** `src/views/logistics/track/index.vue` —— 销售订单列表（物流视角）+ 详情抽屉，按当前状态显示可用动作：
  - `PENDING_DISPATCH`：派送（选物流商 + 派送费）→ `DISPATCHING`。
  - `DISPATCHING`：更新状态 `SIGNED/SIGNED_PAID/UNREACHABLE/REJECTED`。
  - `SIGNED/SIGNED_PAID`：可对明细标记拒收量（`items/reject`）；可「完成」（结算实收）。
  - `UNREACHABLE`：可重派或转 REJECTED；不可直接完成。
  状态转换的可用性以 PRD 5.13/5.14 状态机为准，非法转换由后端 `40003` 兜底。
- [ ] **Step 2:** 组件测试：各状态下按钮可用性正确；拒收载荷 `{itemId,rejectQty}`。
- [ ] **Step 3:** E2E `tests/e2e/sales-logistics.e2e.ts`（对齐后端 `EndToEndSmokeTest`）：下单(3)→派送→签收→拒收(1)→完成；断言订单 `actualAmount=200×(3-1)=400`、`completed=1`，库存终值=3。
- [ ] **Step 4: Commit** — `feat(logistics): dispatch/status/reject/complete`

### 阶段验收 9
- 物流全链可在 UI 走通；拒收回补、完成结算金额正确；E2E 与后端冒烟数值一致。

---

## Phase 10 — 收尾与加固

**目标产物：** 全链 E2E 冒烟、权限走查、构建产物、README、推送。

### Task 10.1: 全链端到端冒烟
- [ ] **Step 1:** `tests/e2e/full-chain.e2e.ts`：超管一条龙：基础数据→供应商产品→采购计划→审批→付款→入库→销售→物流完成，断言关键终值（库存、实收）。
- [ ] **Step 2: Commit** — `test(e2e): full business chain smoke`

### Task 10.2: 角色权限走查（用 V7 模板角色）
- [ ] **Step 1:** 分别以 `BUYER/WAREHOUSE/SALES/LOGISTICS` 登录，确认各自只见对应菜单与按钮、能完成本职动作、越权动作被拦。可写为参数化 E2E。
- [ ] **Step 2: Commit** — `test(e2e): role-based access walkthrough`

### Task 10.3: 构建与产物
- [ ] **Step 1:** `pnpm build` 通过（`vue-tsc` 无类型错误）；`pnpm preview` 自测。
- [ ] **Step 2:** 校核 `.env.production` 的 `VITE_API_BASE` 与部署域名一致。
- [ ] **Step 3: Commit** — `chore: production build config`

### Task 10.4: README + 推送
- [ ] **Step 1:** `frontend/README.md`（启动/环境变量/代理/构建/测试/与后端联调说明/默认账号）。
- [ ] **Step 2:** `git push -u origin main`。

### 阶段验收 10
- 全链 E2E 绿；四类角色权限走查通过；`pnpm build` 成功；README 完整；代码推送远程。

---

## 自查（Spec 覆盖核对，对应 PRD 第 5 章 #1–#15）

| PRD 需求 | 落地位置 |
|----------|----------|
| #1 登录 / RBAC（用户/角色/菜单） | Phase 0（登录/路由/权限基建）+ Phase 1 |
| #2 品牌 | Phase 2 (Task 2.1) |
| #3 供应商 | Phase 2 (Task 2.2) |
| #4 分类（树） | Phase 2 (Task 2.3) |
| #5 SPU/SKU | Phase 3 |
| #6 供应商产品 + 联动筛选 | Phase 4 |
| #7 物流服务商 | Phase 2 (Task 2.4) |
| #8 采购计划 | Phase 5 (Task 5.2) |
| #9 采购审批生单 | Phase 5 (Task 5.3) |
| #10 付款 / 实际采购单 | Phase 6 (Task 6.2) |
| #11 入库 | Phase 6 (Task 6.3) |
| #12 库存 | Phase 7 |
| #13 销售下单 | Phase 8 |
| #14 物流 / 结算 | Phase 9 |
| #15 完成情况筛选（本人） | Phase 8 (Task 8.2，后端按权限自动本人范围) |

**通用约定（落地时遵守）**
- TS 类型一律与后端 VO/DTO 字段名（camelCase）对齐；分页用 `current/size`，成功判据 `code===0`。
- 所有写操作按钮包 `v-perm="'<权限码>'"`；列表/详情进入由动态路由（菜单授权）控制，双层防护。
- 列表页统一用 `BasicTable + useCrudTable`；表单统一 `SchemaForm`；供应商→品牌→分类联动统一 `CascadeFilter`。
- 金额展示币种 GHS、两位小数；数量为整数。日期用 Day.js 统一格式（与后端时区约定一致）。
- 错误统一由 `request` 拦截器提示 `msg`；业务细分码（`40001/40002/40003`）直接透传后端提示，前端不另造文案。
```
