<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { apiSalesOrderImport } from '@/api/sales/order';
import type { SalesOrderImportResult } from '@/types/sales';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ 'update:visible': [boolean]; ok: [] }>();

const { t } = useI18n();

const file = ref<File | null>(null);
const result = ref<SalesOrderImportResult | null>(null);
const submitting = ref(false);

// 后缀校验放在前端，避免把明显不对的文件发到后端只换回一句笼统的 40009
const beforeUpload = (f: File) => {
  if (!f.name.toLowerCase().endsWith('.xlsx')) {
    message.warning(t('sales.order.xlsxOnly'));
    return false;
  }
  file.value = f;
  result.value = null;
  return false; // 阻止 a-upload 自动上传，由 onSubmit 手动提交
};

const onSubmit = async () => {
  if (!file.value) {
    message.warning(t('sales.order.selectXlsx'));
    return;
  }
  const form = new FormData();
  form.append('file', file.value);
  submitting.value = true;
  try {
    result.value = await apiSalesOrderImport(form);
    message.success(
      t('sales.order.importDone', {
        success: result.value.success,
        skipped: result.value.skipped,
        failed: result.value.failed,
      }),
    );
    emit('ok');
    file.value = null;
  } finally {
    submitting.value = false;
  }
};

const close = () => {
  emit('update:visible', false);
  file.value = null;
  result.value = null;
};

const errorColumns = [
  { title: t('sales.order.errRows'), dataIndex: 'rows', key: 'rows', width: 110 },
  { title: t('sales.order.errOrderIds'), dataIndex: 'externalOrderIds', key: 'externalOrderIds', width: 160 },
  { title: t('sales.order.errCustomer'), dataIndex: 'customerName', key: 'customerName', width: 140 },
  { title: t('sales.order.errCode'), dataIndex: 'productCode', key: 'productCode', width: 120 },
  { title: t('sales.order.errReason'), dataIndex: 'reason', key: 'reason' },
];

defineExpose({ file, beforeUpload, onSubmit, result });
</script>

<template>
  <a-modal
    :open="props.visible"
    :title="t('sales.order.importTitle')"
    :footer="null"
    :mask-closable="false"
    width="860"
    @cancel="close"
  >
    <a-space direction="vertical" style="width: 100%">
      <a-alert type="info" show-icon :message="t('sales.order.columnsHint')" />

      <a-upload :before-upload="beforeUpload" :max-count="1" accept=".xlsx">
        <a-button data-test="sales-import-pick">{{ t('sales.order.pickXlsx') }}</a-button>
      </a-upload>

      <a-button
        type="primary"
        :loading="submitting"
        :disabled="!file"
        data-test="sales-import-submit"
        @click="onSubmit"
      >
        {{ t('sales.order.startImport') }}
      </a-button>

      <template v-if="result">
        <a-space>
          <a-tag>{{ t('sales.order.resTotalRows') }}: {{ result.totalRows }}</a-tag>
          <a-tag color="blue">{{ t('sales.order.resOrderCount') }}: {{ result.orderCount }}</a-tag>
          <a-tag color="green">{{ t('sales.order.resSuccess') }}: {{ result.success }}</a-tag>
          <a-tag color="orange">{{ t('sales.order.resSkipped') }}: {{ result.skipped }}</a-tag>
          <a-tag color="red">{{ t('sales.order.resFailed') }}: {{ result.failed }}</a-tag>
        </a-space>
        <a-table
          v-if="result.errors.length"
          :columns="errorColumns"
          :data-source="result.errors"
          :pagination="false"
          :scroll="{ y: 280 }"
          row-key="rows"
          size="small"
          data-test="sales-import-errors"
        />
      </template>
    </a-space>
  </a-modal>
</template>
