<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import { apiRolePage, apiRoleCreate, apiRoleUpdate, apiRoleDelete } from '@/api/system/role';
import { apiMenuTree } from '@/api/system/menu';
import type { RoleVO, RoleSaveDTO } from '@/types/system';
import type { MenuVO, Id } from '@/types/api';

const { t } = useI18n();

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

const columns = computed<TableColumnsType>(() => [
  { title: t('system.role.roleName'), dataIndex: 'name', key: 'name' },
  { title: t('system.role.roleCode'), dataIndex: 'code', key: 'code' },
  { title: t('common.sort'), dataIndex: 'sort', key: 'sort', width: 90 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 90 },
  { title: t('common.operation'), key: 'action', width: 180 },
]);

const formSchema = computed<FormField[]>(() => [
  { field: 'name', label: t('system.role.roleName'), component: 'input', rules: [{ required: true, message: t('system.role.inputRoleName') }] },
  { field: 'code', label: t('system.role.roleCode'), component: 'input', rules: [{ required: true, message: t('system.role.inputRoleCode') }] },
  { field: 'sort', label: t('common.sort'), component: 'number' },
  { field: 'status', label: t('common.enabled'), component: 'switch' },
  { field: 'remark', label: t('common.remark'), component: 'textarea' },
]);

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
const editingId = ref<Id | null>(null);
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
  // 直接用原始 key（可能是雪花字符串 id），切勿 Number() 强转以免丢精度
  const menuIds = [...new Set([...checkedKeys.value, ...halfCheckedKeys.value])];
  const payload: RoleSaveDTO = { ...(values as RoleSaveDTO), menuIds };
  submitting.value = true;
  try {
    if (editingId.value) await apiRoleUpdate(editingId.value, payload);
    else await apiRoleCreate(payload);
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: RoleVO) {
  await apiRoleDelete(row.id);
  message.success(t('common.deleteSuccess'));
  tableRef.value?.reload();
}

defineExpose({ openCreate, openEdit, onSubmit, onTreeCheck });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item :label="t('common.keyword')">
          <a-input
            v-model:value="searchForm.keyword"
            :placeholder="t('system.role.keywordPlaceholder')"
            allow-clear
            @press-enter="onSearch"
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
        <a-button v-perm="'system:role:create'" type="primary" data-test="role-create" @click="openCreate">
          {{ t('system.role.createRole') }}
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiRolePage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? t('common.enabled') : t('common.disabled') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'system:role:update'" @click="openEdit(record)">{{ t('common.edit') }}</a>
              <a-popconfirm :title="t('system.role.deleteConfirm')" @confirm="onDelete(record)">
                <a v-perm="'system:role:delete'" class="text-red-500">{{ t('common.delete') }}</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('system.role.editRole') : t('system.role.createRole')"
      :confirm-loading="submitting"
      destroy-on-close
      width="640px"
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
      <div class="mt-2">
        <div class="mb-2 font-medium">{{ t('system.role.menuAuth') }}</div>
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
