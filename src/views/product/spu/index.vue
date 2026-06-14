<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import SchemaForm, { type FormField, type SelectOption } from '@/components/SchemaForm.vue';
import { apiSpuPage, apiSpuCreate, apiSpuUpdate, apiSpuDelete } from '@/api/product/spu';
import { apiBrandPage } from '@/api/basedata/brand';
import { apiCategoryTree } from '@/api/basedata/category';
import type { ProductSpuVO, ProductSpuSaveDTO } from '@/types/product';
import type { CategoryVO } from '@/types/basedata';
import type { Id } from '@/types/api';

const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

// 品牌、分类下拉数据源（建/编 与 表格名称回显共用）
const brandOptions = ref<SelectOption[]>([]);
const categoryOptions = ref<SelectOption[]>([]);
const brandMap = computed(() => new Map(brandOptions.value.map((o) => [String(o.value), o.label])));
const categoryMap = computed(
  () => new Map(categoryOptions.value.map((o) => [String(o.value), o.label.trim()])),
);

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
  loadBrands();
  loadCategories();
});

const searchForm = reactive<{ keyword?: string; status?: number }>({});
const query = ref<Record<string, any>>({});
const onSearch = () => (query.value = { ...searchForm });
const onReset = () => {
  searchForm.keyword = undefined;
  searchForm.status = undefined;
  query.value = {};
};

const columns: TableColumnsType = [
  { title: '主图', dataIndex: 'mainImage', key: 'mainImage', width: 80 },
  { title: 'SPU 名称', dataIndex: 'name', key: 'name' },
  { title: '品牌', dataIndex: 'brandId', key: 'brandId', width: 140 },
  { title: '分类', dataIndex: 'categoryId', key: 'categoryId', width: 160 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 160 },
];

const formSchema = computed<FormField[]>(() => [
  { field: 'name', label: 'SPU 名称', component: 'input', rules: [{ required: true, message: '请输入 SPU 名称' }] },
  { field: 'brandId', label: '品牌', component: 'select', options: brandOptions.value, placeholder: '请选择品牌' },
  { field: 'categoryId', label: '分类', component: 'select', options: categoryOptions.value, placeholder: '请选择分类' },
  { field: 'mainImage', label: '主图地址', component: 'input', placeholder: '图片 URL' },
  { field: 'description', label: '描述', component: 'textarea' },
  { field: 'status', label: '上架', component: 'switch' },
]);

const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

function openCreate() {
  editingId.value = null;
  formInitial.value = { status: 1 };
  modalOpen.value = true;
}
function openEdit(row: ProductSpuVO) {
  editingId.value = row.id;
  formInitial.value = {
    name: row.name,
    brandId: row.brandId ?? undefined,
    categoryId: row.categoryId ?? undefined,
    mainImage: row.mainImage,
    description: row.description,
    status: row.status,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as ProductSpuSaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) await apiSpuUpdate(editingId.value, payload);
    else await apiSpuCreate(payload);
    message.success('保存成功');
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: ProductSpuVO) {
  await apiSpuDelete(row.id);
  message.success('已删除');
  tableRef.value?.reload();
}

defineExpose({ openCreate, openEdit, onSubmit, onDelete });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item label="关键字">
          <a-input
            v-model:value="searchForm.keyword"
            placeholder="SPU 名称"
            allow-clear
            @press-enter="onSearch"
          />
        </a-form-item>
        <a-form-item label="状态">
          <a-select
            v-model:value="searchForm.status"
            placeholder="全部"
            allow-clear
            style="width: 120px"
            :options="[
              { label: '上架', value: 1 },
              { label: '下架', value: 0 },
            ]"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="onSearch">查询</a-button>
            <a-button @click="onReset">重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false">
      <div class="mb-3">
        <a-button v-perm="'product:spu:create'" type="primary" data-test="spu-create" @click="openCreate">
          新增 SPU
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiSpuPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'mainImage'">
            <a-image v-if="record.mainImage" :src="record.mainImage" :width="40" />
            <span v-else class="text-gray-400">—</span>
          </template>
          <template v-else-if="column.key === 'brandId'">
            {{ record.brandId != null ? brandMap.get(String(record.brandId)) ?? record.brandId : '—' }}
          </template>
          <template v-else-if="column.key === 'categoryId'">
            {{ record.categoryId != null ? categoryMap.get(String(record.categoryId)) ?? record.categoryId : '—' }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? '上架' : '下架' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'product:spu:update'" @click="openEdit(record as ProductSpuVO)">编辑</a>
              <a-popconfirm title="确认删除该 SPU？" @confirm="onDelete(record as ProductSpuVO)">
                <a v-perm="'product:spu:delete'" class="text-red-500">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑 SPU' : '新增 SPU'"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </div>
</template>
