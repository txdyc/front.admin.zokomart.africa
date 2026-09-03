import { describe, it, expect, vi, beforeEach } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn(async () => ({ data: { code: 0, data: null } })) }));
vi.mock('@/utils/request', () => ({
  http: {
    get: vi.fn(async () => null),
    post: vi.fn(async () => null),
    put: vi.fn(async () => null),
    del: vi.fn(async () => null),
  },
  request: { post },
}));

import { apiAdGenerate, apiAdDiscard } from '@/api/ad';
import { http } from '@/utils/request';

describe('api/ad', () => {
  beforeEach(() => vi.clearAllMocks());

  it('apiAdGenerate 走 request.post 且单独放宽超时 120s', async () => {
    await apiAdGenerate({ modelId: '1', prompt: 'p', sourceImageUrls: [], count: 1 });
    expect(post).toHaveBeenCalledWith(
      '/ad/images/generate',
      expect.objectContaining({ prompt: 'p' }),
      expect.objectContaining({ timeout: 120_000 }),
    );
  });

  it('apiAdDiscard 包装 tempUrls 请求体', async () => {
    await apiAdDiscard(['/files/ad-temp/a.png']);
    expect(http.post).toHaveBeenCalledWith('/ad/images/discard', {
      tempUrls: ['/files/ad-temp/a.png'],
    });
  });
});