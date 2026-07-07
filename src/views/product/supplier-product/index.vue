<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import CascadeFilter from '@/components/CascadeFilter.vue';
import SchemaForm, { type FormField, type SelectOption } from '@/components/SchemaForm.vue';
import SupplierProductImportModal from './SupplierProductImportModal.vue';
import SupplierProductScrapeModal from './SupplierProductScrapeModal.vue';
import SupplierProductWcSyncModal from './SupplierProductWcSyncModal.vue';
import {
  apiSupplierProductPage,
  apiSupplierProductCreate,
  apiSupplierProductUpdate,
  apiSupplierProductDelete,
} from '@/api/product/supplierProduct';
import { apiSupplierPage } from '@/api/basedata/supplier';
import { apiBrandPage } from '@/api/basedata/brand';
import { apiCategoryTree } from '@/api/basedata/category';
import type { SupplierProductVO, SupplierProductSaveDTO, SupplierProductQuery } from '@/types/product';
import type { CategoryVO } from '@/types/basedata';
import type { Id } from '@/types/api';

const { t } = useI18n();

const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

// 顶部联动筛选条件 → 传给表格作为查询参数
const filter = ref<SupplierProductQuery>({});
const query = ref<Record<string, any>>({});
const onFilterChange = (v: SupplierProductQuery) => {
  filter.value = v;
  query.value = { ...v };
};

// 建/编 表单的下拉源（全量品牌/分类/供应商）与表格名称回显
const supplierOptions = ref<SelectOption[]>([]);
const brandOptions = ref<SelectOption[]>([]);
const categoryOptions = ref<SelectOption[]>([]);
const supplierMap = computed(() => new Map(supplierOptions.value.map((o) => [String(o.value), o.label])));
const brandMap = computed(() => new Map(brandOptions.value.map((o) => [String(o.value), o.label])));
const categoryMap = computed(
  () => new Map(categoryOptions.value.map((o) => [String(o.value), o.label.trim()])),
);

async function loadSuppliers() {
  const page = await apiSupplierPage({ status: 1, current: 1, size: 1000 });
  supplierOptions.value = page.records.map((s) => ({ label: s.name, value: s.id }));
}
async function loadBrands() {
  const page = await apiBrandPage({ status: 1, current: 1, size: 1000 });
  brandOptions.value = page.records.map((b) => ({ label: b.name, value: b.id }));
}
async function loadCategories() {
  const tree = await apiCategoryTree();
  const opts: SelectOption[] = [];
  const walk = (nodes: CategoryVO[], depth: number) => {
    nodes.forEach((n) => {
      opts.push({ label: `${'　'.repeat(depth)}${n.name}`, value: n.id });
      if (n.children?.length) walk(n.children, depth + 1);
    });
  };
  walk(tree, 0);
  categoryOptions.value = opts;
}
onMounted(() => {
  loadSuppliers();
  loadBrands();
  loadCategories();
});

const columns = computed<TableColumnsType>(() => [
  { title: t('product.supplierProduct.image'), dataIndex: 'imageUrl', key: 'imageUrl', width: 70 },
  { title: t('product.supplierProduct.name'), dataIndex: 'name', key: 'name' },
  { title: t('product.supplierProduct.productCode'), dataIndex: 'productCode', key: 'productCode', width: 130 },
  { title: t('product.supplierProduct.supplier'), dataIndex: 'supplierId', key: 'supplierId', width: 140 },
  { title: t('product.supplierProduct.brand'), dataIndex: 'brandId', key: 'brandId', width: 120 },
  { title: t('product.supplierProduct.category'), dataIndex: 'categoryId', key: 'categoryId', width: 140 },
  { title: t('product.supplierProduct.wholesalePrice'), dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
  { title: t('product.supplierProduct.retailPrice'), dataIndex: 'retailPrice', key: 'retailPrice', width: 90 },
  { title: 'MOQ', dataIndex: 'minPurchaseQty', key: 'minPurchaseQty', width: 70 },
  { title: t('product.supplierProduct.qtyPerBox'), dataIndex: 'qtyPerBox', key: 'qtyPerBox', width: 80 },
  { title: t('product.supplierProduct.boxPrice'), dataIndex: 'boxPrice', key: 'boxPrice', width: 90 },
  { title: t('product.supplierProduct.stockStatus'), dataIndex: 'stockStatus', key: 'stockStatus', width: 120 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 80 },
  { title: t('common.operation'), key: 'action', width: 140 },
]);

const formSchema = computed<FormField[]>(() => [
  { field: 'supplierId', label: t('product.supplierProduct.supplier'), component: 'select', options: supplierOptions.value, rules: [{ required: true, message: t('product.supplierProduct.selectSupplier') }] },
  { field: 'name', label: t('product.supplierProduct.productName'), component: 'input', rules: [{ required: true, message: t('product.supplierProduct.inputProductName') }] },
  { field: 'productCode', label: t('product.supplierProduct.productCode'), component: 'input', rules: [{ required: true, message: t('product.supplierProduct.inputProductCode') }] },
  { field: 'brandId', label: t('product.supplierProduct.brand'), component: 'select', options: brandOptions.value, placeholder: t('product.supplierProduct.selectBrand') },
  { field: 'categoryId', label: t('product.supplierProduct.category'), component: 'select', options: categoryOptions.value, placeholder: t('product.supplierProduct.selectCategory') },
  { field: 'wholesalePrice', label: t('product.supplierProduct.wholesalePriceLabel'), component: 'number', props: { min: 0, precision: 2 }, rules: [{ type: 'number', min: 0, message: t('product.supplierProduct.wholesaleNegative') }] },
  { field: 'retailPrice', label: t('product.supplierProduct.retailPriceLabel'), component: 'number', props: { min: 0, precision: 2 }, rules: [{ type: 'number', min: 0, message: t('product.supplierProduct.retailNegative') }] },
  { field: 'minPurchaseQty', label: t('product.supplierProduct.minPurchaseQty'), component: 'number', props: { min: 1, precision: 0 }, rules: [{ type: 'number', min: 1, message: t('product.supplierProduct.minQtyMin') }] },
  { field: 'qtyPerBox', label: t('product.supplierProduct.qtyPerBoxLabel'), component: 'number', props: { min: 0, precision: 0 } },
  { field: 'boxPrice', label: t('product.supplierProduct.boxPriceLabel'), component: 'number', props: { min: 0, precision: 2 } },
  { field: 'stockStatus', label: t('product.supplierProduct.stockStatus'), component: 'input' },
  { field: 'imageUrl', label: t('product.supplierProduct.imageUrl'), component: 'input', placeholder: t('product.supplierProduct.imageUrlPlaceholder') },
  { field: 'status', label: t('product.supplierProduct.enable'), component: 'switch' },
  { field: 'remark', label: t('common.remark'), component: 'textarea' },
]);

const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

const importOpen = ref(false);
function openImport() {
  importOpen.value = true;
}
function onImported() {
  tableRef.value?.reload();
}

const scrapeOpen = ref(false);
function openScrape() {
  scrapeOpen.value = true;
}

const wcSyncOpen = ref(false);
function openWcSync() {
  wcSyncOpen.value = true;
}

function openCreate() {
  editingId.value = null;
  // 默认带入当前筛选的供应商，MOQ 默认 1
  formInitial.value = { supplierId: filter.value.supplierId, minPurchaseQty: 1, status: 1 };
  modalOpen.value = true;
}
function openEdit(row: SupplierProductVO) {
  editingId.value = row.id;
  formInitial.value = {
    supplierId: row.supplierId,
    name: row.name,
    productCode: row.productCode,
    brandId: row.brandId ?? undefined,
    categoryId: row.categoryId ?? undefined,
    wholesalePrice: row.wholesalePrice,
    retailPrice: row.retailPrice,
    minPurchaseQty: row.minPurchaseQty,
    qtyPerBox: row.qtyPerBox ?? undefined,
    boxPrice: row.boxPrice ?? undefined,
    stockStatus: row.stockStatus ?? undefined,
    imageUrl: row.imageUrl,
    status: row.status,
    remark: row.remark,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as SupplierProductSaveDTO;
  // 业务兜底校验（与后端 DTO 一致）
  if (payload.minPurchaseQty != null && payload.minPurchaseQty < 1) {
    message.warning(t('product.supplierProduct.minQtyMin'));
    return;
  }
  if ((payload.wholesalePrice ?? 0) < 0 || (payload.retailPrice ?? 0) < 0) {
    message.warning(t('product.supplierProduct.priceNegative'));
    return;
  }
  submitting.value = true;
  try {
    if (editingId.value) await apiSupplierProductUpdate(editingId.value, payload);
    else await apiSupplierProductCreate(payload);
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: SupplierProductVO) {
  await apiSupplierProductDelete(row.id);
  message.success(t('common.deleteSuccess'));
  tableRef.value?.reload();
}

defineExpose({ openCreate, openEdit, onSubmit, onDelete, onFilterChange, openImport, onImported, openScrape, openWcSync });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <CascadeFilter v-model="filter" @change="onFilterChange" />
    </a-card>

    <a-card :bordered="false">
      <div class="mb-3">
        <a-space>
          <a-button
            v-perm="'supplierProduct:create'"
            type="primary"
            data-test="supplier-product-create"
            @click="openCreate"
          >
            {{ t('product.supplierProduct.create') }}
          </a-button>
          <a-button v-perm="'supplierProduct:import'" data-test="supplier-product-import" @click="openImport">
            {{ t('product.supplierProduct.importBtn') }}
          </a-button>
          <a-button v-perm="'supplierProduct:import'" data-test="supplier-product-scrape" @click="openScrape">
            {{ t('product.supplierProduct.scrapeBtn') }}
          </a-button>
          <a-button v-perm="'wc:sync'" data-test="supplier-product-wc-sync" @click="openWcSync">
            {{ t('product.supplierProduct.wcSyncBtn') }}
          </a-button>
        </a-space>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiSupplierProductPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'imageUrl'">
            <a-image v-if="record.imageUrl" :src="record.imageUrl" :width="40" />
            <span v-else class="text-gray-400">—</span>
          </template>
          <template v-else-if="column.key === 'supplierId'">
            {{ supplierMap.get(String(record.supplierId)) ?? record.supplierId }}
          </template>
          <template v-else-if="column.key === 'brandId'">
            {{ record.brandId != null ? brandMap.get(String(record.brandId)) ?? record.brandId : '—' }}
          </template>
          <template v-else-if="column.key === 'categoryId'">
            {{ record.categoryId != null ? categoryMap.get(String(record.categoryId)) ?? record.categoryId : '—' }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? t('common.enabled') : t('common.disabled') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'supplierProduct:update'" @click="openEdit(record as SupplierProductVO)">{{ t('common.edit') }}</a>
              <a-popconfirm :title="t('product.supplierProduct.deleteConfirm')" @confirm="onDelete(record as SupplierProductVO)">
                <a v-perm="'supplierProduct:delete'" class="text-red-500">{{ t('common.delete') }}</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('product.supplierProduct.edit') : t('product.supplierProduct.create')"
      :confirm-loading="submitting"
      :width="640"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>

    <SupplierProductImportModal
      v-model:open="importOpen"
      :supplier-options="supplierOptions"
      :default-supplier-id="filter.supplierId"
      @imported="onImported"
    />

    <SupplierProductWcSyncModal
      v-model:open="wcSyncOpen"
      :supplier-options="supplierOptions"
      :default-supplier-id="filter.supplierId"
    />

    <SupplierProductScrapeModal
      v-model:open="scrapeOpen"
      :supplier-options="supplierOptions"
      :default-supplier-id="filter.supplierId"
      @imported="onImported"
    />
  </div>
</template>
