import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ant-design-vue', () => ({ message: { error: vi.fn(), success: vi.fn() } }));

import { request } from '@/utils/request';
import { getToken, setToken } from '@/utils/token';

// 用自定义 adapter 伪造后端响应，验证拦截器契约（无需真实网络/额外 mock 库）。
function mockResponse(body: unknown) {
  request.defaults.adapter = async (config: any) => ({
    data: body,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
}

describe('request 拦截器（成功判据 code===0）', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
  });

  it('code===0 返回 data 本体', async () => {
    mockResponse({ code: 0, msg: 'success', data: { x: 1 } });
    const d = await request.get('/x');
    expect(d).toEqual({ x: 1 });
  });

  it('code!==0 时 reject 并带 msg', async () => {
    mockResponse({ code: 500, msg: 'boom', data: null });
    await expect(request.get('/x')).rejects.toThrow('boom');
  });

  it('code===401 清除 token 并 reject', async () => {
    setToken('t1');
    mockResponse({ code: 401, msg: 'unauthorized', data: null });
    await expect(request.get('/x')).rejects.toBeTruthy();
    expect(getToken()).toBe('');
  });

  it('请求头携带原始 token', async () => {
    setToken('raw-token-123');
    let sent = '';
    request.defaults.adapter = async (config: any) => {
      sent = config.headers.Authorization;
      return { data: { code: 0, msg: 'ok', data: null }, status: 200, statusText: 'OK', headers: {}, config };
    };
    await request.get('/x');
    expect(sent).toBe('raw-token-123');
  });
});
