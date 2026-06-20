# ZokoMart Admin 前端

面向非洲（加纳）电商独立站 **ZokoMart** 的后台管理界面。基于 Vue3 + Vite + TypeScript +
Ant Design Vue 二次开发（参考 Vben Admin 设计，裁剪为单个 Vite 应用），与后端
`admin.zokomart.africa`（SpringBoot + Sa-Token RBAC）前后端分离对接。

## 技术栈

- Vue 3.5 + `<script setup>` + TypeScript
- Vite 5 + UnoCSS + `unplugin-vue-components`（Ant Design Vue 按需自动导入）
- Pinia（状态）/ Vue Router 4（动态路由）/ Axios（请求）
- Ant Design Vue 4（UI）
- Vitest（单元/组件测试）+ Playwright（E2E）
- 包管理：pnpm

## 目录结构

```
src/
├── api/            # 接口层，按业务域分目录（system/basedata/product/purchase/inventory/sales）
├── components/     # 通用组件：BasicTable、SchemaForm、CascadeFilter
├── directives/     # v-perm 按钮级权限指令
├── hooks/          # useCrudTable 等
├── router/         # static(静态路由) + dynamic(菜单树→动态路由 buildRoutes)
├── store/          # Pinia：auth（token/用户/权限/菜单）
├── types/          # 接口类型（api/system/basedata/product/purchase/inventory/sales）
├── utils/          # request（Axios 封装+拦截器）、token
└── views/          # 页面，路径与后端菜单 component 字段一一对应
tests/
├── unit/           # Vitest 组件/工具测试
└── e2e/            # Playwright 端到端（跑在真实后端上）
```

## 快速开始

```bash
pnpm install        # 安装依赖（pnpm10 已在 package.json 放行 esbuild 构建脚本）
pnpm dev            # 本地开发，默认 http://localhost:5173
pnpm build          # 生产构建（先 vue-tsc 类型检查，再 vite build）
pnpm preview        # 预览构建产物
pnpm type-check     # 仅类型检查（vue-tsc --noEmit）
```

## 环境变量

| 变量 | 文件 | 说明 |
|------|------|------|
| `VITE_API_BASE` | `.env.development` | 开发环境 API 基址，默认 `/api`（走 dev proxy） |
| `VITE_API_BASE` | `.env.production` | 生产环境 API 基址，默认 `https://admin.zokomart.africa/api` |
| `VITE_PROXY_TARGET` | 环境变量（可选） | dev proxy `/api` 的转发目标，默认 `http://localhost:8080` |

> 本机若 8080 被占用，后端常改跑 8081：启动 dev 时用
> `VITE_PROXY_TARGET=http://localhost:8081 pnpm dev` 覆盖。

## 与后端联调约定

- 统一响应包 `{ code, msg, data }`，**成功判据 `code === 0`**（非 200）；`401` 清 token 跳登录。
- 鉴权头 `Authorization: <原始 token>`（**无 `Bearer` 前缀**）。
- 分页：入参 `current/size`，出参 `{ records, total, current, size }`。
- 菜单与按钮级权限来自登录后的 `GET /api/auth/user-info`（`menus`/`permissions`）；
  前端不写死菜单，菜单 `component`（如 `purchase/plan/index`）经
  `import.meta.glob('/src/views/**/*.vue')` 映射到 `src/views/purchase/plan/index.vue`。
- 雪花 Long ID 超 JS 安全整数会被后端序列化为字符串；前端实体 id 统一用 `Id = number | string`，
  **切勿对 id 做 `Number()` 强转**。

## 测试

### 单元 / 组件（Vitest，离线）

```bash
pnpm test:unit          # 跑一遍
pnpm test:unit:watch    # 监听模式
```

### 端到端（Playwright，需真实后端）

E2E 跑在真实后端上，请先启动后端（连本地 MySQL + Redis）：

```bash
# 后端（在 backend/ 下；JDK21）
JAVA_HOME=<JDK21> SERVER_PORT=8081 mvn spring-boot:run

# 前端 E2E（另开终端，在 frontend/ 下）
VITE_PROXY_TARGET=http://localhost:8081 pnpm test:e2e
```

E2E 用例覆盖：登录冒烟、RBAC 权限边界、角色走查（`role-access`）、基础数据（品牌/供应商产品）、
采购计划审批、采购入库、库存调整、销售+物流全链（`sales-logistics`）、全链冒烟（`full-chain`）。

> antd 两汉字按钮间会插空格，E2E 用正则匹配（如 `/确\s*定/`、`/登\s*录/`）。

## 默认账号

| 角色 | 用户名 | 初始密码 |
|------|--------|----------|
| 超级管理员 | `superadmin` | `Admin@123` |

后端 V7 另种有 5 个模板角色（采购员 BUYER / 审批主管 APPROVER / 仓库管理员 WAREHOUSE /
销售员 SALES / 物流专员 LOGISTICS），可在「系统管理 → 用户」建用户并赋角色后用于权限走查。

## 约定

- 接口出入参用 `dto/vo` 类型；列表统一用 `BasicTable + useCrudTable`，表单用 `SchemaForm`，
  采购/库存/销售选品复用 `CascadeFilter`（供应商→品牌→分类联动）。
- 按钮级权限用 `v-perm="'<permission:code>'"`；越权直达路由落 404（动态路由不含该项）。
- 金额 GHS 两位小数；字段 camelCase。

### 包裹面单打印

销售订单列表页点击「**打印今日面单**」→ 在弹出的抽屉中勾选订单 → 点击「打印」。  
首次打印需在浏览器打印对话框中选择 **XprinterXP-420B**、纸张 **100×100mm**、缩放 **100%**、边距 **无/None**；若内容被裁切，请检查打印机驱动默认纸张是否设置为 100×100mm。
