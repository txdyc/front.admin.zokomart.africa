<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import {
  apiLogisticsProviderPage,
  apiLogisticsProviderCreate,
  apiLogisticsProviderUpdate,
  apiLogisticsProviderDelete,
} from '@/api/basedata/logisticsProvider';
import type { LogisticsProviderVO, LogisticsProviderSaveDTO } from '@/types/basedata';
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
  { title: '服务商名', dataIndex: 'name', key: 'name' },
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '联系人', dataIndex: 'contactPerson', key: 'contactPerson' },
  { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 160 },
];

const formSchema: FormField[] = [
  { field: 'name', label: '服务商名', component: 'input', rules: [{ required: true, message: '请输入服务商名' }] },
  { field: 'code', label: '编码', component: 'input' },
  { field: 'contactPerson', label: '联系人', component: 'input' },
  { field: 'contactPhone', label: '联系电话', component: 'input' },
  { field: 'status', label: '启用', component: 'switch' },
  { field: 'remark', label: '备注', component: 'textarea' },
];

const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

function openCreate() {
  editingId.value = null;
  formInitial.value = { status: 1 };
  modalOpen.value = true;
}
function openEdit(row: LogisticsProviderVO) {
  editingId.value = row.id;
  formInitial.value = {
    name: row.name,
    code: row.code,
    contactPerson: row.contactPerson,
    contactPhone: row.contactPhone,
    status: row.status,
    remark: row.remark,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as LogisticsProviderSaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) await apiLogisticsProviderUpdate(editingId.value, payload);
    else await apiLogisticsProviderCreate(payload);
    message.success('保存成功');
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: LogisticsProviderVO) {
  await apiLogisticsProviderDelete(row.id);
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
            placeholder="服务商名/编码"
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
        <a-button
          v-perm="'logisticsProvider:create'"
          type="primary"
          data-test="logistics-provider-create"
          @click="openCreate"
        >
          新增服务商
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiLogisticsProviderPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'logisticsProvider:update'" @click="openEdit(record as LogisticsProviderVO)">编辑</a>
              <a-popconfirm title="确认删除该服务商？" @confirm="onDelete(record as LogisticsProviderVO)">
                <a v-perm="'logisticsProvider:delete'" class="text-red-500">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑服务商' : '新增服务商'"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </div>
</template>
