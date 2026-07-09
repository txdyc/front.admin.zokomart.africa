<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { apiRawOrderImport } from '@/api/order/rawOrder';
import type { RawOrderImportResult } from '@/types/order';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ 'update:visible': [boolean]; ok: [] }>();

const { t } = useI18n();

const file = ref<File | null>(null);
const result = ref<RawOrderImportResult | null>(null);
const submitting = ref(false);

const beforeUpload = (f: File) => {
  file.value = f;
  result.value = null;
  return false; // 阻止 a-upload 自动上传，由 onSubmit 手动提交
};

const onSubmit = async () => {
  if (!file.value) {
    message.warning(t('rawOrder.selectCsv'));
    return;
  }
  const form = new FormData();
  form.append('file', file.value);
  submitting.value = true;
  try {
    result.value = await apiRawOrderImport(form);
    message.success(
      t('rawOrder.importDone', { success: result.value.success, failed: result.value.failed }),
    );
    emit('ok');
    file.value = null;
  } finally {
    submitting.value = false;
  }
};

const TEMPLATE_HEADER =
  'date,brand,price,customer_name,city,address,telephone,product_name,product_code,quantity,status,cod,freight,balance';
const downloadTemplate = async () => {
  const blob = new Blob(['\uFEFF' + TEMPLATE_HEADER + '\n'], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'raw-order-template.csv';
  a.click();
  URL.revokeObjectURL(url);
  return url;
};

const close = () => {
  emit('update:visible', false);
  file.value = null;
  result.value = null;
};

defineExpose({ file, beforeUpload, onSubmit, result, downloadTemplate });
</script>

<template>
  <a-modal
    :open="props.visible"
    :title="t('rawOrder.importTitle')"
    :footer="null"
    :mask-closable="false"
    @cancel="close"
  >
    <a-space direction="vertical" style="width: 100%">
      <a-upload
        :before-upload="beforeUpload"
        :max-count="1"
        accept=".csv"
      >
        <a-button>{{ t('rawOrder.pickCsv') }}</a-button>
      </a-upload>
      <a-button type="link" @click="downloadTemplate">{{ t('rawOrder.downloadTemplate') }}</a-button>
      <a-button type="primary" :loading="submitting" @click="onSubmit">
        {{ t('rawOrder.startImport') }}
      </a-button>

      <template v-if="result">
        <a-alert
          type="success"
          :message="t('rawOrder.importDone', { success: result.success, failed: result.failed })"
        />
        <a-table
          v-if="result.errors.length"
          :data-source="result.errors"
          :pagination="false"
          row-key="row"
          size="small"
        >
          <a-table-column :title="t('rawOrder.rowNo')" data-index="row" :width="80" />
          <a-table-column :title="t('rawOrder.productCode')" data-index="productCode" :width="140" />
          <a-table-column :title="t('rawOrder.reason')" data-index="reason" />
        </a-table>
      </template>
    </a-space>
  </a-modal>
</template>
