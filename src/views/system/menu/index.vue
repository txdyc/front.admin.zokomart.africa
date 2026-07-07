<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import SchemaForm, { type FormField, type SelectOption } from '@/components/SchemaForm.vue';
import { apiMenuTree, apiMenuCreate, apiMenuUpdate, apiMenuDelete } from '@/api/system/menu';
import type { MenuVO, Id } from '@/types/api';
import type { MenuSaveDTO } from '@/types/system';

const { t } = useI18n();

const formRef = ref<InstanceType<typeof SchemaForm>>();
const loading = ref(false);
const menuTree = ref<MenuVO[]>([]);

const TYPE_LABEL = computed<Record<number, string>>(() => ({
  1: t('system.menu.typeDirectory'),
  2: t('system.menu.typeMenu'),
  3: t('system.menu.typeButton'),
}));
const TYPE_COLOR: Record<number, string> = { 1: 'blue', 2: 'green', 3: 'orange' };

const columns = computed<TableColumnsType>(() => [
  { title: t('system.menu.name'), dataIndex: 'name', key: 'name' },
  { title: t('system.menu.type'), dataIndex: 'type', key: 'type', width: 90 },
  { title: t('system.menu.permCode'), dataIndex: 'permCode', key: 'permCode' },
  { title: t('system.menu.route'), dataIndex: 'routePath', key: 'routePath' },
  { title: t('system.menu.component'), dataIndex: 'component', key: 'component' },
  { title: t('common.sort'), dataIndex: 'sort', key: 'sort', width: 80 },
  { title: t('system.menu.visible'), dataIndex: 'visible', key: 'visible', width: 80 },
  { title: t('common.operation'), key: 'action', width: 220 },
]);

async function loadTree() {
  loading.value = true;
  try {
    menuTree.value = await apiMenuTree();
  } finally {
    loading.value = false;
  }
}
onMounted(loadTree);

// 扁平化为「上级菜单」下拉选项（含顶级）
const parentOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [{ label: t('system.menu.rootDirectory'), value: 0 }];
  const walk = (nodes: MenuVO[], depth: number) => {
    nodes.forEach((n) => {
      if (n.type !== 3) {
        opts.push({ label: `${'　'.repeat(depth)}${n.name}`, value: n.id });
        if (n.children?.length) walk(n.children, depth + 1);
      }
    });
  };
  walk(menuTree.value, 0);
  return opts;
});

const formSchema = computed<FormField[]>(() => [
  { field: 'parentId', label: t('system.menu.parentMenu'), component: 'select', options: parentOptions.value },
  { field: 'name', label: t('system.menu.name'), component: 'input', rules: [{ required: true, message: t('system.menu.inputName') }] },
  {
    field: 'type',
    label: t('system.menu.type'),
    component: 'select',
    rules: [{ required: true, message: t('system.menu.selectType') }],
    options: [
      { label: t('system.menu.typeDirectory'), value: 1 },
      { label: t('system.menu.typeMenu'), value: 2 },
      { label: t('system.menu.typeButton'), value: 3 },
    ],
  },
  { field: 'permCode', label: t('system.menu.permCode'), component: 'input', placeholder: t('system.menu.permCodePlaceholder') },
  { field: 'routePath', label: t('system.menu.route'), component: 'input', placeholder: t('system.menu.routePlaceholder') },
  { field: 'component', label: t('system.menu.component'), component: 'input', placeholder: t('system.menu.componentPlaceholder') },
  { field: 'icon', label: t('system.menu.icon'), component: 'input', placeholder: t('system.menu.iconPlaceholder') },
  { field: 'sort', label: t('common.sort'), component: 'number' },
  { field: 'visible', label: t('system.menu.visible'), component: 'switch' },
  { field: 'status', label: t('common.enabled'), component: 'switch' },
]);

// ---- 弹窗 ----
const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

function openCreate(parentId: Id = 0) {
  editingId.value = null;
  formInitial.value = { parentId, type: 2, sort: 0, visible: 1, status: 1 };
  modalOpen.value = true;
}
function openEdit(row: MenuVO) {
  editingId.value = row.id;
  formInitial.value = {
    parentId: row.parentId,
    name: row.name,
    type: row.type,
    permCode: row.permCode,
    routePath: row.routePath,
    component: row.component,
    icon: row.icon,
    sort: row.sort,
    visible: row.visible,
    status: row.status,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const payload = formRef.value!.getValues() as MenuSaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) await apiMenuUpdate(editingId.value, payload);
    else await apiMenuCreate(payload);
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    await loadTree();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: MenuVO) {
  await apiMenuDelete(row.id);
  message.success(t('common.deleteSuccess'));
  await loadTree();
}

defineExpose({ openCreate, openEdit, onSubmit });
</script>

<template>
  <a-card :bordered="false">
    <div class="mb-3">
      <a-button v-perm="'system:menu:create'" type="primary" data-test="menu-create" @click="openCreate(0)">
        {{ t('system.menu.createMenu') }}
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="menuTree"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag :color="TYPE_COLOR[record.type]">{{ TYPE_LABEL[record.type] }}</a-tag>
        </template>
        <template v-else-if="column.key === 'visible'">
          <a-tag :color="record.visible === 1 ? 'green' : 'default'">
            {{ record.visible === 1 ? t('common.yes') : t('common.no') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a v-if="record.type !== 3" v-perm="'system:menu:create'" @click="openCreate(record.id)">{{ t('system.menu.addChild') }}</a>
            <a v-perm="'system:menu:update'" @click="openEdit(record as MenuVO)">{{ t('common.edit') }}</a>
            <a-popconfirm :title="t('system.menu.deleteConfirm')" @confirm="onDelete(record as MenuVO)">
              <a v-perm="'system:menu:delete'" class="text-red-500">{{ t('common.delete') }}</a>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('system.menu.editMenu') : t('system.menu.createMenu')"
      :confirm-loading="submitting"
      destroy-on-close
      width="640px"
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </a-card>
</template>
