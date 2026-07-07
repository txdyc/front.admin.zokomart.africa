// Vitest 全局环境补丁：jsdom 缺少 antd 组件用到的浏览器 API。
import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import { i18n } from '@/locales';

// 组件用 useI18n() 需要注入 i18n 插件，测试挂载时全局注册。
config.global.plugins = [...(config.global.plugins ?? []), i18n];

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // 旧 API
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (!('ResizeObserver' in window)) {
  (window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// 抑制 jsdom 对 antd 表格滚动条测量调用 getComputedStyle 的 "Not implemented" 噪声（非测试失败）。
const origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  if (msg.includes('Not implemented: window.getComputedStyle')) return;
  origError(...args);
};

// async-validator 在校验失败用例中会 warn 出规则信息，属预期噪声。
const origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  if (msg.startsWith('async-validator:')) return;
  origWarn(...args);
};
