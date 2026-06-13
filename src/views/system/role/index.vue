<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import { apiRolePage, apiRoleCreate, apiRoleUpdate, apiRoleDelete } from '@/api/system/role';
import { apiMenuTree } from '@/api/system/menu';
import type { RoleVO, RoleSaveDTO } from '@/types/system';
import type { MenuVO } from '@/types/api';

const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

// ---- 查询 ----
const searchForm = reactive<{ keyword?: string }>({});
const query = ref<Record<string, any>>({});
const onSearch = () => (query.value = { ...searchForm });
const onReset = () => {
  searchForm.keyword = undefined;
  query.value = {};
};

const columns: TableColumnsType = [
  { title: '角色名', dataIndex: 'name', key: 'name' },
  { title: '角色编码', dataIndex: 'code', key: 'code' },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 180 },
];

const formSchema: FormField[] = [
  { field: 'name', label: '角色名', component: 'input', rules: [{ required: true, message: '请输入角色名' }] },
  { field: 'code', label: '角色编码', component: 'input', rules: [{ required: true, message: '请输入角色编码' }] },
  { field: 'sort', label: '排序', component: 'number' },
  { field: 'status', label: '启用', component: 'switch' },
  { field: 'remark', label: '备注', component: 'textarea' },
];

// ---- 菜单授权树 ----
type TreeKey = string | number;
const menuTree = ref<MenuVO[]>([]);
const checkedKeys = ref<TreeKey[]>([]);
const halfCheckedKeys = ref<TreeKey[]>([]);
const treeFieldNames = { title: 'name', key: 'id', children: 'children' };

async function ensureMenuTree() {
  if (!menuTree.value.length) menuTree.value = await apiMenuTree();
}
function onTreeCheck(keys: any, info: { halfCheckedKeys?: TreeKey[] }) {
  // a-tree 非严格模式下 v-model 仅返回全选节点；半选父节点从事件取
  checkedKeys.value = Array.isArray(keys) ? keys : keys.checked;
  halfCheckedKeys.value = info?.halfCheckedKeys ?? [];
}

// ---- 弹窗 ----
const modalOpen = ref(false);
const editingId = ref<number | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

async function openCreate() {
  await ensureMenuTree();
  editingId.value = null;
  formInitial.value = { status: 1, sort: 0 };
  checkedKeys.value = [];
  halfCheckedKeys.value = [];
  modalOpen.value = true;
}
async function openEdit(row: RoleVO) {
  await ensureMenuTree();
  editingId.value = row.id;
  formInitial.value = {
    name: row.name,
    code: row.code,
    sort: row.sort,
    status: row.status,
    remark: row.remark,
  };
  checkedKeys.value = [...(row.menuIds || [])];
  halfCheckedKeys.value = [];
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const values = formRef.value!.getValues();
  const menuIds = [...new Set([...checkedKeys.value, ...halfCheckedKeys.value])].map(Number);
  const payload: RoleSaveDTO = { ...(values as RoleSaveDTO), menuIds };
  submitting.value = true;
  try {
    if (editingId.value) await apiRoleUpdate(editingId.value, payload);
    else await apiRoleCreate(payload);
    message.success('保存成功');
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: RoleVO) {
  await apiRoleDelete(row.id);
  message.success('已删除');
  tableRef.value?.reload();
}

defineExpose({ openCreate, openEdit, onSubmit, onTreeCheck });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item label="关键字">
          <a-input
            v-model:value="searchForm.keyword"
            placeholder="角色名/编码"
            allow-clear
            @press-enter="onSearch"
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
        <a-button v-perm="'system:role:create'" type="primary" data-test="role-create" @click="openCreate">
          新增角色
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiRolePage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'system:role:update'" @click="openEdit(record)">编辑</a>
              <a-popconfirm title="确认删除该角色？" @confirm="onDelete(record)">
                <a v-perm="'system:role:delete'" class="text-red-500">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑角色' : '新增角色'"
      :confirm-loading="submitting"
      destroy-on-close
      width="640px"
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
      <div class="mt-2">
        <div class="mb-2 font-medium">菜单授权</div>
        <a-tree
          v-model:checked-keys="checkedKeys"
          checkable
          :tree-data="(menuTree as any)"
          :field-names="treeFieldNames"
          @check="onTreeCheck"
        />
      </div>
    </a-modal>
  </div>
</template>
