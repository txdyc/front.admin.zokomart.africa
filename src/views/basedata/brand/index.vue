<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
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
  { title: t('basedata.brand.logo'), dataIndex: 'logoUrl', key: 'logoUrl', width: 80 },
  { title: t('basedata.brand.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.code'), dataIndex: 'code', key: 'code' },
  { title: t('common.sort'), dataIndex: 'sort', key: 'sort', width: 80 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 90 },
  { title: t('common.operation'), key: 'action', width: 160 },
]);

const formSchema = computed<FormField[]>(() => [
  { field: 'name', label: t('basedata.brand.name'), component: 'input', rules: [{ required: true, message: t('basedata.brand.inputName') }] },
  { field: 'code', label: t('common.code'), component: 'input' },
  { field: 'logoUrl', label: t('basedata.brand.logoLabel'), component: 'imageUpload', props: { category: 'brand' } },
  { field: 'sort', label: t('common.sort'), component: 'number' },
  { field: 'status', label: t('common.enabled'), component: 'switch' },
  { field: 'remark', label: t('common.remark'), component: 'textarea' },
]);

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
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: BrandVO) {
  await apiBrandDelete(row.id);
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
            :placeholder="t('basedata.brand.keywordPlaceholder')"
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
        <a-button v-perm="'brand:create'" type="primary" data-test="brand-create" @click="openCreate">
          {{ t('basedata.brand.createBrand') }}
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
              {{ record.status === 1 ? t('common.enabled') : t('common.disabled') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'brand:update'" @click="openEdit(record as BrandVO)">{{ t('common.edit') }}</a>
              <a-popconfirm :title="t('basedata.brand.deleteConfirm')" @confirm="onDelete(record as BrandVO)">
                <a v-perm="'brand:delete'" class="text-red-500">{{ t('common.delete') }}</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('basedata.brand.editBrand') : t('basedata.brand.createBrand')"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </div>
</template>
