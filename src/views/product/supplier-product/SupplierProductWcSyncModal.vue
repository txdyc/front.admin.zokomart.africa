<script setup lang="ts">
import { onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();

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
      const state =
        j.status === 'SUCCESS'
          ? t('product.supplierProduct.wcSync.stateSuccess')
          : j.status === 'PARTIAL'
            ? t('product.supplierProduct.wcSync.statePartial')
            : t('product.supplierProduct.wcSync.stateEnded');
      message.success(
        t('product.supplierProduct.wcSync.syncDone', {
          state,
          created: j.created,
          updated: j.updated,
          drafted: j.drafted,
          failed: j.failed,
        }),
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
    message.warning(t('product.supplierProduct.selectSupplier'));
    return;
  }
  if (form.brandIds.length === 0) {
    message.warning(t('product.supplierProduct.wcSync.selectAtLeastOneBrand'));
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
    message.warning(t('product.supplierProduct.wcSync.noAuthorizedBrands'));
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
  <a-modal :open="open" :title="t('product.supplierProduct.wcSync.title')" :width="720" @cancel="onClose">
    <a-form layout="vertical">
      <a-form-item :label="t('product.supplierProduct.supplier')" required>
        <a-select v-model:value="form.supplierId" :options="supplierOptions" :placeholder="t('product.supplierProduct.selectSupplier')"
          show-search option-filter-prop="label" style="width: 100%" />
      </a-form-item>
      <a-form-item :label="t('product.supplierProduct.wcSync.brandMultiAuthorized')" required>
        <a-select v-model:value="form.brandIds" :options="brandOptions" mode="multiple"
          :placeholder="t('product.supplierProduct.wcSync.selectBrandsMulti')" style="width: 100%" />
      </a-form-item>
    </a-form>

    <div v-if="syncing || job" class="mt-2">
      <a-progress
        v-if="job"
        :percent="job.total ? Math.round((job.processed / job.total) * 100) : 0"
        :status="job.status === 'FAILED' ? 'exception' : job.status === 'RUNNING' ? 'active' : 'normal'"
      />
      <a-descriptions v-if="job" size="small" :column="3" bordered class="mt-2">
        <a-descriptions-item :label="t('common.status')">{{ job.status }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.wcSync.progress')">{{ job.processed }}/{{ job.total }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.created')">{{ job.created }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.updated')">{{ job.updated }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.wcSync.drafted')">{{ job.drafted }}</a-descriptions-item>
        <a-descriptions-item :label="t('product.supplierProduct.failed')">{{ job.failed }}</a-descriptions-item>
      </a-descriptions>
      <a-table v-if="job && job.failedItems && job.failedItems.length" class="mt-2" size="small"
        :pagination="false" :data-source="job.failedItems"
        :columns="[
          { title: t('product.supplierProduct.productCode'), dataIndex: 'productCode', width: 160 },
          { title: t('product.supplierProduct.reason'), dataIndex: 'reason' },
        ]" row-key="productCode" />
    </div>

    <template #footer>
      <a-space>
        <a-button @click="onClose">{{ t('product.supplierProduct.close') }}</a-button>
        <a-button type="primary" :loading="syncing" data-test="do-wc-sync" @click="onSync">{{ t('product.supplierProduct.wcSync.startSync') }}</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
