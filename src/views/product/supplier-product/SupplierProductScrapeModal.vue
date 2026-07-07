<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { SelectOption } from '@/components/SchemaForm.vue';
import { apiScrapeProducts, apiImportScraped } from '@/api/product/supplierProduct';
import { apiAuthorizedBrands } from '@/api/basedata/supplierBrand';
import type { ScrapedProductRow, SupplierProductImportResult } from '@/types/product';
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

const form = reactive<{ supplierId?: Id; brandId?: Id; url: string; mode: 'skip' | 'overwrite' }>({
  url: '',
  mode: 'skip',
});
const brandOptions = ref<SelectOption[]>([]);
const rows = ref<ScrapedProductRow[]>([]);
const result = ref<SupplierProductImportResult | null>(null);
const scraping = ref(false);
const importing = ref(false);

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
      rows.value = [];
      result.value = null;
      form.url = '';
      form.mode = 'skip';
      form.supplierId = (props.defaultSupplierId ?? undefined) as Id | undefined;
      loadBrands(form.supplierId);
    }
  },
);
watch(() => form.supplierId, (v) => loadBrands(v));

// 预览用数据源：附加 _idx 作为稳定行键（源数据 productCode 可能重复，不能作 key）。
// 真正提交导入用的是 rows.value（纯 ScrapedProductRow[]），不含 _idx。
const previewData = computed(() => rows.value.map((r, i) => ({ ...r, _idx: i })));

const previewColumns = computed(() => [
  { title: '#', key: 'idx', width: 50, customRender: ({ index }: { index: number }) => index + 1 },
  { title: t('product.supplierProduct.name'), dataIndex: 'productName' },
  { title: t('common.code'), dataIndex: 'productCode', width: 130 },
  { title: t('product.supplierProduct.qtyPerBox'), dataIndex: 'qtyPerBox', width: 80 },
  { title: t('product.supplierProduct.image'), dataIndex: 'imageUrl', key: 'imageUrl', width: 70 },
  { title: t('product.supplierProduct.scrape.unitPrice'), dataIndex: 'unitPrice', width: 80 },
  { title: t('product.supplierProduct.boxPrice'), dataIndex: 'boxPrice', width: 90 },
  { title: t('product.supplierProduct.stockStatus'), dataIndex: 'stockStatus', width: 130 },
]);

async function onScrape() {
  if (!form.url.trim()) {
    message.warning(t('product.supplierProduct.scrape.warnUrl'));
    return;
  }
  scraping.value = true;
  result.value = null;
  rows.value = []; // 清空旧结果，避免抓取失败时残留上一个 URL 的数据被误导入
  try {
    rows.value = await apiScrapeProducts(form.url.trim());
    message.success(t('product.supplierProduct.scrape.scrapedCount', { n: rows.value.length }));
  } finally {
    scraping.value = false;
  }
}

async function onImport() {
  if (form.supplierId == null) {
    message.warning(t('product.supplierProduct.selectSupplier'));
    return;
  }
  if (form.brandId == null) {
    message.warning(t('product.supplierProduct.selectBrand'));
    return;
  }
  if (rows.value.length === 0) {
    message.warning(t('product.supplierProduct.scrape.scrapeFirst'));
    return;
  }
  importing.value = true;
  try {
    result.value = await apiImportScraped({
      supplierId: form.supplierId,
      brandId: form.brandId,
      mode: form.mode,
      rows: rows.value,
    });
    message.success(
      t('product.supplierProduct.importDone', {
        created: result.value.created,
        updated: result.value.updated,
        skipped: result.value.skipped,
        failed: result.value.failed,
      }),
    );
    emit('imported');
  } finally {
    importing.value = false;
  }
}

function onClose() {
  emit('update:open', false);
}

defineExpose({ form, brandOptions, rows, result, onScrape, onImport });
</script>

<template>
  <a-modal :open="open" :title="t('product.supplierProduct.scrape.title')" :width="900" @cancel="onClose">
    <a-form layout="vertical">
      <a-form-item :label="t('product.supplierProduct.supplier')" required>
        <a-select v-model:value="form.supplierId" :options="supplierOptions" :placeholder="t('product.supplierProduct.selectSupplier')"
          show-search option-filter-prop="label" style="width: 100%" />
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
      <a-form-item :label="t('product.supplierProduct.scrape.urlLabel')" required>
        <a-space style="width: 100%">
          <a-input v-model:value="form.url" placeholder="https://morgan.dzncm.com/price81469/" style="width: 520px" />
          <a-button type="primary" :loading="scraping" data-test="do-scrape" @click="onScrape">{{ t('product.supplierProduct.scrape.scrape') }}</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table v-if="rows.length" size="small" :pagination="{ pageSize: 8 }" :data-source="previewData"
      :columns="previewColumns" row-key="_idx" :scroll="{ y: 320 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'imageUrl'">
          <a-image v-if="record.imageUrl" :src="record.imageUrl" :width="36" />
          <span v-else class="text-gray-400">—</span>
        </template>
      </template>
    </a-table>

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
        <a-button type="primary" :loading="importing" :disabled="rows.length === 0" data-test="do-import-scraped"
          @click="onImport">{{ t('product.supplierProduct.scrape.confirmImport') }}</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
