# i18n (Chinese ⇄ English) Language Switching — Design

- **Date:** 2026-07-07
- **Repo:** `frontend/` (front.admin.zokomart.africa.git)
- **Status:** Approved, pending implementation plan

## Goal

After logging in, users can switch the entire admin UI between **Chinese (zh-CN)** and
**English (en-US)** via a "Language" control in the top-right header. All buttons, menus,
prompts, form labels, table columns, and messages switch accordingly. The chosen language
is remembered across sessions.

## Decisions (locked)

| Question | Decision |
|----------|----------|
| Menu/permission label translation | **Frontend map keyed by route path** (no backend/DB change). Directory nodes without a `routePath` are keyed by their Chinese `name`. Fallback to raw DB name. |
| Persistence | **Browser `localStorage`** (`zoko-locale`). No backend/user-profile change. |
| Coverage | **Full, one pass** — shell, login, and all `src/views/*`. |

## Library & Layers

- **`vue-i18n@9`** (Composition API mode) for all application strings.
- **Ant Design Vue** internal component text (pagination, empty, date pickers, `a-table`
  internals) driven separately via `<a-config-provider :locale>` so both layers switch
  together.

## Architecture

### 1. Locale module — `src/locales/`

```
src/locales/
├── index.ts              # createI18n instance; current-locale state;
│                         #   setLocale() → updates vue-i18n locale + localStorage + antd locale ref;
│                         #   initLocale() → read localStorage, default 'zh-CN';
│                         #   exports i18n, t, antdLocale (reactive), supported locales list
├── menu.ts               # route-path → label map for backend-driven menus + menuLabel(node) helper
└── lang/
    ├── zh-CN.ts          # namespaced messages
    └── en-US.ts          # mirror of zh-CN keys
```

Messages are **namespaced by module**, mirroring `src/views/*`:
`common`, `login`, `dashboard`, `system`, `basedata`, `product`, `purchase`,
`inventory`, `sales`, `logistics`, `customer`.
Shared verbs/labels (`save`, `cancel`, `edit`, `delete`, `confirm`, `search`, `create`,
`operation`, success/fail toasts) live under `common`.

Usage: `t('common.save')`, `t('system.user.title')`, `t('login.username')`.

### 2. Persistence & data flow

- Locale persisted to `localStorage['zoko-locale']`.
- `initLocale()` runs **before** `app.mount()` so the first paint — including the login
  page — is already in the remembered language.
- `setLocale(l)`:
  1. sets `i18n.global.locale`,
  2. writes `localStorage`,
  3. updates a reactive `antdLocale` ref consumed by `<a-config-provider>` in `App.vue`.
- Browser-local only; no API/Accept-Language change.

### 3. Menu labels (backend-driven)

`menu.ts` exports:

```ts
const menuMap: Record<Locale, Record<string, string>> = {
  'zh-CN': { /* usually empty — DB is already Chinese */ },
  'en-US': { '/system/user': 'User Management', '系统管理': 'System Management', ... },
};
export function menuLabel(node): string {
  const map = menuMap[currentLocale.value];
  return map[node.routePath] ?? map[node.name] ?? node.name;
}
```

- Leaf menus keyed by `routePath`; directories (no `routePath`) keyed by Chinese `name`.
- DB untouched; unmapped entries fall back to the raw DB name.

### 4. Language switcher

- Globe-icon dropdown added to the top-right of `BasicLayout.vue` header, left of the
  existing user dropdown: options `中文` / `English`.
- Selecting an option calls `setLocale`.

### 5. Translation coverage (full, one pass)

Replace every user-facing string with `t(...)`:

- All `.vue` templates under `src/views/*` (titles, table columns, form labels,
  placeholders, buttons, tags, empty/confirm text) and shared components
  (`BasicTable`, `SchemaForm`, `CascadeFilter`, `ImageUpload`, `SupplierBrandDrawer`).
- Runtime message strings: `utils/request.ts` toasts, `hooks/useCrudTable.ts`,
  `store/auth.ts`, `utils/label/*`, error views (`403`, `404`).

**Not touched:** code comments in `*.d.ts` and `api/*.ts` (not user-facing).

## Testing

- **Vitest (unit):**
  - `setLocale` persists to `localStorage` and switches `i18n.global.locale`.
  - `menuLabel` fallback chain (`routePath` → `name` → raw).
  - **Key-parity test:** `zh-CN` and `en-US` message trees have identical key sets
    (guards against missed strings across 25+ views).
- **Playwright (e2e):**
  - Login → switch to English → assert a known menu item + a known button render in
    English → reload → still English (persistence).

## Non-goals

- No backend changes, no DB migration.
- No server-side / per-user language preference.
- No third language.
- No RTL support.
