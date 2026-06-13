// Vitest 全局环境补丁：jsdom 缺少 antd 组件用到的浏览器 API。
import { vi } from 'vitest';

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
