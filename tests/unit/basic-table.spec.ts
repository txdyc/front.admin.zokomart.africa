import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BasicTable from '@/components/BasicTable.vue';
import type { PageResult } from '@/types/api';

const columns = [{ title: '名称', dataIndex: 'name', key: 'name' }];

function pageOf(records: any[], total: number): PageResult<any> {
  return { records, total, current: 1, size: 10 };
}

describe('BasicTable', () => {
  it('挂载即用 fetcher 加载并渲染数据行与总数', async () => {
    const fetcher = vi.fn(async () => pageOf([{ id: 1, name: 'A' }, { id: 2, name: 'B' }], 2));
    const wrapper = mount(BasicTable, { props: { columns, fetcher } });
    await flushPromises();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('.ant-table-row')).toHaveLength(2);
    expect(wrapper.text()).toContain('A');
  });

  it('暴露 reload()：合并 params 后重新拉取', async () => {
    const fetcher = vi.fn(async () => pageOf([], 0));
    const wrapper = mount(BasicTable, {
      props: { columns, fetcher, params: { status: 1 } },
    });
    await flushPromises();
    (wrapper.vm as any).reload();
    await flushPromises();

    expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ status: 1, current: 1 }));
  });
});
