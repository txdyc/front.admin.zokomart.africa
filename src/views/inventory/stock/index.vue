<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import CascadeFilter from '@/components/CascadeFilter.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import { apiStockPage, apiStockAdjust } from '@/api/inventory/stock';
import type { InventoryStockVO, StockAdjustDTO, InventoryStockQuery } from '@/types/inventory';
import type { Id } from '@/types/api';

const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

const filter = ref<InventoryStockQuery>({});
const query = ref<Record<string, any>>({});
const onFilterChange = (v: InventoryStockQuery) => (query.value = { ...v });

const columns: TableColumnsType = [
  { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 150 },
  { title: '品牌', dataIndex: 'brandName', key: 'brandName', width: 120 },
  { title: '分类', dataIndex: 'categoryName', key: 'categoryName', width: 140 },
  { title: '产品', dataIndex: 'productName', key: 'productName' },
  { title: '编码', dataIndex: 'productCode', key: 'productCode', width: 130 },
  { title: '当前库存', dataIndex: 'quantity', key: 'quantity', width: 100 },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime', width: 180 },
  { title: '操作', key: 'action', width: 90 },
];

const formSchema: FormField[] = [
  {
    field: 'quantity',
    label: '目标库存数量',
    component: 'number',
    props: { min: 0, precision: 0 },
    rules: [
      { required: true, message: '请输入目标库存数量' },
      { type: 'number', min: 0, message: '库存数量不能为负' },
    ],
  },
  { field: 'remark', label: '备注', component: 'textarea', placeholder: '调整原因（可选）' },
];

const modalOpen = ref(false);
const target = ref<InventoryStockVO | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

function openAdjust(row: InventoryStockVO) {
  target.value = row;
  formInitial.value = { quantity: row.quantity, remark: undefined };
  modalOpen.value = true;
}

const modalTitle = computed(() =>
  target.value ? `调整库存 - ${target.value.productName}` : '调整库存',
);

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as StockAdjustDTO;
  // 业务兜底校验（与后端 @Min(0) 一致）
  if (payload.quantity == null || payload.quantity < 0) {
    message.warning('库存数量不能为负');
    return;
  }
  submitting.value = true;
  try {
    await apiStockAdjust(target.value!.supplierProductId, payload);
    message.success('库存已调整');
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

defineExpose({ openAdjust, onSubmit });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <CascadeFilter v-model="filter" @change="onFilterChange" />
    </a-card>

    <a-card :bordered="false">
      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiStockPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'brandName'">{{ record.brandName ?? '—' }}</template>
          <template v-else-if="column.key === 'categoryName'">{{ record.categoryName ?? '—' }}</template>
          <template v-else-if="column.key === 'quantity'">
            <b>{{ record.quantity }}</b>
          </template>
          <template v-else-if="column.key === 'action'">
            <a v-perm="'inventory:edit'" data-test="stock-adjust" @click="openAdjust(record as InventoryStockVO)">调整</a>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </div>
</template>
