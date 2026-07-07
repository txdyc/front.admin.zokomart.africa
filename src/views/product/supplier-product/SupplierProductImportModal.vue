<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { UploadProps } from 'ant-design-vue';
import type { SelectOption } from '@/components/SchemaForm.vue';
import { apiSupplierProductImport } from '@/api/product/supplierProduct';
import { apiAuthorizedBrands } from '@/api/basedata/supplierBrand';
import type { ImportMode, SupplierProductImportResult } from '@/types/product';
import type { Id } from '@/types/api';

const props = defineProps<{
  open: boolean;
  supplierOptions: SelectOption[];
  defaultSupplierId?: Id | null;
}>();
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'imported'): void;
}>();

const { t } = useI18n();

// CSV 模板表头/示例行是与后端解析约定的数据契约（后端按中文表头名解析），不作 UI 翻译。
const TEMPLATE_HEADERS = ['产品名称', '产品编码', '分类路径', '批发价', '零售价', '最小采购量', '图片URL', '备注'];

const form = reactive<{ supplierId?: Id; brandId?: Id; mode: ImportMode }>({ mode: 'skip' });
const brandOptions = ref<SelectOption[]>([]);
const file = ref<File | null>(null);
const submitting = ref(false);
const result = ref<SupplierProductImportResult | null>(null);

async function loadBrands(supplierId?: Id) {
  brandOptions.value = [];
  form.brandId = undefined;
  if (supplierId == null) return;
  const list = await apiAuthorizedBrands(supplierId);
  brandOptions.value = list.map((b) => ({ label: b.brandName ?? String(b.brandId), value: b.brandId }));
  if (brandOptions.value.length === 0) {
    message.warning(t('product.supplierProduct.noAuthorizedBrandsHint'));
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      result.value = null;
      file.value = null;
      form.mode = 'skip';
      form.supplierId = (props.defaultSupplierId ?? undefined) as Id | undefined;
      loadBrands(form.supplierId);
    }
  },
);
watch(() => form.supplierId, (v) => loadBrands(v));

const beforeUpload: UploadProps['beforeUpload'] = (f) => {
  const ok = f.name.toLowerCase().endsWith('.csv');
  if (!ok) message.error(t('product.supplierProduct.import.csvOnly'));
  else file.value = f as unknown as File;
  return false; // 阻止自动上传，仅暂存
};

function downloadTemplate() {
  const sample = ['示例冰箱', 'HR-BCD-201', 'Electronics>Phones', '1200.00', '1599.00', '5', '', '样例备注'];
  const csv = '﻿' + [TEMPLATE_HEADERS.join(','), sample.join(',')].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'supplier_product_template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function onSubmit() {
  if (form.supplierId == null) {
    message.warning(t('product.supplierProduct.selectSupplier'));
    return;
  }
  if (form.brandId == null) {
    message.warning(t('product.supplierProduct.selectBrand'));
    return;
  }
  if (!file.value) {
    message.warning(t('product.supplierProduct.import.selectCsv'));
    return;
  }
  const fd = new FormData();
  fd.append('file', file.value);
  fd.append('supplierId', String(form.supplierId));
  fd.append('brandId', String(form.brandId));
  fd.append('mode', form.mode);
  submitting.value = true;
  try {
    result.value = await apiSupplierProductImport(fd);
    message.success(t('product.supplierProduct.importDone', {
      created: result.value.created,
      updated: result.value.updated,
      skipped: result.value.skipped,
      failed: result.value.failed,
    }));
    emit('imported');
  } finally {
    submitting.value = false;
  }
}

function onClose() {
  emit('update:open', false);
}

defineExpose({ form, brandOptions, beforeUpload, downloadTemplate, onSubmit, result });
</script>

<template>
  <a-modal :open="open" :title="t('product.supplierProduct.import.title')" :width="720" :confirm-loading="submitting" @cancel="onClose">
    <a-form layout="vertical">
      <a-form-item :label="t('product.supplierProduct.supplier')" required>
        <a-select v-model:value="form.supplierId" :options="supplierOptions" :placeholder="t('product.supplierProduct.selectSupplier')" show-search
          option-filter-prop="label" style="width: 100%" />
      </a-form-item>
      <a-form-item :label="t('product.supplierProduct.brandAuthorizedOnly')" required>
        <a-select v-model:value="form.brandId" :options="brandOptions" :placeholder="t('product.supplierProduct.selectBrand')" style="width: 100%" />
      </a-form-item>
      <a-form-item :label="t('product.supplierProduct.onCodeExists')">
        <a-radio-group v-model:value="form.mode">
          <a-radio-button value="skip">{{ t('product.supplierProduct.modeSkip') }}</a-radio-button>
          <a-radio-button value="overwrite">{{ t('product.supplierProduct.modeOverwrite') }}</a-radio-button>
        </a-radio-group>
      </a-form-item>
      <a-form-item :label="t('product.supplierProduct.import.csvFile')">
        <a-space direction="vertical" style="width: 100%">
          <a-upload :before-upload="beforeUpload" :max-count="1" accept=".csv" :show-upload-list="true">
            <a-button data-test="pick-csv">{{ t('product.supplierProduct.import.pickCsv') }}</a-button>
          </a-upload>
          <a @click="downloadTemplate">{{ t('product.supplierProduct.import.downloadTemplate') }}</a>
        </a-space>
      </a-form-item>
    </a-form>

    <div v-if="result" class="mt-2">
      <a-descriptions size="small" :column="4" bordered>
        <a-descriptions-item :label="t('product.supplierProduct.totalRows')">{{ result.total }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.created')">{{ result.created }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.updated')">{{ result.updated }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.skipped')">{{ result.skipped }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.failed')">{{ result.failed }}</a-descriptions-item>
      </a-descriptions>
      <a-table v-if="result.errors.length" class="mt-2" size="small" :pagination="false"
        :data-source="result.errors"
        :columns="[
          { title: t('product.supplierProduct.rowNo'), dataIndex: 'row', width: 80 },
          { title: t('product.supplierProduct.productCode'), dataIndex: 'productCode', width: 160 },
          { title: t('product.supplierProduct.reason'), dataIndex: 'reason' },
        ]" row-key="row" />
    </div>

    <template #footer>
      <a-space>
        <a-button @click="onClose">{{ t('product.supplierProduct.close') }}</a-button>
        <a-button type="primary" :loading="submitting" data-test="do-import" @click="onSubmit">{{ t('product.supplierProduct.import.startImport') }}</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
