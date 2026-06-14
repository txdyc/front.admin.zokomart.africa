<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import SchemaForm, { type FormField } from '@/components/SchemaForm.vue';
import {
  apiUserPage,
  apiUserCreate,
  apiUserUpdate,
  apiUserDelete,
  apiUserSetRoles,
  apiUserResetPwd,
} from '@/api/system/user';
import { apiRolePage } from '@/api/system/role';
import type { UserVO, UserSaveDTO } from '@/types/system';
import type { Id } from '@/types/api';
import type { SelectOption } from '@/components/SchemaForm.vue';

const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

// ---- 查询 ----
const searchForm = reactive<{ username?: string; status?: number }>({});
const query = ref<Record<string, any>>({});
function onSearch() {
  query.value = { ...searchForm };
}
function onReset() {
  searchForm.username = undefined;
  searchForm.status = undefined;
  query.value = {};
}

const columns: TableColumnsType = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '操作', key: 'action', width: 280 },
];

// ---- 新增/编辑弹窗 ----
const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

const formSchema = computed<FormField[]>(() => [
  {
    field: 'username',
    label: '用户名',
    component: 'input',
    rules: [{ required: true, message: '请输入用户名' }],
  },
  {
    field: 'password',
    label: editingId.value ? '密码（留空不修改）' : '密码',
    component: 'password',
    placeholder: editingId.value ? '留空表示不修改' : '请输入初始密码',
    rules: editingId.value ? [] : [{ required: true, message: '请输入初始密码' }],
  },
  { field: 'nickname', label: '昵称', component: 'input' },
  { field: 'phone', label: '手机号', component: 'input' },
  { field: 'email', label: '邮箱', component: 'input' },
  { field: 'status', label: '启用', component: 'switch' },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

function openCreate() {
  editingId.value = null;
  formInitial.value = { status: 1 };
  modalOpen.value = true;
}
function openEdit(row: UserVO) {
  editingId.value = row.id;
  formInitial.value = {
    username: row.username,
    nickname: row.nickname,
    phone: row.phone,
    email: row.email,
    status: row.status,
    remark: row.remark,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (!(await formRef.value?.validate())) return;
  const values = formRef.value!.getValues() as UserSaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) {
      await apiUserUpdate(editingId.value, values);
    } else {
      await apiUserCreate(values);
    }
    message.success('保存成功');
    modalOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

// ---- 启用/停用（需回传全字段，后端 update 会覆盖空值）----
async function onToggleStatus(row: UserVO) {
  await apiUserUpdate(row.id, {
    username: row.username,
    nickname: row.nickname,
    phone: row.phone,
    email: row.email,
    remark: row.remark,
    status: row.status === 1 ? 0 : 1,
  });
  message.success('操作成功');
  tableRef.value?.reload();
}

async function onDelete(row: UserVO) {
  await apiUserDelete(row.id);
  message.success('已删除');
  tableRef.value?.reload();
}

// ---- 赋角色弹窗 ----
const rolesOpen = ref(false);
const rolesTargetId = ref<Id | null>(null);
const roleOptions = ref<SelectOption[]>([]);
const selectedRoleIds = ref<Id[]>([]);
async function openRoles(row: UserVO) {
  rolesTargetId.value = row.id;
  selectedRoleIds.value = [...(row.roleIds || [])];
  const page = await apiRolePage({ current: 1, size: 200 });
  roleOptions.value = page.records.map((r) => ({ label: r.name, value: r.id }));
  rolesOpen.value = true;
}
async function onSubmitRoles() {
  await apiUserSetRoles(rolesTargetId.value!, selectedRoleIds.value);
  message.success('角色已更新');
  rolesOpen.value = false;
  tableRef.value?.reload();
}

// ---- 重置密码弹窗 ----
const pwdOpen = ref(false);
const pwdTargetId = ref<Id | null>(null);
const newPwd = ref('');
function openResetPwd(row: UserVO) {
  pwdTargetId.value = row.id;
  newPwd.value = '';
  pwdOpen.value = true;
}
async function onSubmitPwd() {
  if (!newPwd.value) {
    message.warning('请输入新密码');
    return;
  }
  await apiUserResetPwd(pwdTargetId.value!, newPwd.value);
  message.success('密码已重置');
  pwdOpen.value = false;
}

defineExpose({ openCreate, openEdit, onSubmit });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item label="用户名">
          <a-input
            v-model:value="searchForm.username"
            placeholder="用户名"
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
        <a-button v-perm="'system:user:create'" type="primary" data-test="user-create" @click="openCreate">
          新增用户
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiUserPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'system:user:update'" @click="openEdit(record)">编辑</a>
              <a v-perm="'system:user:update'" @click="openRoles(record)">赋角色</a>
              <a v-perm="'system:user:resetPwd'" @click="openResetPwd(record)">重置密码</a>
              <a-popconfirm
                v-if="record.isSuper !== 1"
                :title="`确认${record.status === 1 ? '停用' : '启用'}该用户？`"
                @confirm="onToggleStatus(record)"
              >
                <a v-perm="'system:user:update'">{{ record.status === 1 ? '停用' : '启用' }}</a>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.isSuper !== 1"
                title="确认删除该用户？"
                @confirm="onDelete(record)"
              >
                <a v-perm="'system:user:delete'" class="text-red-500">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑用户' : '新增用户'"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>

    <!-- 赋角色 -->
    <a-modal v-model:open="rolesOpen" title="分配角色" @ok="onSubmitRoles">
      <a-select
        v-model:value="selectedRoleIds"
        mode="multiple"
        class="w-full"
        placeholder="选择角色"
        :options="roleOptions"
      />
    </a-modal>

    <!-- 重置密码 -->
    <a-modal v-model:open="pwdOpen" title="重置密码" @ok="onSubmitPwd">
      <a-input-password v-model:value="newPwd" placeholder="请输入新密码" />
    </a-modal>
  </div>
</template>
