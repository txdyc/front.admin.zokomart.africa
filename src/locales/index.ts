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
