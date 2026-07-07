<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import {
  apiSupplierPage,
  apiSupplierCreate,
  apiSupplierUpdate,
  apiSupplierDelete,
} from '@/api/basedata/supplier';
import type { SupplierVO, SupplierSaveDTO } from '@/types/basedata';
import type { Id } from '@/types/api';
import SupplierBrandDrawer from '@/components/SupplierBrandDrawer.vue';

const { t } = useI18n();

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

const columns = computed<TableColumnsType>(() => [
  { title: t('basedata.supplier.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.code'), dataIndex: 'code', key: 'code' },
  { title: t('common.contact'), dataIndex: 'contactPerson', key: 'contactPerson' },
  { title: t('common.contactPhone'), dataIndex: 'contactPhone', key: 'contactPhone' },
  { title: t('common.address'), dataIndex: 'address', key: 'address' },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 90 },
  { title: t('common.operation'), key: 'action', width: 160 },
]);

const formSchema = computed<FormField[]>(() => [
  { field: 'name', label: t('basedata.supplier.name'), component: 'input', rules: [{ required: true, message: t('basedata.supplier.inputName') }] },
  { field: 'code', label: t('common.code'), component: 'input' },
  { field: 'contactPerson', label: t('common.contact'), component: 'input' },
  { field: 'contactPhone', label: t('common.contactPhone'), component: 'input' },
  { field: 'address', label: t('common.address'), component: 'input' },
  { field: 'status', label: t('common.enabled'), component: 'switch' },
  { field: 'remark', label: t('common.remark'), component: 'textarea' },
]);

const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);
const brandDrawerOpen = ref(false);
const currentSupplierId = ref<Id | null>(null);
function openBrandDrawer(row: SupplierVO) {
  currentSupplierId.value = row.id;
  brandDrawerOpen.value = true;
}

function openCreate() {
  editingId.value = null;
  formInitial.value = { status: 1 };
  modalOpen.value = true;
}
function openEdit(row: SupplierVO) {
  editingId.value = row.id;
  formInitial.value = {
    name: row.name,
    code: row.code,
    contactPerson: row.contactPerson,
    contactPhone: row.contactPhone,
    address: row.address,
    status: row.status,
    remark: row.remark,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as SupplierSaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) await apiSupplierUpdate(editingId.value, payload);
    else await apiSupplierCreate(payload);
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: SupplierVO) {
  await apiSupplierDelete(row.id);
  message.success(t('common.deleteSuccess'));
  tableRef.value?.reload();
}

defineExpose({ openCreate, openEdit, onSubmit, onDelete });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item :label="t('common.keyword')">
          <a-input
            v-model:value="searchForm.keyword"
            :placeholder="t('basedata.supplier.keywordPlaceholder')"
            allow-clear
            @press-enter="onSearch"
          />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select
            v-model:value="searchForm.status"
            :placeholder="t('common.all')"
            allow-clear
            style="width: 120px"
            :options="[
              { label: t('common.enabled'), value: 1 },
              { label: t('common.disabled'), value: 0 },
            ]"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="onSearch">{{ t('common.search') }}</a-button>
            <a-button @click="onReset">{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false">
      <div class="mb-3">
        <a-button v-perm="'supplier:create'" type="primary" data-test="supplier-create" @click="openCreate">
          {{ t('basedata.supplier.createSupplier') }}
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiSupplierPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? t('common.enabled') : t('common.disabled') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'supplier:update'" @click="openEdit(record as SupplierVO)">{{ t('common.edit') }}</a>
              <a v-perm="'supplier:brand:assign'" @click="openBrandDrawer(record as SupplierVO)">{{ t('basedata.supplier.manageBrands') }}</a>
              <a-popconfirm :title="t('basedata.supplier.deleteConfirm')" @confirm="onDelete(record as SupplierVO)">
                <a v-perm="'supplier:delete'" class="text-red-500">{{ t('common.delete') }}</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('basedata.supplier.editSupplier') : t('basedata.supplier.createSupplier')"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
    <SupplierBrandDrawer v-model:open="brandDrawerOpen" :supplier-id="currentSupplierId" />
  </div>
</template>
