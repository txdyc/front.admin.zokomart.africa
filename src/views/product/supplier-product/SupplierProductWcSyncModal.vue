<script setup lang="ts">
import { onUnmounted, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { SelectOption } from '@/components/SchemaForm.vue';
import { apiStartWcSync, apiGetWcSyncJob } from '@/api/wcSync';
import { apiAuthorizedBrands } from '@/api/basedata/supplierBrand';
import type { WcSyncJob } from '@/types/wcSync';
import type { Id } from '@/types/api';

const props = defineProps<{
  open: boolean;
  supplierOptions: SelectOption[];
  defaultSupplierId?: Id | null;
}>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();

const form = reactive<{ supplierId?: Id; brandIds: Id[] }>({ brandIds: [] });
const brandOptions = ref<SelectOption[]>([]);
const job = ref<WcSyncJob | null>(null);
const syncing = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const TERMINAL = ['SUCCESS', 'PARTIAL', 'FAILED', 'INTERRUPTED'];

function stopPolling() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

async function poll(jobId: Id) {
  try {
    const j = await apiGetWcSyncJob(jobId);
    job.value = j;
    if (j && TERMINAL.includes(j.status)) {
      syncing.value = false;
      stopPolling();
      message.success(
        `同步${j.status === 'SUCCESS' ? '完成' : j.status === 'PARTIAL' ? '部分完成' : '结束'}：` +
          `新增 ${j.created}，更新 ${j.updated}，草稿 ${j.drafted}，失败 ${j.failed}`,
      );
      return;
    }
  } catch {
    /* 轮询瞬时失败：忽略本次，下次再试 */
  }
  timer = setTimeout(() => poll(jobId), 1500);
}

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
  job.value = null;
  try {
    const { jobId } = await apiStartWcSync({ supplierId: form.supplierId, brandIds: form.brandIds });
    poll(jobId);
  } catch (e) {
    syncing.value = false;
    throw e;
  }
}

function onClose() {
  stopPolling();
  emit('update:open', false);
}

onUnmounted(stopPolling);

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
      job.value = null;
      stopPolling();
      form.supplierId = (props.defaultSupplierId ?? undefined) as Id | undefined;
      loadBrands(form.supplierId);
    }
  },
);
watch(() => form.supplierId, (v) => loadBrands(v));

defineExpose({ form, brandOptions, job, onSync });
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

    <div v-if="syncing || job" class="mt-2">
      <a-progress
        v-if="job"
        :percent="job.total ? Math.round((job.processed / job.total) * 100) : 0"
        :status="job.status === 'FAILED' ? 'exception' : job.status === 'RUNNING' ? 'active' : 'normal'"
      />
      <a-descriptions v-if="job" size="small" :column="3" bordered class="mt-2">
        <a-descriptions-item label="状态">{{ job.status }}</a-descriptions-item>
        <a-descriptions-item label="进度">{{ job.processed }}/{{ job.total }}</a-descriptions-item>
        <a-descriptions-item label="新增">{{ job.created }}</a-descriptions-item>
        <a-descriptions-item label="更新">{{ job.updated }}</a-descriptions-item>
        <a-descriptions-item label="草稿">{{ job.drafted }}</a-descriptions-item>
        <a-descriptions-item label="失败">{{ job.failed }}</a-descriptions-item>
      </a-descriptions>
      <a-table v-if="job && job.failedItems && job.failedItems.length" class="mt-2" size="small"
        :pagination="false" :data-source="job.failedItems"
        :columns="[
          { title: '产品编码', dataIndex: 'productCode', width: 160 },
          { title: '原因', dataIndex: 'reason' },
        ]" row-key="productCode" />
    </div>

    <template #footer>
      <a-space>
        <a-button @click="onClose">关闭</a-button>
        <a-button type="primary" :loading="syncing" data-test="do-wc-sync" @click="onSync">开始同步</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
