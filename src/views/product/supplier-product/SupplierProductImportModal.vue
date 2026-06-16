<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
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
    message.warning('该供应商暂无已授权品牌，请先在供应商管理里授权');
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
  if (!ok) message.error('只能上传 .csv 文件');
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
  if (form.supplierId == null) return message.warning('请选择供应商');
  if (form.brandId == null) return message.warning('请选择品牌');
  if (!file.value) return message.warning('请选择 CSV 文件');
  const fd = new FormData();
  fd.append('file', file.value);
  fd.append('supplierId', String(form.supplierId));
  fd.append('brandId', String(form.brandId));
  fd.append('mode', form.mode);
  submitting.value = true;
  try {
    result.value = await apiSupplierProductImport(fd);
    message.success(`导入完成：新增 ${result.value.created}，更新 ${result.value.updated}，跳过 ${result.value.skipped}，失败 ${result.value.failed}`);
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
  <a-modal :open="open" title="导入供应商产品" :width="720" :confirm-loading="submitting" @cancel="onClose">
    <a-form layout="vertical">
      <a-form-item label="供应商" required>
        <a-select v-model:value="form.supplierId" :options="supplierOptions" placeholder="选择供应商" show-search
          option-filter-prop="label" style="width: 100%" />
      </a-form-item>
      <a-form-item label="品牌（仅列已授权）" required>
        <a-select v-model:value="form.brandId" :options="brandOptions" placeholder="选择品牌" style="width: 100%" />
      </a-form-item>
      <a-form-item label="编码已存在时">
        <a-radio-group v-model:value="form.mode">
          <a-radio-button value="skip">跳过</a-radio-button>
          <a-radio-button value="overwrite">覆盖更新</a-radio-button>
        </a-radio-group>
      </a-form-item>
      <a-form-item label="CSV 文件">
        <a-space direction="vertical" style="width: 100%">
          <a-upload :before-upload="beforeUpload" :max-count="1" accept=".csv" :show-upload-list="true">
            <a-button data-test="pick-csv">选择 CSV 文件</a-button>
          </a-upload>
          <a @click="downloadTemplate">下载模板</a>
        </a-space>
      </a-form-item>
    </a-form>

    <div v-if="result" class="mt-2">
      <a-descriptions size="small" :column="4" bordered>
        <a-descriptions-item label="总行数">{{ result.total }}</a-descriptions-item>
        <a-descriptions-item label="新增">{{ result.created }}</a-descriptions-item>
        <a-descriptions-item label="更新">{{ result.updated }}</a-descriptions-item>
        <a-descriptions-item label="跳过">{{ result.skipped }}</a-descriptions-item>
        <a-descriptions-item label="失败">{{ result.failed }}</a-descriptions-item>
      </a-descriptions>
      <a-table v-if="result.errors.length" class="mt-2" size="small" :pagination="false"
        :data-source="result.errors"
        :columns="[
          { title: '行号', dataIndex: 'row', width: 80 },
          { title: '产品编码', dataIndex: 'productCode', width: 160 },
          { title: '原因', dataIndex: 'reason' },
        ]" row-key="row" />
    </div>

    <template #footer>
      <a-space>
        <a-button @click="onClose">关闭</a-button>
        <a-button type="primary" :loading="submitting" data-test="do-import" @click="onSubmit">开始导入</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
