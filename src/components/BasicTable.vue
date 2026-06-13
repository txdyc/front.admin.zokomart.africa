<script setup lang="ts">
import { onMounted, watch } from 'vue';
import type { TableColumnsType } from 'ant-design-vue';
import type { PageResult } from '@/types/api';
import { useCrudTable } from '@/hooks/useCrudTable';

const props = withDefaults(
  defineProps<{
    columns: TableColumnsType;
    fetcher: (params: Record<string, any>) => Promise<PageResult<any>>;
    /** 外部筛选条件，变化时自动回到第 1 页重查 */
    params?: Record<string, any>;
    rowKey?: string;
    defaultSize?: number;
  }>(),
  { params: () => ({}), rowKey: 'id', defaultSize: 10 },
);

const { loading, dataSource, pagination, load, reload } = useCrudTable(
  (p) => props.fetcher({ ...p, ...props.params }),
  { immediate: false, defaultSize: props.defaultSize },
);

onMounted(load);
watch(
  () => props.params,
  () => reload(),
  { deep: true },
);

defineExpose({ reload, load });
</script>

<template>
  <a-table
    :columns="columns"
    :data-source="dataSource"
    :loading="loading"
    :pagination="pagination"
    :row-key="rowKey"
    size="middle"
    @change="(pag: any) => { pagination.current = pag.current; pagination.pageSize = pag.pageSize; load(); }"
  >
    <template #bodyCell="slotProps">
      <slot name="bodyCell" v-bind="slotProps" />
    </template>
  </a-table>
</template>
