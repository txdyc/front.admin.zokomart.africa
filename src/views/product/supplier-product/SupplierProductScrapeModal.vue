<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
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
    message.warning('该供应商暂无已授权品牌，请先在供应商管理里授权');
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

const previewColumns = [
  { title: '#', key: 'idx', width: 50, customRender: ({ index }: { index: number }) => index + 1 },
  { title: '名称', dataIndex: 'productName' },
  { title: '编码', dataIndex: 'productCode', width: 130 },
  { title: '每箱量', dataIndex: 'qtyPerBox', width: 80 },
  { title: '图片', dataIndex: 'imageUrl', key: 'imageUrl', width: 70 },
  { title: '单价', dataIndex: 'unitPrice', width: 80 },
  { title: '箱价', dataIndex: 'boxPrice', width: 90 },
  { title: '库存状态', dataIndex: 'stockStatus', width: 130 },
];

async function onScrape() {
  if (!form.url.trim()) {
    message.warning('请输入 URL');
    return;
  }
  scraping.value = true;
  result.value = null;
  try {
    rows.value = await apiScrapeProducts(form.url.trim());
    message.success(`抓取到 ${rows.value.length} 条产品`);
  } finally {
    scraping.value = false;
  }
}

async function onImport() {
  if (form.supplierId == null) {
    message.warning('请选择供应商');
    return;
  }
  if (form.brandId == null) {
    message.warning('请选择品牌');
    return;
  }
  if (rows.value.length === 0) {
    message.warning('请先抓取产品');
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
      `导入完成：新增 ${result.value.created}，更新 ${result.value.updated}，跳过 ${result.value.skipped}，失败 ${result.value.failed}`,
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
  <a-modal :open="open" title="从 URL 获取供应商产品" :width="900" @cancel="onClose">
    <a-form layout="vertical">
      <a-form-item label="供应商" required>
        <a-select v-model:value="form.supplierId" :options="supplierOptions" placeholder="选择供应商"
          show-search option-filter-prop="label" style="width: 100%" />
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
      <a-form-item label="产品列表 URL" required>
        <a-space style="width: 100%">
          <a-input v-model:value="form.url" placeholder="https://morgan.dzncm.com/price81469/" style="width: 520px" />
          <a-button type="primary" :loading="scraping" data-test="do-scrape" @click="onScrape">抓取</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table v-if="rows.length" size="small" :pagination="{ pageSize: 8 }" :data-source="rows"
      :columns="previewColumns" row-key="productCode" :scroll="{ y: 320 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'imageUrl'">
          <a-image v-if="record.imageUrl" :src="record.imageUrl" :width="36" />
          <span v-else class="text-gray-400">—</span>
        </template>
      </template>
    </a-table>

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
        <a-button type="primary" :loading="importing" :disabled="rows.length === 0" data-test="do-import-scraped"
          @click="onImport">确认导入</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
