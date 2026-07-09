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
