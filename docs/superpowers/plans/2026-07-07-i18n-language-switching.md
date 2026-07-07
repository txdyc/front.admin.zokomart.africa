# i18n (Chinese ⇄ English) Language Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users switch the entire admin UI between Chinese (`zh-CN`) and English (`en-US`) from a top-right header control, remembering the choice in `localStorage`.

**Architecture:** Add `vue-i18n@9` (Composition mode) for all app strings; drive Ant Design Vue's own component text via a reactive `<a-config-provider :locale>`; translate backend-driven menu labels through a frontend route-path map with graceful fallback. All strings live in namespaced catalogs (`zh-CN.ts` / `en-US.ts`) whose key sets are kept identical by an automated parity test.

**Tech Stack:** Vue 3, TypeScript, Ant Design Vue 4, vue-i18n 9, Pinia, Vitest, Playwright.

**Repo:** `frontend/` only. No backend/DB changes.

---

## Conventions used by every view task

The view-translation tasks (Tasks 8–19) are mechanical and all follow the **same rule**, demonstrated fully in the exemplar (Task 7). Read Task 7 before doing any of them.

**The rule:** In the target file, replace every user-facing Chinese string literal with a `t('<namespace>.<key>')` call (template) or `t(...)` (script). For each literal:
1. Add a key under the file's namespace in **both** `src/locales/lang/zh-CN.ts` (Chinese, copied verbatim from source) and `src/locales/lang/en-US.ts` (English from the Glossary below).
2. Use the Glossary for shared/domain terms so translations stay consistent across files.
3. Interpolated strings (e.g. `` `共 ${n} 条` ``) become `t('common.total', { n })` with `{n}` placeholders in the catalog.
4. Do **not** touch code comments, `data-test` attributes, `key`/`dataIndex` values, API paths, or `*.d.ts` / `api/*.ts` files.

**In `<script setup>`** get `t` via `import { useI18n } from 'vue-i18n'` then `const { t } = useI18n()`. For module-scope constants that must be reactive to locale (e.g. `columns`, `formSchema`), wrap them in `computed(() => ...)` so they re-evaluate on locale change. (The exemplar shows exactly how; several views already use `computed` for `formSchema`.)

**Completion gate for every view task:** the key-parity unit test (Task 1) passes, `pnpm type-check` passes, then commit.

---

## Glossary (zh → en) — use verbatim for consistency

**Actions / common**
| zh | en |
|----|----|
| 查询 | Search |
| 重置 | Reset |
| 新增 | Create |
| 编辑 | Edit |
| 删除 | Delete |
| 保存 | Save |
| 取消 | Cancel |
| 确认 / 确定 | Confirm / OK |
| 启用 | Enable / Enabled |
| 停用 | Disable / Disabled |
| 操作 | Actions |
| 状态 | Status |
| 全部 | All |
| 备注 | Remark |
| 关键字 | Keyword |
| 创建时间 | Created At |
| 更新时间 | Updated At |
| 请输入 | Please enter |
| 请选择 | Please select |
| 保存成功 | Saved successfully |
| 操作成功 | Operation successful |
| 已删除 | Deleted |
| 上传 | Upload |
| 移除 | Remove |
| 返回首页 | Back to Home |

**Domain nouns**
| zh | en |
|----|----|
| 用户 | User |
| 昵称 | Nickname |
| 手机号 | Phone |
| 邮箱 | Email |
| 密码 | Password |
| 角色 | Role |
| 菜单 | Menu |
| 权限 | Permission |
| 品牌 | Brand |
| 分类 | Category |
| 供应商 | Supplier |
| 物流商 | Logistics Provider |
| 商品 | Product |
| SPU / SKU | SPU / SKU (keep) |
| 供应商产品 | Supplier Product |
| 采购计划 | Purchase Plan |
| 采购订单 | Purchase Order |
| 入库 | Inbound / Stock-in |
| 库存 | Stock / Inventory |
| 销售订单 | Sales Order |
| 物流 | Logistics |
| 物流跟踪 | Logistics Tracking |
| 客户 | Customer |
| 工作台 | Dashboard |
| 编码 | Code |
| 名称 | Name |
| 金额 | Amount |
| 数量 | Quantity |
| 单价 | Unit Price |
| 审批 | Approval |
| 提交 | Submit |
| 同步 | Sync |
| 导入 | Import |
| 抓取 | Scrape |

When a term isn't listed, translate naturally and add it to this table as you go.

---

## Task 1: Install vue-i18n and scaffold the locale module (with tests)

**Files:**
- Modify: `frontend/package.json` (add dependency)
- Create: `frontend/src/locales/lang/zh-CN.ts`
- Create: `frontend/src/locales/lang/en-US.ts`
- Create: `frontend/src/locales/index.ts`
- Create: `frontend/src/locales/menu.ts`
- Test: `frontend/tests/unit/locales.spec.ts`

- [ ] **Step 1: Install dependency**

Run (in `frontend/`): `pnpm add vue-i18n@^9`
Expected: `vue-i18n` appears under `dependencies` in `package.json`, lockfile updated.

- [ ] **Step 2: Create the two catalog files with the shared namespaces**

`frontend/src/locales/lang/zh-CN.ts`:

```ts
export default {
  common: {
    search: '查询',
    reset: '重置',
    create: '新增',
    edit: '编辑',
    delete: '删除',
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    ok: '确定',
    operation: '操作',
    status: '状态',
    all: '全部',
    remark: '备注',
    keyword: '关键字',
    createTime: '创建时间',
    updateTime: '更新时间',
    pleaseInput: '请输入',
    pleaseSelect: '请选择',
    saveSuccess: '保存成功',
    operateSuccess: '操作成功',
    deleteSuccess: '已删除',
    deleteConfirm: '确认删除该记录？',
    total: '共 {n} 条',
    backHome: '返回首页',
    upload: '上传',
    remove: '移除',
    enabled: '启用',
    disabled: '停用',
    loginExpired: '登录已失效，请重新登录',
    requestFailed: '请求失败',
    networkError: '网络错误',
    uploadImageOnly: '只能上传图片文件',
    uploadTooLarge: '图片不能超过 {size}MB',
    uploadFailed: '上传失败',
  },
  language: { label: '语言', zh: '中文', en: 'English' },
  app: { name: 'ZokoMart', logout: '退出登录' },
  login: {
    title: 'ZokoMart Admin',
    username: '用户名',
    password: '密码',
    submit: '登录',
  },
} as const;
```

`frontend/src/locales/lang/en-US.ts`:

```ts
export default {
  common: {
    search: 'Search',
    reset: 'Reset',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    ok: 'OK',
    operation: 'Actions',
    status: 'Status',
    all: 'All',
    remark: 'Remark',
    keyword: 'Keyword',
    createTime: 'Created At',
    updateTime: 'Updated At',
    pleaseInput: 'Please enter',
    pleaseSelect: 'Please select',
    saveSuccess: 'Saved successfully',
    operateSuccess: 'Operation successful',
    deleteSuccess: 'Deleted',
    deleteConfirm: 'Delete this record?',
    total: '{n} items',
    backHome: 'Back to Home',
    upload: 'Upload',
    remove: 'Remove',
    enabled: 'Enabled',
    disabled: 'Disabled',
    loginExpired: 'Your session has expired, please log in again',
    requestFailed: 'Request failed',
    networkError: 'Network error',
    uploadImageOnly: 'Only image files can be uploaded',
    uploadTooLarge: 'Image must be smaller than {size}MB',
    uploadFailed: 'Upload failed',
  },
  language: { label: 'Language', zh: '中文', en: 'English' },
  app: { name: 'ZokoMart', logout: 'Logout' },
  login: {
    title: 'ZokoMart Admin',
    username: 'Username',
    password: 'Password',
    submit: 'Log In',
  },
} as const;
```

- [ ] **Step 3: Create the i18n instance module**

`frontend/src/locales/index.ts`:

```ts
import { createI18n } from 'vue-i18n';
import { ref } from 'vue';
import zhCNMessages from './lang/zh-CN';
import enUSMessages from './lang/en-US';
import antdZhCN from 'ant-design-vue/es/locale/zh_CN';
import antdEnUS from 'ant-design-vue/es/locale/en_US';

export type Locale = 'zh-CN' | 'en-US';
export const SUPPORTED_LOCALES: { value: Locale; labelKey: string }[] = [
  { value: 'zh-CN', labelKey: 'language.zh' },
  { value: 'en-US', labelKey: 'language.en' },
];

const STORAGE_KEY = 'zoko-locale';

export function readStoredLocale(): Locale {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as Locale | null;
  return v === 'en-US' || v === 'zh-CN' ? v : 'zh-CN';
}

export const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCNMessages, 'en-US': enUSMessages },
});

// Reactive antd locale bundle consumed by <a-config-provider> in App.vue.
export const currentLocale = ref<Locale>(readStoredLocale());
export const antdLocale = ref(currentLocale.value === 'en-US' ? antdEnUS : antdZhCN);

export function setLocale(l: Locale): void {
  i18n.global.locale.value = l;
  currentLocale.value = l;
  antdLocale.value = l === 'en-US' ? antdEnUS : antdZhCN;
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
}

// Convenience for use outside components (interceptors, stores).
export const t = i18n.global.t;
```

- [ ] **Step 4: Create the menu label map + helper**

`frontend/src/locales/menu.ts`:

```ts
import { currentLocale, type Locale } from './index';
import type { MenuVO } from '@/types/api';

// Keyed primarily by routePath (leaf menus); directory nodes without a
// routePath are keyed by their Chinese `name`. Unmapped => raw DB name.
const menuMap: Record<Locale, Record<string, string>> = {
  'zh-CN': {},
  'en-US': {
    // Directories (by Chinese name)
    系统管理: 'System',
    基础数据: 'Base Data',
    商品管理: 'Product',
    采购管理: 'Purchasing',
    库存管理: 'Inventory',
    销售管理: 'Sales',
    物流管理: 'Logistics',
    // Leaves (by routePath) — extend as needed
    '/dashboard': 'Dashboard',
    '/system/user': 'Users',
    '/system/role': 'Roles',
    '/system/menu': 'Menus',
    '/basedata/brand': 'Brands',
    '/basedata/category': 'Categories',
    '/basedata/supplier': 'Suppliers',
    '/basedata/logistics-provider': 'Logistics Providers',
    '/product/spu': 'SPU',
    '/product/sku': 'SKU',
    '/product/supplier-product': 'Supplier Products',
    '/purchase/plan': 'Purchase Plans',
    '/purchase/order': 'Purchase Orders',
    '/inventory/stock': 'Stock',
    '/sales/order': 'Sales Orders',
    '/logistics/track': 'Logistics Tracking',
    '/customer': 'Customers',
  },
};

export function menuLabel(node: Pick<MenuVO, 'routePath' | 'name'>): string {
  const map = menuMap[currentLocale.value];
  return (
    (node.routePath && map[node.routePath]) || map[node.name] || node.name
  );
}
```

> Note: verify each `routePath` value against the running app's menu data (`auth.menus`) and adjust keys to match exactly. Unmapped entries safely fall back to the Chinese DB name.

- [ ] **Step 5: Write the failing tests**

`frontend/tests/unit/locales.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import zh from '@/locales/lang/zh-CN';
import en from '@/locales/lang/en-US';
import { setLocale, readStoredLocale, i18n, currentLocale } from '@/locales';
import { menuLabel } from '@/locales/menu';

function keyPaths(obj: Record<string, any>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? keyPaths(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe('locale catalogs', () => {
  it('zh-CN and en-US have identical key sets', () => {
    const zhKeys = keyPaths(zh).sort();
    const enKeys = keyPaths(en).sort();
    expect(enKeys).toEqual(zhKeys);
  });
});

describe('setLocale', () => {
  beforeEach(() => localStorage.clear());

  it('persists to localStorage and switches i18n locale', () => {
    setLocale('en-US');
    expect(localStorage.getItem('zoko-locale')).toBe('en-US');
    expect(i18n.global.locale.value).toBe('en-US');
    expect(currentLocale.value).toBe('en-US');
    setLocale('zh-CN');
  });

  it('readStoredLocale defaults to zh-CN', () => {
    localStorage.clear();
    expect(readStoredLocale()).toBe('zh-CN');
  });
});

describe('menuLabel', () => {
  it('falls back routePath -> name -> raw', () => {
    setLocale('en-US');
    expect(menuLabel({ routePath: '/system/user', name: '用户管理' })).toBe('Users');
    expect(menuLabel({ routePath: '/unknown', name: '系统管理' })).toBe('System');
    expect(menuLabel({ routePath: '/nope', name: '未知菜单' })).toBe('未知菜单');
    setLocale('zh-CN');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm test:unit -- locales`
Expected: FAIL (module resolution / not yet wired) — confirms the test targets real code.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test:unit -- locales`
Expected: PASS (3 describe blocks green).

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/locales frontend/tests/unit/locales.spec.ts
git commit -m "feat(i18n): add vue-i18n locale module, catalogs and menu map"
```

---

## Task 2: Register i18n and initialize locale before mount

**Files:**
- Modify: `frontend/src/main.ts`

- [ ] **Step 1: Wire the plugin**

Edit `frontend/src/main.ts` — add the import and `app.use(i18n)` before `app.mount`:

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'ant-design-vue/dist/reset.css';
import 'uno.css';
import '@/styles/index.css';
import App from './App.vue';
import router from './router';
import { perm } from './directives/perm';
import { i18n } from '@/locales';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.directive('perm', perm);
app.mount('#app');
```

(`i18n` is already initialized from `localStorage` at import time, so the first paint uses the remembered locale.)

- [ ] **Step 2: Verify build**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.ts
git commit -m "feat(i18n): register vue-i18n plugin in app bootstrap"
```

---

## Task 3: Make Ant Design Vue locale reactive in App.vue

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Replace the static zhCN locale with the reactive one**

`frontend/src/App.vue`:

```vue
<script setup lang="ts">
import { antdLocale } from '@/locales';
</script>

<template>
  <a-config-provider :locale="antdLocale">
    <router-view />
  </a-config-provider>
</template>
```

- [ ] **Step 2: Verify**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat(i18n): drive antd component locale from reactive setLocale"
```

---

## Task 4: Language switcher + menu translation in BasicLayout

**Files:**
- Modify: `frontend/src/layouts/BasicLayout.vue`

- [ ] **Step 1: Update the layout**

Replace the whole file with:

```vue
<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { useAuthStore } from '@/store/auth';
import { setLocale, currentLocale, SUPPORTED_LOCALES, type Locale } from '@/locales';
import { menuLabel } from '@/locales/menu';
import type { MenuVO } from '@/types/api';
import type { ItemType } from 'ant-design-vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

function toItems(nodes: MenuVO[]): ItemType[] {
  return nodes
    .filter((n) => n.type !== 3 && n.visible === 1 && n.status === 1)
    .map((n) => {
      const children = n.children?.length ? toItems(n.children) : undefined;
      return {
        key: n.routePath || `menu_${n.id}`,
        label: menuLabel(n),
        icon: n.icon ? () => h(Icon, { icon: n.icon as string }) : undefined,
        children: children && children.length ? children : undefined,
      } as ItemType;
    });
}

// Depend on currentLocale so labels re-translate on switch.
const menuItems = computed(() => {
  void currentLocale.value;
  return toItems(auth.menus);
});
const selectedKeys = ref<string[]>([route.path]);
watch(() => route.path, (p) => (selectedKeys.value = [p]));

function onMenuClick({ key }: { key: string | number }) {
  const k = String(key);
  if (k.startsWith('/')) router.push(k);
}

function onSelectLocale({ key }: { key: string | number }) {
  setLocale(key as Locale);
}

async function onLogout() {
  await auth.logout();
  router.replace('/login');
}
</script>

<template>
  <a-layout class="h-screen">
    <a-layout-sider theme="dark" collapsible>
      <div class="h-12 flex items-center justify-center text-white font-bold">
        {{ t('app.name') }}
      </div>
      <a-menu
        theme="dark"
        mode="inline"
        :items="menuItems"
        :selected-keys="selectedKeys"
        @click="onMenuClick"
      />
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="bg-white px-4 flex items-center justify-end gap-4">
        <a-dropdown>
          <span class="cursor-pointer flex items-center gap-1" data-test="lang-switch">
            <Icon icon="mdi:translate" />
            {{ t('language.label') }}
          </span>
          <template #overlay>
            <a-menu :selected-keys="[currentLocale]" @click="onSelectLocale">
              <a-menu-item
                v-for="l in SUPPORTED_LOCALES"
                :key="l.value"
                :data-test="`lang-${l.value}`"
              >
                {{ t(l.labelKey) }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-dropdown>
          <span class="cursor-pointer">{{ auth.user?.nickname || auth.user?.username }}</span>
          <template #overlay>
            <a-menu>
              <a-menu-item key="logout" @click="onLogout">{{ t('app.logout') }}</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-layout-header>
      <a-layout-content class="p-4 overflow-auto">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
```

- [ ] **Step 2: Verify**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Manual smoke check (dev server already on :5173)**

Log in, confirm a globe "语言/Language" dropdown shows top-right; switching to English changes the menu labels and the logout item; reload keeps English.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/layouts/BasicLayout.vue
git commit -m "feat(i18n): add language switcher and translate menu labels"
```

---

## Task 5: Translate runtime message strings (interceptor, crud hook)

**Files:**
- Modify: `frontend/src/utils/request.ts`
- Modify: `frontend/src/hooks/useCrudTable.ts`

- [ ] **Step 1: request.ts — use catalog messages**

In `frontend/src/utils/request.ts`, add `import { t } from '@/locales';` and replace the three literals:
- `'登录已失效，请重新登录'` → `t('common.loginExpired')`
- `res.msg || '请求失败'` → `res.msg || t('common.requestFailed')`
- `err?.message || '网络错误'` → `err?.message || t('common.networkError')`

- [ ] **Step 2: useCrudTable.ts — localize pagination total**

In `frontend/src/hooks/useCrudTable.ts`, add `import { t } from '@/locales';` and change:

```ts
showTotal: (total: number) => t('common.total', { n: total }),
```

- [ ] **Step 3: Verify**

Run: `pnpm type-check && pnpm test:unit`
Expected: PASS (existing crud-table tests still green; if a test asserted the old `共 X 条` string, update it to `t('common.total', { n })`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/request.ts frontend/src/hooks/useCrudTable.ts
git commit -m "feat(i18n): localize interceptor and pagination messages"
```

---

## Task 6: Translate shared components + error/dashboard views

**Files (each gets keys added to both catalogs under the shown namespace):**
- Modify: `frontend/src/components/ImageUpload.vue` (namespace: `common` — reuse `upload`, `remove`, `uploadImageOnly`, `uploadTooLarge`, `uploadFailed`; alt text stays literal)
- Modify: `frontend/src/components/SupplierBrandDrawer.vue` (namespace: `supplierBrand`)
- Modify: `frontend/src/components/CascadeFilter.vue` (namespace: `cascade`)
- Modify: `frontend/src/views/error/403.vue`, `404.vue` (namespace: `error`)
- Modify: `frontend/src/views/dashboard/index.vue` (namespace: `dashboard`)
- Modify: `frontend/src/locales/lang/zh-CN.ts`, `en-US.ts`

- [ ] **Step 1: Add namespaces to both catalogs**

Add to `zh-CN.ts` (and mirror in `en-US.ts` with English):

```ts
  supplierBrand: {
    title: '管理品牌授权',        // Manage Brand Authorization
    allBrands: '全部品牌',        // All Brands
    authorized: '已授权',         // Authorized
    saved: '已保存品牌授权',      // Brand authorization saved
  },
  cascade: {
    supplier: '供应商',           // Supplier
    selectSupplier: '请选择供应商', // Select a supplier
    brand: '品牌',                // Brand
    category: '分类',             // Category
    keyword: '关键字',            // Keyword
    keywordPlaceholder: '名称/编码', // Name / Code
  },
  error: {
    forbidden: '抱歉，你无权访问该页面。', // Sorry, you are not authorized to access this page.
    notFound: '抱歉，页面不存在。',        // Sorry, this page does not exist.
  },
  dashboard: {
    title: '工作台',              // Dashboard
    welcome: '欢迎，{name}。',     // Welcome, {name}.
    subtitle: 'ZokoMart 独立站后台管理系统。', // ZokoMart storefront admin system.
  },
```

- [ ] **Step 2: Edit each component/view per the Conventions rule**

Representative edits:
- `ImageUpload.vue`: `'只能上传图片文件'`→`t('common.uploadImageOnly')`; `` `图片不能超过 ${props.maxSize}MB` ``→`t('common.uploadTooLarge', { size: props.maxSize })`; `'上传失败'`→`t('common.uploadFailed')`; template `上传`→`{{ t('common.upload') }}`, `移除`→`{{ t('common.remove') }}`. Add `const { t } = useI18n()`.
- `SupplierBrandDrawer.vue`: drawer `title`→`t('supplierBrand.title')`; `:titles="[t('supplierBrand.allBrands'), t('supplierBrand.authorized')]"`; `'已保存品牌授权'`→`t('supplierBrand.saved')`; footer `取消`→`t('common.cancel')`, `保存`→`t('common.save')`.
- `CascadeFilter.vue`: labels 供应商/品牌/分类/关键字→`cascade.*`; placeholders `请选择供应商`→`t('cascade.selectSupplier')`, `名称/编码`→`t('cascade.keywordPlaceholder')`, the `全部` placeholders→`t('common.all')`; inline `启用/停用` options → `t('common.enabled')`/`t('common.disabled')` via a `computed` options array; `查询` button→`t('common.search')`.
- `403.vue`/`404.vue`: `sub-title`→`t('error.forbidden')`/`t('error.notFound')`; `返回首页`→`t('common.backHome')`. Keep numeric `title="403"`/`"404"`.
- `dashboard/index.vue`: card title→`t('dashboard.title')`; welcome line→`t('dashboard.welcome', { name: auth.user?.nickname || auth.user?.username })`; subtitle→`t('dashboard.subtitle')`.

- [ ] **Step 3: Verify**

Run: `pnpm test:unit -- locales && pnpm type-check`
Expected: PASS (key parity holds).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components frontend/src/views/error frontend/src/views/dashboard frontend/src/locales
git commit -m "feat(i18n): translate shared components and error/dashboard views"
```

---

## Task 7: EXEMPLAR — translate `views/system/user/index.vue` (full worked example)

This is the reference every remaining view task copies. **Files:** `frontend/src/views/system/user/index.vue`, both catalogs (namespace `system.user`).

- [ ] **Step 1: Add the `system.user` namespace**

`zh-CN.ts`:

```ts
  system: {
    user: {
      title: '用户',
      username: '用户名', nickname: '昵称', phone: '手机号', email: '邮箱',
      password: '密码', passwordEdit: '密码（留空不修改）',
      passwordEmptyHint: '留空表示不修改', passwordInitHint: '请输入初始密码',
      enable: '启用',
      createUser: '新增用户', editUser: '编辑用户', assignRole: '分配角色',
      assignRoleAction: '赋角色', resetPwd: '重置密码', selectRole: '选择角色',
      newPwdPlaceholder: '请输入新密码', inputNewPwd: '请输入新密码',
      inputUsername: '请输入用户名',
      toggleConfirm: '确认{action}该用户？', deleteConfirm: '确认删除该用户？',
      roleUpdated: '角色已更新', pwdReset: '密码已重置',
      usernamePlaceholder: '用户名',
    },
  },
```

`en-US.ts` (mirror):

```ts
  system: {
    user: {
      title: 'User',
      username: 'Username', nickname: 'Nickname', phone: 'Phone', email: 'Email',
      password: 'Password', passwordEdit: 'Password (leave blank to keep)',
      passwordEmptyHint: 'Leave blank to keep unchanged', passwordInitHint: 'Enter an initial password',
      enable: 'Enabled',
      createUser: 'New User', editUser: 'Edit User', assignRole: 'Assign Roles',
      assignRoleAction: 'Roles', resetPwd: 'Reset Password', selectRole: 'Select roles',
      newPwdPlaceholder: 'Enter a new password', inputNewPwd: 'Enter a new password',
      inputUsername: 'Please enter a username',
      toggleConfirm: 'Confirm to {action} this user?', deleteConfirm: 'Delete this user?',
      roleUpdated: 'Roles updated', pwdReset: 'Password reset',
      usernamePlaceholder: 'Username',
    },
  },
```

- [ ] **Step 2: Edit the view**

Add to `<script setup>`: `import { useI18n } from 'vue-i18n'; const { t } = useI18n();`

Wrap `columns` in a `computed` (so headers re-translate):

```ts
const columns = computed<TableColumnsType>(() => [
  { title: t('system.user.username'), dataIndex: 'username', key: 'username' },
  { title: t('system.user.nickname'), dataIndex: 'nickname', key: 'nickname' },
  { title: t('system.user.phone'), dataIndex: 'phone', key: 'phone' },
  { title: t('system.user.email'), dataIndex: 'email', key: 'email' },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 90 },
  { title: t('common.createTime'), dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: t('common.operation'), key: 'action', width: 280 },
]);
```

`formSchema` is already a `computed` — translate its `label`/`placeholder`/`rules[].message`:

```ts
const formSchema = computed<FormField[]>(() => [
  { field: 'username', label: t('system.user.username'), component: 'input',
    rules: [{ required: true, message: t('system.user.inputUsername') }] },
  { field: 'password',
    label: editingId.value ? t('system.user.passwordEdit') : t('system.user.password'),
    component: 'password',
    placeholder: editingId.value ? t('system.user.passwordEmptyHint') : t('system.user.passwordInitHint'),
    rules: editingId.value ? [] : [{ required: true, message: t('system.user.passwordInitHint') }] },
  { field: 'nickname', label: t('system.user.nickname'), component: 'input' },
  { field: 'phone', label: t('system.user.phone'), component: 'input' },
  { field: 'email', label: t('system.user.email'), component: 'input' },
  { field: 'status', label: t('system.user.enable'), component: 'switch' },
  { field: 'remark', label: t('common.remark'), component: 'textarea' },
]);
```

Script messages: `'保存成功'`→`t('common.saveSuccess')`; `'操作成功'`→`t('common.operateSuccess')`; `'已删除'`→`t('common.deleteSuccess')`; `'角色已更新'`→`t('system.user.roleUpdated')`; `'请输入新密码'` (warning)→`t('system.user.inputNewPwd')`; `'密码已重置'`→`t('system.user.pwdReset')`.

Template literals:
- search label `用户名`→`t('system.user.username')`, placeholder `用户名`→`t('system.user.usernamePlaceholder')`
- status label `状态`→`t('common.status')`; select placeholder `全部`→`t('common.all')`; options `启用/停用`→ build a `computed` options array using `t('common.enabled')`/`t('common.disabled')`
- `查询`→`t('common.search')`, `重置`→`t('common.reset')`
- `新增用户`→`t('system.user.createUser')`
- status tag `启用/停用`→`t('common.enabled')`/`t('common.disabled')`
- action links `编辑`→`t('common.edit')`, `赋角色`→`t('system.user.assignRoleAction')`, `重置密码`→`t('system.user.resetPwd')`, `删除`→`t('common.delete')`
- toggle popconfirm `` `确认${...}该用户？` ``→`t('system.user.toggleConfirm', { action: record.status === 1 ? t('common.disabled') : t('common.enabled') })`; and the link text `停用/启用`→ same enabled/disabled keys
- delete popconfirm `确认删除该用户？`→`t('system.user.deleteConfirm')`
- modal title `编辑用户/新增用户`→`t('system.user.editUser')`/`t('system.user.createUser')`
- roles modal title `分配角色`→`t('system.user.assignRole')`; select placeholder `选择角色`→`t('system.user.selectRole')`
- pwd modal title `重置密码`→`t('system.user.resetPwd')`; input placeholder `请输入新密码`→`t('system.user.newPwdPlaceholder')`

- [ ] **Step 3: Verify**

Run: `pnpm test:unit -- locales && pnpm type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/system/user/index.vue frontend/src/locales
git commit -m "feat(i18n): translate system/user view (exemplar)"
```

---

## Tasks 8–19: Translate remaining views (apply Task 7 pattern)

Each task below targets one file (or small group), adds its namespace to **both** catalogs, replaces every user-facing literal per the Conventions rule and Glossary, then: `pnpm test:unit -- locales && pnpm type-check` (both PASS) and commits `feat(i18n): translate <area>`. Read the source file first; extract **every** Chinese literal (the parity test + a manual scan for remaining CJK confirm completeness — run `git grep -nP "[\\x{4e00}-\\x{9fff}]" -- <file>` and confirm only comments remain).

- [ ] **Task 8 — `system/role/index.vue`** (namespace `system.role`)
- [ ] **Task 9 — `system/menu/index.vue`** (namespace `system.menu`)
- [ ] **Task 10 — `login/index.vue`** (namespace `login`; keys `username`,`password`,`submit` already exist; add placeholder keys as needed; keep `superadmin` placeholder literal)
- [ ] **Task 11 — `customer/index.vue`** (namespace `customer`): columns 客户姓名/电话/地址/订单数/累计金额 (GHS)/最近下单时间; keyword label + placeholder `客户姓名 / 电话`; `查询`/`重置` from `common`
- [ ] **Task 12 — `basedata/brand/index.vue`** (namespace `basedata.brand`)
- [ ] **Task 13 — `basedata/category/index.vue`** (namespace `basedata.category`)
- [ ] **Task 14 — `basedata/supplier/index.vue`** (namespace `basedata.supplier`)
- [ ] **Task 15 — `basedata/logistics-provider/index.vue`** (namespace `basedata.logisticsProvider`)
- [ ] **Task 16 — product module** (one commit): `product/spu/index.vue` (`product.spu`), `product/sku/index.vue` (`product.sku`), `product/supplier-product/index.vue` + `SupplierProductImportModal.vue` + `SupplierProductScrapeModal.vue` + `SupplierProductWcSyncModal.vue` (`product.supplierProduct`)
- [ ] **Task 17 — purchase module** (one commit): `purchase/plan/index.vue` (`purchase.plan`), `purchase/order/index.vue` (`purchase.order`)
- [ ] **Task 18 — inventory + sales** (one commit): `inventory/stock/index.vue` (`inventory.stock`), `sales/order/index.vue` + `sales/order/LabelPrintDrawer.vue` (`sales.order`); also `utils/label/packageLabel.ts` and `utils/label/print.ts` if they emit user-facing strings (namespace `sales.label`)
- [ ] **Task 19 — `logistics/track/index.vue`** (namespace `logistics.track`)

> These are grouped by domain to keep commits coherent; within a task, translate each file fully before committing. If any file surfaces a term not in the Glossary, add it there in the same commit.

---

## Task 20: Playwright e2e — switch + persistence

**Files:**
- Create: `frontend/tests/e2e/i18n.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

// Assumes the existing e2e login helper/pattern in this repo; adapt selectors
// to match tests/e2e conventions (reuse the login flow used by other specs).
test('user can switch to English and it persists across reload', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('superadmin').fill('superadmin');
  await page.locator('input[type="password"]').fill(process.env.E2E_ADMIN_PWD || 'admin123');
  await page.getByRole('button', { name: /登录|Log In/ }).click();
  await page.waitForURL('**/*');

  // Open language dropdown, choose English
  await page.locator('[data-test="lang-switch"]').click();
  await page.locator('[data-test="lang-en-US"]').click();

  // A known menu label is now English
  await expect(page.getByRole('menuitem', { name: 'Users' }).first()).toBeVisible();

  // Persist across reload
  await page.reload();
  await expect(page.getByRole('menuitem', { name: 'Users' }).first()).toBeVisible();
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e -- i18n`
Expected: PASS. (Adjust login selectors/credentials to the repo's existing e2e helper if this differs.)

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/i18n.spec.ts
git commit -m "test(i18n): e2e language switch and persistence"
```

---

## Task 21: Final verification

- [ ] **Step 1: Full unit suite + type check + build**

Run: `pnpm test:unit && pnpm type-check && pnpm build`
Expected: all PASS; build succeeds.

- [ ] **Step 2: Residual-CJK scan (user-facing files only)**

Run: `git grep -nP "[\\x{4e00}-\\x{9fff}]" -- 'frontend/src/views/**/*.vue' 'frontend/src/components/**/*.vue' 'frontend/src/layouts/**/*.vue'`
Expected: only comments remain (no template/label/message literals). Fix any stragglers, re-run Task 21 Step 1, commit.

- [ ] **Step 3: Manual smoke on :5173**

Log in; toggle 中文/English; spot-check one page per module (system, basedata, product, purchase, inventory, sales, logistics, customer, dashboard) plus login page in both languages, plus a toast (e.g. save) and a table pagination footer. Reload to confirm persistence.

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch to open a PR against `frontend`'s `main`.

---

## Self-review notes

- **Spec coverage:** library (T1), persistence/localStorage (T1 `setLocale`), antd locale (T3), menu map by route path w/ fallback (T1 menu.ts, T4), switcher top-right (T4), full view coverage (T6–T19), runtime messages (T5), key-parity + fallback unit tests (T1), e2e switch+persist (T20). All spec sections mapped.
- **No backend/DB changes** — consistent with spec non-goals.
- **Type consistency:** `setLocale`/`currentLocale`/`antdLocale`/`menuLabel`/`SUPPORTED_LOCALES` defined in T1 and used unchanged in T2–T4.
- **Known follow-up:** exact menu `routePath` keys in `menu.ts` must be reconciled against live `auth.menus` during T1 Step 4 / T4 smoke check (fallback keeps UI safe if any mismatch).
