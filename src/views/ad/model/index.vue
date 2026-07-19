<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import { apiAdModelPage, apiAdModelCreate, apiAdModelUpdate, apiAdModelDelete } from '@/api/ad';
import type { AdAiModelVO, AdAiModelSaveDTO } from '@/types/ad';
import type { Id } from '@/types/api';

const { t } = useI18n();

const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

const searchForm = reactive<{ keyword?: string; enabled?: number }>({});
const query = ref<Record<string, any>>({});
const onSearch = () => (query.value = { ...searchForm });
const onReset = () => {
  searchForm.keyword = undefined;
  searchForm.enabled = undefined;
  query.value = {};
};

const columns = computed<TableColumnsType>(() => [
  { title: t('ad.model.name'), dataIndex: 'name', key: 'name' },
  { title: t('ad.model.baseUrl'), dataIndex: 'baseUrl', key: 'baseUrl' },
  { title: t('ad.model.apiKey'), dataIndex: 'apiKeyMasked', key: 'apiKeyMasked', width: 140 },
  { title: t('ad.model.modelCode'), dataIndex: 'modelCode', key: 'modelCode' },
  { title: t('common.sort'), dataIndex: 'sort', key: 'sort', width: 80 },
  { title: t('common.status'), dataIndex: 'enabled', key: 'enabled', width: 90 },
  { title: t('common.operation'), key: 'action', width: 160 },
]);

const editingId = ref<Id | null>(null);

const formSchema = computed<FormField[]>(() => [
  { field: 'name', label: t('ad.model.name'), component: 'input', rules: [{ required: true, message: t('ad.model.inputName') }] },
  { field: 'baseUrl', label: t('ad.model.baseUrl'), component: 'input', rules: [{ required: true, message: t('ad.model.inputBaseUrl') }] },
  {
    field: 'apiKey', label: t('ad.model.apiKey'), component: 'input',
    props: { placeholder: editingId.value ? t('ad.model.apiKeyEditHint') : t('ad.model.inputApiKey') },
    rules: editingId.value ? [] : [{ required: true, message: t('ad.model.inputApiKey') }],
  },
  { field: 'modelCode', label: t('ad.model.modelCode'), component: 'input', rules: [{ required: true, message: t('ad.model.inputModelCode') }] },
  { field: 'sort', label: t('common.sort'), component: 'number' },
  { field: 'enabled', label: t('common.enabled'), component: 'switch' },
  { field: 'remark', label: t('common.remark'), component: 'textarea' },
]);

const modalOpen = ref(false);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

function openCreate() {
  editingId.value = null;
  formInitial.value = { enabled: 1, sort: 0 };
  modalOpen.value = true;
}
function openEdit(row: AdAiModelVO) {
  editingId.value = row.id;
  formInitial.value = {
    name: row.name,
    baseUrl: row.baseUrl,
    apiKey: '',            // 编辑不回显 key；留空 = 不修改
    modelCode: row.modelCode,
    sort: row.sort,
    enabled: row.enabled,
    remark: row.remark,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as AdAiModelSaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) await apiAdModelUpdate(editingId.value, payload);
    else await apiAdModelCreate(payload);
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: AdAiModelVO) {
  await apiAdModelDelete(row.id);
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
            :placeholder="t('ad.model.keywordPlaceholder')"
            allow-clear
            @press-enter="onSearch"
          />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select
            v-model:value="searchForm.enabled"
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
        <a-button v-perm="'ad:model:create'" type="primary" data-test="ad-model-create" @click="openCreate">
          {{ t('ad.model.createModel') }}
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiAdModelPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'enabled'">
            <a-tag :color="record.enabled === 1 ? 'green' : 'red'">
              {{ record.enabled === 1 ? t('common.enabled') : t('common.disabled') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'ad:model:update'" @click="openEdit(record as AdAiModelVO)">{{ t('common.edit') }}</a>
              <a-popconfirm :title="t('ad.model.deleteConfirm')" @confirm="onDelete(record as AdAiModelVO)">
                <a v-perm="'ad:model:delete'" class="text-red-500">{{ t('common.delete') }}</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('ad.model.editModel') : t('ad.model.createModel')"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </div>
</template>
