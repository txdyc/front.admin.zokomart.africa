<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import {
  apiBrandPage,
  apiBrandCreate,
  apiBrandUpdate,
  apiBrandDelete,
} from '@/api/basedata/brand';
import type { BrandVO, BrandSaveDTO } from '@/types/basedata';
import type { Id } from '@/types/api';

const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

const searchForm = reactive<{ keyword?: string; status?: number }>({});
const query = ref<Record<string, any>>({});
const onSearch = () => (query.value = { ...searchForm });
const onReset = () => {
  searchForm.keyword = undefined;
  searchForm.status = undefined;
  query.value = {};
};

const columns: TableColumnsType = [
  { title: 'Logo', dataIndex: 'logoUrl', key: 'logoUrl', width: 80 },
  { title: '品牌名', dataIndex: 'name', key: 'name' },
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 160 },
];

const formSchema: FormField[] = [
  { field: 'name', label: '品牌名', component: 'input', rules: [{ required: true, message: '请输入品牌名' }] },
  { field: 'code', label: '编码', component: 'input' },
  { field: 'logoUrl', label: '品牌 Logo', component: 'imageUpload', props: { category: 'brand' } },
  { field: 'sort', label: '排序', component: 'number' },
  { field: 'status', label: '启用', component: 'switch' },
  { field: 'remark', label: '备注', component: 'textarea' },
];

const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

function openCreate() {
  editingId.value = null;
  formInitial.value = { status: 1, sort: 0 };
  modalOpen.value = true;
}
function openEdit(row: BrandVO) {
  editingId.value = row.id;
  formInitial.value = {
    name: row.name,
    code: row.code,
    logoUrl: row.logoUrl,
    sort: row.sort,
    status: row.status,
    remark: row.remark,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as BrandSaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) await apiBrandUpdate(editingId.value, payload);
    else await apiBrandCreate(payload);
    message.success('保存成功');
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: BrandVO) {
  await apiBrandDelete(row.id);
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
            placeholder="品牌名/编码"
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
              { label: '启用', value: 1 },
              { label: '停用', value: 0 },
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
        <a-button v-perm="'brand:create'" type="primary" data-test="brand-create" @click="openCreate">
          新增品牌
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiBrandPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'logoUrl'">
            <a-image v-if="record.logoUrl" :src="record.logoUrl" :width="40" />
            <span v-else class="text-gray-400">—</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'brand:update'" @click="openEdit(record as BrandVO)">编辑</a>
              <a-popconfirm title="确认删除该品牌？" @confirm="onDelete(record as BrandVO)">
                <a v-perm="'brand:delete'" class="text-red-500">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑品牌' : '新增品牌'"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </div>
</template>
