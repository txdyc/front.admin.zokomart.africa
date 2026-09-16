<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { SelectOption } from '@/components/SchemaForm.vue';
import { apiStartWcSync, apiGetWcSyncJob, apiWcSyncSites } from '@/api/wcSync';
import { apiAuthorizedBrands } from '@/api/basedata/supplierBrand';
import type { WcSyncJob, WcSyncSite } from '@/types/wcSync';
import type { Id } from '@/types/api';

const props = defineProps<{
  open: boolean;
  supplierOptions: SelectOption[];
  defaultSupplierId?: Id | null;
}>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();

const { t } = useI18n();

const form = reactive<{ supplierId?: Id; brandIds: Id[]; siteCodes: string[] }>({ brandIds: [], siteCodes: [] });
const brandOptions = ref<SelectOption[]>([]);
const sites = ref<WcSyncSite[]>([]);
const siteOptions = ref<SelectOption[]>([]);
const siteNameMap = ref<Record<string, string>>({});
/** 每个站点一块进度；顺序与所选 siteCodes 一致。 */
const jobs = ref<WcSyncJob[]>([]);
const syncing = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const TERMINAL = ['SUCCESS', 'PARTIAL', 'FAILED', 'INTERRUPTED'];

const configuredCount = computed(() => sites.value.filter((s) => s.configured).length);

function stopPolling() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function siteLabel(code?: string) {
  if (!code) return '';
  return siteNameMap.value[code] ?? code;
}

/** 轮询所有未终态的 job；全部终态后停止。每个 job 终态判定独立。 */
async function pollAll() {
  let pending = false;
  for (const j of [...jobs.value]) {
    if (TERMINAL.includes(j.status)) continue;
    try {
      const fresh = await apiGetWcSyncJob(j.jobId);
      const idx = jobs.value.findIndex((x) => x.jobId === j.jobId);
      if (idx >= 0) jobs.value[idx] = fresh;
      if (TERMINAL.includes(fresh.status)) {
        const state =
          fresh.status === 'SUCCESS'
            ? t('product.supplierProduct.wcSync.stateSuccess')
            : fresh.status === 'PARTIAL'
              ? t('product.supplierProduct.wcSync.statePartial')
              : t('product.supplierProduct.wcSync.stateEnded');
        message.success(
          `${siteLabel(fresh.siteCode)} ${t('product.supplierProduct.wcSync.syncDone', {
            state,
            created: fresh.created,
            updated: fresh.updated,
            drafted: fresh.drafted,
            failed: fresh.failed,
          })}`,
        );
      } else {
        pending = true;   // 还有未终态的 job
      }
    } catch {
      pending = true;     // 轮询瞬时失败：忽略本次，下次再试
    }
  }
  if (!pending) {
    syncing.value = false;
    return;               // 全部终态 → 停轮询
  }
  timer = setTimeout(pollAll, 1500);
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
  if (form.siteCodes.length === 0) {
    message.warning(t('product.supplierProduct.wcSync.selectSites'));
    return;
  }
  syncing.value = true;
  jobs.value = [];
  try {
    const { jobIds } = await apiStartWcSync({
      supplierId: form.supplierId,
      brandIds: form.brandIds,
      siteCodes: form.siteCodes,
    });
    // jobIds 与所选 siteCodes 一一对应（同序）
    jobs.value = jobIds.map((jobId, i) => {
      const code = form.siteCodes[i];
      return {
        jobId,
        siteCode: code,
        siteName: siteLabel(code),
        status: 'RUNNING' as const,
        total: 0,
        processed: 0,
        created: 0,
        updated: 0,
        drafted: 0,
        failed: 0,
        failedItems: [],
      };
    });
    pollAll();
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

/** 载入站点列表：默认全选已配置站点；未配置的置灰不可选。 */
async function loadSites() {
  const list = await apiWcSyncSites();
  sites.value = list;
  siteNameMap.value = Object.fromEntries(list.map((s) => [s.code, s.name || s.code]));
  siteOptions.value = list.map((s) => ({
    label: s.name || s.code,
    value: s.code,
    disabled: !s.configured,
  }));
  form.siteCodes = list.filter((s) => s.configured).map((s) => s.code);
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      jobs.value = [];
      stopPolling();
      form.supplierId = (props.defaultSupplierId ?? undefined) as Id | undefined;
      loadBrands(form.supplierId);
      loadSites();
    }
  },
);
watch(() => form.supplierId, (v) => loadBrands(v));

defineExpose({ form, brandOptions, siteOptions, sites, configuredCount, jobs, onSync });
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
      <a-form-item :label="t('product.supplierProduct.wcSync.targetSites')" required>
        <a-select v-model:value="form.siteCodes" :options="siteOptions" mode="multiple"
          :placeholder="t('product.supplierProduct.wcSync.selectSites')" style="width: 100%" />
      </a-form-item>
    </a-form>

    <div v-if="syncing || jobs.length" class="mt-2">
      <div v-for="job in jobs" :key="job.jobId" class="mb-3">
        <div class="mb-1 font-medium">{{ siteLabel(job.siteCode) }}</div>
        <a-progress
          :percent="job.total ? Math.round((job.processed / job.total) * 100) : 0"
          :status="job.status === 'FAILED' ? 'exception' : job.status === 'RUNNING' ? 'active' : 'normal'"
        />
        <a-descriptions size="small" :column="3" bordered class="mt-2">
          <a-descriptions-item :label="t('common.status')">{{ job.status }}</a-descriptions-item>
          <a-descriptions-item :label="t('product.supplierProduct.wcSync.progress')">{{ job.processed }}/{{ job.total }}</a-descriptions-item>
          <a-descriptions-item :label="t('product.supplierProduct.created')">{{ job.created }}</a-descriptions-item>
          <a-descriptions-item :label="t('product.supplierProduct.updated')">{{ job.updated }}</a-descriptions-item>
          <a-descriptions-item :label="t('product.supplierProduct.wcSync.drafted')">{{ job.drafted }}</a-descriptions-item>
          <a-descriptions-item :label="t('product.supplierProduct.failed')">{{ job.failed }}</a-descriptions-item>
        </a-descriptions>
        <a-table v-if="job.failedItems && job.failedItems.length" class="mt-2" size="small"
          :pagination="false" :data-source="job.failedItems"
          :columns="[
            { title: t('product.supplierProduct.productCode'), dataIndex: 'productCode', width: 160 },
            { title: t('product.supplierProduct.reason'), dataIndex: 'reason' },
          ]" row-key="productCode" />
      </div>
    </div>

    <template #footer>
      <a-space>
        <a-button @click="onClose">{{ t('product.supplierProduct.close') }}</a-button>
        <a-button type="primary" :loading="syncing" data-test="do-wc-sync" @click="onSync">{{ t('product.supplierProduct.wcSync.startSync') }}</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
