<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import SchemaForm, { type FormField, type SelectOption } from '@/components/SchemaForm.vue';
import {
  apiCategoryTree,
  apiCategoryCreate,
  apiCategoryUpdate,
  apiCategoryDelete,
} from '@/api/basedata/category';
import type { CategoryVO, CategorySaveDTO } from '@/types/basedata';
import type { Id } from '@/types/api';

const { t } = useI18n();

const formRef = ref<InstanceType<typeof SchemaForm>>();
const loading = ref(false);
const tree = ref<CategoryVO[]>([]);

const columns = computed<TableColumnsType>(() => [
  { title: t('basedata.category.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.sort'), dataIndex: 'sort', key: 'sort', width: 100 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 100 },
  { title: t('common.operation'), key: 'action', width: 220 },
]);

async function loadTree() {
  loading.value = true;
  try {
    tree.value = await apiCategoryTree();
  } finally {
    loading.value = false;
  }
}
onMounted(loadTree);

const parentOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [{ label: t('basedata.category.rootCategory'), value: 0 }];
  const walk = (nodes: CategoryVO[], depth: number) => {
    nodes.forEach((n) => {
      opts.push({ label: `${'　'.repeat(depth)}${n.name}`, value: n.id });
      if (n.children?.length) walk(n.children, depth + 1);
    });
  };
  walk(tree.value, 0);
  return opts;
});

const formSchema = computed<FormField[]>(() => [
  { field: 'parentId', label: t('basedata.category.parent'), component: 'select', options: parentOptions.value },
  { field: 'name', label: t('basedata.category.name'), component: 'input', rules: [{ required: true, message: t('basedata.category.inputName') }] },
  { field: 'sort', label: t('common.sort'), component: 'number' },
  { field: 'status', label: t('common.enabled'), component: 'switch' },
]);

const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

function openCreate(parentId: Id = 0) {
  editingId.value = null;
  formInitial.value = { parentId, sort: 0, status: 1 };
  modalOpen.value = true;
}
function openEdit(row: CategoryVO) {
  editingId.value = row.id;
  formInitial.value = { parentId: row.parentId, name: row.name, sort: row.sort, status: row.status };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as CategorySaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) await apiCategoryUpdate(editingId.value, payload);
    else await apiCategoryCreate(payload);
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    await loadTree();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: CategoryVO) {
  // 后端会校验子节点/被引用，失败时由 request 拦截器按 msg 提示
  await apiCategoryDelete(row.id);
  message.success(t('common.deleteSuccess'));
  await loadTree();
}

defineExpose({ openCreate, openEdit, onSubmit, onDelete });
</script>

<template>
  <a-card :bordered="false">
    <div class="mb-3">
      <a-button v-perm="'category:create'" type="primary" data-test="category-create" @click="openCreate(0)">
        {{ t('basedata.category.createCategory') }}
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="tree"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? t('common.enabled') : t('common.disabled') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a v-perm="'category:create'" @click="openCreate(record.id)">{{ t('basedata.category.addChild') }}</a>
            <a v-perm="'category:update'" @click="openEdit(record as CategoryVO)">{{ t('common.edit') }}</a>
            <a-popconfirm :title="t('basedata.category.deleteConfirm')" @confirm="onDelete(record as CategoryVO)">
              <a v-perm="'category:delete'" class="text-red-500">{{ t('common.delete') }}</a>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('basedata.category.editCategory') : t('basedata.category.createCategory')"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </a-card>
</template>
