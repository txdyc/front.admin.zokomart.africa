<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import CascadeFilter from '@/components/CascadeFilter.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import { apiStockPage, apiStockAdjust } from '@/api/inventory/stock';
import type { InventoryStockVO, StockAdjustDTO, InventoryStockQuery } from '@/types/inventory';
import type { Id } from '@/types/api';

const { t } = useI18n();
const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

const filter = ref<InventoryStockQuery>({});
const query = ref<Record<string, any>>({});
const onFilterChange = (v: InventoryStockQuery) => (query.value = { ...v });

const columns = computed<TableColumnsType>(() => [
  { title: t('common.supplier'), dataIndex: 'supplierName', key: 'supplierName', width: 150 },
  { title: t('inventory.stock.brand'), dataIndex: 'brandName', key: 'brandName', width: 120 },
  { title: t('inventory.stock.category'), dataIndex: 'categoryName', key: 'categoryName', width: 140 },
  { title: t('inventory.stock.product'), dataIndex: 'productName', key: 'productName' },
  { title: t('common.code'), dataIndex: 'productCode', key: 'productCode', width: 130 },
  { title: t('inventory.stock.currentStock'), dataIndex: 'quantity', key: 'quantity', width: 100 },
  { title: t('common.updateTime'), dataIndex: 'updateTime', key: 'updateTime', width: 180 },
  { title: t('common.operation'), key: 'action', width: 90 },
]);

const formSchema = computed<FormField[]>(() => [
  {
    field: 'quantity',
    label: t('inventory.stock.targetQty'),
    component: 'number',
    props: { min: 0, precision: 0 },
    rules: [
      { required: true, message: t('inventory.stock.inputTargetQty') },
      { type: 'number', min: 0, message: t('inventory.stock.cannotBeNegative') },
    ],
  },
  { field: 'remark', label: t('common.remark'), component: 'textarea', placeholder: t('inventory.stock.adjustReasonPlaceholder') },
]);

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
  target.value
    ? t('inventory.stock.adjustTitleNamed', { name: target.value.productName })
    : t('inventory.stock.adjustTitle'),
);

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as StockAdjustDTO;
  // 业务兜底校验（与后端 @Min(0) 一致）
  if (payload.quantity == null || payload.quantity < 0) {
    message.warning(t('inventory.stock.cannotBeNegative'));
    return;
  }
  submitting.value = true;
  try {
    await apiStockAdjust(target.value!.supplierProductId, payload);
    message.success(t('inventory.stock.stockAdjusted'));
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
            <a v-perm="'inventory:edit'" data-test="stock-adjust" @click="openAdjust(record as InventoryStockVO)">{{ t('inventory.stock.adjust') }}</a>
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
