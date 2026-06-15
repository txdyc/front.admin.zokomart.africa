<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import SchemaForm, { type FormField, type SelectOption } from '@/components/SchemaForm.vue';
import { apiMenuTree, apiMenuCreate, apiMenuUpdate, apiMenuDelete } from '@/api/system/menu';
import type { MenuVO, Id } from '@/types/api';
import type { MenuSaveDTO } from '@/types/system';

const formRef = ref<InstanceType<typeof SchemaForm>>();
const loading = ref(false);
const menuTree = ref<MenuVO[]>([]);

const TYPE_LABEL: Record<number, string> = { 1: '目录', 2: '菜单', 3: '按钮' };
const TYPE_COLOR: Record<number, string> = { 1: 'blue', 2: 'green', 3: 'orange' };

const columns: TableColumnsType = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 90 },
  { title: '权限码', dataIndex: 'permCode', key: 'permCode' },
  { title: '路由', dataIndex: 'routePath', key: 'routePath' },
  { title: '组件', dataIndex: 'component', key: 'component' },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
  { title: '显示', dataIndex: 'visible', key: 'visible', width: 80 },
  { title: '操作', key: 'action', width: 220 },
];

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
  const opts: SelectOption[] = [{ label: '顶级目录', value: 0 }];
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
  { field: 'parentId', label: '上级菜单', component: 'select', options: parentOptions.value },
  { field: 'name', label: '名称', component: 'input', rules: [{ required: true, message: '请输入名称' }] },
  {
    field: 'type',
    label: '类型',
    component: 'select',
    rules: [{ required: true, message: '请选择类型' }],
    options: [
      { label: '目录', value: 1 },
      { label: '菜单', value: 2 },
      { label: '按钮', value: 3 },
    ],
  },
  { field: 'permCode', label: '权限码', component: 'input', placeholder: '如 system:user:list' },
  { field: 'routePath', label: '路由', component: 'input', placeholder: '如 /system/user' },
  { field: 'component', label: '组件', component: 'input', placeholder: '如 system/user/index' },
  { field: 'icon', label: '图标', component: 'input', placeholder: '如 ant-design:setting-outlined' },
  { field: 'sort', label: '排序', component: 'number' },
  { field: 'visible', label: '显示', component: 'switch' },
  { field: 'status', label: '启用', component: 'switch' },
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
    message.success('保存成功');
    modalOpen.value = false;
    await loadTree();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: MenuVO) {
  await apiMenuDelete(row.id);
  message.success('已删除');
  await loadTree();
}

defineExpose({ openCreate, openEdit, onSubmit });
</script>

<template>
  <a-card :bordered="false">
    <div class="mb-3">
      <a-button v-perm="'system:menu:create'" type="primary" data-test="menu-create" @click="openCreate(0)">
        新增菜单
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
            {{ record.visible === 1 ? '是' : '否' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a v-if="record.type !== 3" v-perm="'system:menu:create'" @click="openCreate(record.id)">新增子项</a>
            <a v-perm="'system:menu:update'" @click="openEdit(record as MenuVO)">编辑</a>
            <a-popconfirm title="确认删除该菜单？删除前请先移除子菜单。" @confirm="onDelete(record as MenuVO)">
              <a v-perm="'system:menu:delete'" class="text-red-500">删除</a>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑菜单' : '新增菜单'"
      :confirm-loading="submitting"
      destroy-on-close
      width="640px"
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </a-card>
</template>
