import { reactive, ref, type Ref } from 'vue';
import type { PageResult } from '@/types/api';
import { t } from '@/locales';

export interface CrudTableOptions {
  defaultSize?: number;
  /** 是否在创建时立即加载（页面用 true，测试用 false） */
  immediate?: boolean;
}

/**
 * 列表分页/筛选/加载通用逻辑。把后端 PageResult 映射为 antd a-table 的 pagination。
 *
 * @param fetcher 接收 `{ current, size, ...filters }`，返回后端 PageResult
 */
export function useCrudTable<T = any>(
  fetcher: (params: Record<string, any>) => Promise<PageResult<T>>,
  options: CrudTableOptions = {},
) {
  const { defaultSize = 10, immediate = true } = options;

  const loading = ref(false);
  const dataSource = ref<T[]>([]) as Ref<T[]>;
  const filters = reactive<Record<string, any>>({});
  const pagination = reactive({
    current: 1,
    pageSize: defaultSize,
    total: 0,
    showSizeChanger: true,
    showTotal: (total: number) => t('common.total', { n: total }),
  });

  async function load() {
    loading.value = true;
    try {
      const params = { current: pagination.current, size: pagination.pageSize, ...filters };
      const res = await fetcher(params);
      dataSource.value = res.records ?? [];
      pagination.total = res.total ?? 0;
    } finally {
      loading.value = false;
    }
  }

  /** 重置到第一页并加载（筛选条件变化、增删改后调用） */
  async function reload() {
    pagination.current = 1;
    await load();
  }

  /** a-table @change：分页变化时同步页码/每页并重新加载 */
  async function handleTableChange(pag: { current?: number; pageSize?: number }) {
    if (pag.current) pagination.current = pag.current;
    if (pag.pageSize) pagination.pageSize = pag.pageSize;
    await load();
  }

  if (immediate) void load();

  return { loading, dataSource, filters, pagination, load, reload, handleTableChange };
}
