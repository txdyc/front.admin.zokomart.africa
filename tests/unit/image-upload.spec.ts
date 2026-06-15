import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/api/file', () => ({
  apiUploadImage: vi.fn(async () => ({ url: '/files/brand/abc.png' })),
}));

import { apiUploadImage } from '@/api/file';
import ImageUpload from '@/components/ImageUpload.vue';

const mountOpts = {
  global: { stubs: { 'a-upload': true, 'plus-outlined': true, 'loading-outlined': true } },
};

describe('ImageUpload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('customRequest 上传成功后 emit update:value 携带返回 url', async () => {
    const wrapper = mount(ImageUpload, { props: { category: 'brand' }, ...mountOpts });
    const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' });
    await (wrapper.vm as any).customRequest({ file, onSuccess: vi.fn(), onError: vi.fn() });
    expect(apiUploadImage).toHaveBeenCalledWith(file, 'brand');
    expect(wrapper.emitted('update:value')?.[0]).toEqual(['/files/brand/abc.png']);
  });

  it('beforeUpload 拦截非图片与超限文件、放行正常图片', () => {
    const wrapper = mount(ImageUpload, { props: { maxSize: 1 }, ...mountOpts });
    const txt = new File(['x'], 'x.txt', { type: 'text/plain' });
    expect((wrapper.vm as any).beforeUpload(txt)).toBe(false);
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    expect((wrapper.vm as any).beforeUpload(big)).toBe(false);
    const ok = new File([new Uint8Array(10)], 'ok.png', { type: 'image/png' });
    expect((wrapper.vm as any).beforeUpload(ok)).toBe(true);
  });
});
