<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import CascadeFilter from '@/components/CascadeFilter.vue';
import SchemaForm, { type FormField, type SelectOption } from '@/components/SchemaForm.vue';
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

const columns: TableColumnsType = [
  { title: '图片', dataIndex: 'imageUrl', key: 'imageUrl', width: 70 },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '产品编码', dataIndex: 'productCode', key: 'productCode', width: 130 },
  { title: '供应商', dataIndex: 'supplierId', key: 'supplierId', width: 140 },
  { title: '品牌', dataIndex: 'brandId', key: 'brandId', width: 120 },
  { title: '分类', dataIndex: 'categoryId', key: 'categoryId', width: 140 },
  { title: '批发价', dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
  { title: '零售价', dataIndex: 'retailPrice', key: 'retailPrice', width: 90 },
  { title: 'MOQ', dataIndex: 'minPurchaseQty', key: 'minPurchaseQty', width: 70 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 140 },
];

const formSchema = computed<FormField[]>(() => [
  { field: 'supplierId', label: '供应商', component: 'select', options: supplierOptions.value, rules: [{ required: true, message: '请选择供应商' }] },
  { field: 'name', label: '产品名称', component: 'input', rules: [{ required: true, message: '请输入产品名称' }] },
  { field: 'productCode', label: '产品编码', component: 'input', rules: [{ required: true, message: '请输入产品编码' }] },
  { field: 'brandId', label: '品牌', component: 'select', options: brandOptions.value, placeholder: '请选择品牌' },
  { field: 'categoryId', label: '分类', component: 'select', options: categoryOptions.value, placeholder: '请选择分类' },
  { field: 'wholesalePrice', label: '批发价 (GHS)', component: 'number', props: { min: 0, precision: 2 }, rules: [{ type: 'number', min: 0, message: '批发价不能为负' }] },
  { field: 'retailPrice', label: '零售价 (GHS)', component: 'number', props: { min: 0, precision: 2 }, rules: [{ type: 'number', min: 0, message: '零售价不能为负' }] },
  { field: 'minPurchaseQty', label: '最小采购量 (MOQ)', component: 'number', props: { min: 1, precision: 0 }, rules: [{ type: 'number', min: 1, message: '最小采购量不能小于 1' }] },
  { field: 'imageUrl', label: '图片地址', component: 'input', placeholder: '图片 URL' },
  { field: 'status', label: '启用', component: 'switch' },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

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
    message.warning('最小采购量不能小于 1');
    return;
  }
  if ((payload.wholesalePrice ?? 0) < 0 || (payload.retailPrice ?? 0) < 0) {
    message.warning('价格不能为负');
    return;
  }
  submitting.value = true;
  try {
    if (editingId.value) await apiSupplierProductUpdate(editingId.value, payload);
    else await apiSupplierProductCreate(payload);
    message.success('保存成功');
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: SupplierProductVO) {
  await apiSupplierProductDelete(row.id);
  message.success('已删除');
  tableRef.value?.reload();
}

defineExpose({ openCreate, openEdit, onSubmit, onDelete, onFilterChange });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <CascadeFilter v-model="filter" @change="onFilterChange" />
    </a-card>

    <a-card :bordered="false">
      <div class="mb-3">
        <a-button
          v-perm="'supplierProduct:create'"
          type="primary"
          data-test="supplier-product-create"
          @click="openCreate"
        >
          新增供应商产品
        </a-button>
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
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'supplierProduct:update'" @click="openEdit(record as SupplierProductVO)">编辑</a>
              <a-popconfirm title="确认删除该供应商产品？" @confirm="onDelete(record as SupplierProductVO)">
                <a v-perm="'supplierProduct:delete'" class="text-red-500">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑供应商产品' : '新增供应商产品'"
      :confirm-loading="submitting"
      :width="640"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </div>
</template>
