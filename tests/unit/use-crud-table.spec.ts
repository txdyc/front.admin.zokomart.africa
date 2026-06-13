import { describe, it, expect, vi } from 'vitest';
import { useCrudTable } from '@/hooks/useCrudTable';
import type { PageResult } from '@/types/api';

function pageOf<T>(records: T[], total: number, current = 1, size = 10): PageResult<T> {
  return { records, total, current, size };
}

describe('useCrudTable', () => {
  it('load() 用 current/size/filters 调 fetch 并映射结果到 dataSource 与 pagination.total', async () => {
    const fetcher = vi.fn(async () => pageOf([{ id: 1 }, { id: 2 }], 25));
    const t = useCrudTable(fetcher, { immediate: false });
    t.filters.keyword = 'abc';

    await t.load();

    expect(fetcher).toHaveBeenCalledWith({ current: 1, size: 10, keyword: 'abc' });
    expect(t.dataSource.value).toHaveLength(2);
    expect(t.pagination.total).toBe(25);
    expect(t.loading.value).toBe(false);
  });

  it('reload() 把页码重置到 1 后再加载', async () => {
    const fetcher = vi.fn(async () => pageOf([], 0));
    const t = useCrudTable(fetcher, { immediate: false });
    t.pagination.current = 5;

    await t.reload();

    expect(t.pagination.current).toBe(1);
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ current: 1, size: 10 }));
  });

  it('handleTableChange 更新页码/每页后重新加载', async () => {
    const fetcher = vi.fn(async () => pageOf([], 0));
    const t = useCrudTable(fetcher, { immediate: false });

    await t.handleTableChange({ current: 3, pageSize: 20 });

    expect(t.pagination.current).toBe(3);
    expect(t.pagination.pageSize).toBe(20);
    expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ current: 3, size: 20 }));
  });
});
