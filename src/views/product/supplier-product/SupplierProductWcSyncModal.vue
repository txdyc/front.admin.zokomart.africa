<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { SelectOption } from '@/components/SchemaForm.vue';
import { apiWcSync } from '@/api/wcSync';
import { apiAuthorizedBrands } from '@/api/basedata/supplierBrand';
import type { WcSyncResult } from '@/types/wcSync';
import type { Id } from '@/types/api';

const props = defineProps<{
  open: boolean;
  supplierOptions: SelectOption[];
  defaultSupplierId?: Id | null;
}>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();

const form = reactive<{ supplierId?: Id; brandIds: Id[] }>({ brandIds: [] });
const brandOptions = ref<SelectOption[]>([]);
const result = ref<WcSyncResult | null>(null);
const syncing = ref(false);

async function loadBrands(supplierId?: Id) {
  brandOptions.value = [];
  form.brandIds = [];
  if (supplierId == null) return;
  const list = await apiAuthorizedBrands(supplierId);
  brandOptions.value = list.map((b) => ({ label: b.brandName ?? String(b.brandId), value: b.brandId }));
  if (brandOptions.value.length === 0) {
    message.warning('该供应商暂无已授权品牌');
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      result.value = null;
      form.supplierId = (props.defaultSupplierId ?? undefined) as Id | undefined;
      loadBrands(form.supplierId);
    }
  },
);
watch(() => form.supplierId, (v) => loadBrands(v));

async function onSync() {
  if (form.supplierId == null) {
    message.warning('请选择供应商');
    return;
  }
  if (form.brandIds.length === 0) {
    message.warning('请至少选择一个品牌');
    return;
  }
  syncing.value = true;
  try {
    result.value = await apiWcSync({ supplierId: form.supplierId, brandIds: form.brandIds });
    message.success(
      `同步完成：新增 ${result.value.created}，更新 ${result.value.updated}，下架 ${result.value.drafted}，跳过 ${result.value.skipped}，失败 ${result.value.failed}`,
    );
  } finally {
    syncing.value = false;
  }
}

function onClose() {
  emit('update:open', false);
}

defineExpose({ form, brandOptions, result, onSync });
</script>

<template>
  <a-modal :open="open" title="同步到独立站 (WooCommerce)" :width="720" @cancel="onClose">
    <a-form layout="vertical">
      <a-form-item label="供应商" required>
        <a-select v-model:value="form.supplierId" :options="supplierOptions" placeholder="选择供应商"
          show-search option-filter-prop="label" style="width: 100%" />
      </a-form-item>
      <a-form-item label="品牌（可多选，仅已授权）" required>
        <a-select v-model:value="form.brandIds" :options="brandOptions" mode="multiple"
          placeholder="选择一个或多个品牌" style="width: 100%" />
      </a-form-item>
    </a-form>

    <div v-if="result" class="mt-2">
      <a-descriptions size="small" :column="3" bordered>
        <a-descriptions-item label="总数">{{ result.total }}</a-descriptions-item>
        <a-descriptions-item label="新增">{{ result.created }}</a-descriptions-item>
        <a-descriptions-item label="更新">{{ result.updated }}</a-descriptions-item>
        <a-descriptions-item label="下架">{{ result.drafted }}</a-descriptions-item>
        <a-descriptions-item label="跳过">{{ result.skipped }}</a-descriptions-item>
        <a-descriptions-item label="失败">{{ result.failed }}</a-descriptions-item>
      </a-descriptions>
      <a-table v-if="result.errors.length" class="mt-2" size="small" :pagination="false"
        :data-source="result.errors"
        :columns="[
          { title: '产品编码', dataIndex: 'productCode', width: 160 },
          { title: '原因', dataIndex: 'reason' },
        ]" row-key="supplierProductId" />
    </div>

    <template #footer>
      <a-space>
        <a-button @click="onClose">关闭</a-button>
        <a-button type="primary" :loading="syncing" data-test="do-wc-sync" @click="onSync">开始同步</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
