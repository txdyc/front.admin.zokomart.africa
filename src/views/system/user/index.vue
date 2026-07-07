<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();

const tableRef = ref<InstanceType<typeof BasicTable>>();
const formRef = ref<InstanceType<typeof SchemaForm>>();

const statusOptions = computed(() => [
  { label: t('common.enabled'), value: 1 },
  { label: t('common.disabled'), value: 0 },
]);

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

const columns = computed<TableColumnsType>(() => [
  { title: t('system.user.username'), dataIndex: 'username', key: 'username' },
  { title: t('system.user.nickname'), dataIndex: 'nickname', key: 'nickname' },
  { title: t('system.user.phone'), dataIndex: 'phone', key: 'phone' },
  { title: t('system.user.email'), dataIndex: 'email', key: 'email' },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 90 },
  { title: t('common.createTime'), dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: t('common.operation'), key: 'action', width: 280 },
]);

// ---- 新增/编辑弹窗 ----
const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

const formSchema = computed<FormField[]>(() => [
  {
    field: 'username',
    label: t('system.user.username'),
    component: 'input',
    rules: [{ required: true, message: t('system.user.inputUsername') }],
  },
  {
    field: 'password',
    label: editingId.value ? t('system.user.passwordEdit') : t('system.user.password'),
    component: 'password',
    placeholder: editingId.value ? t('system.user.passwordEmptyHint') : t('system.user.passwordInitHint'),
    rules: editingId.value ? [] : [{ required: true, message: t('system.user.passwordInitHint') }],
  },
  { field: 'nickname', label: t('system.user.nickname'), component: 'input' },
  { field: 'phone', label: t('system.user.phone'), component: 'input' },
  { field: 'email', label: t('system.user.email'), component: 'input' },
  { field: 'status', label: t('system.user.enable'), component: 'switch' },
  { field: 'remark', label: t('common.remark'), component: 'textarea' },
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
    message.success(t('common.saveSuccess'));
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
  message.success(t('common.operateSuccess'));
  tableRef.value?.reload();
}

async function onDelete(row: UserVO) {
  await apiUserDelete(row.id);
  message.success(t('common.deleteSuccess'));
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
  message.success(t('system.user.roleUpdated'));
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
    message.warning(t('system.user.inputNewPwd'));
    return;
  }
  await apiUserResetPwd(pwdTargetId.value!, newPwd.value);
  message.success(t('system.user.pwdReset'));
  pwdOpen.value = false;
}

defineExpose({ openCreate, openEdit, onSubmit });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item :label="t('system.user.username')">
          <a-input
            v-model:value="searchForm.username"
            :placeholder="t('system.user.usernamePlaceholder')"
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
            :options="statusOptions"
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
        <a-button v-perm="'system:user:create'" type="primary" data-test="user-create" @click="openCreate">
          {{ t('system.user.createUser') }}
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiUserPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? t('common.enabled') : t('common.disabled') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'system:user:update'" @click="openEdit(record)">{{ t('common.edit') }}</a>
              <a v-perm="'system:user:update'" @click="openRoles(record)">{{ t('system.user.assignRoleAction') }}</a>
              <a v-perm="'system:user:resetPwd'" @click="openResetPwd(record)">{{ t('system.user.resetPwd') }}</a>
              <a-popconfirm
                v-if="record.isSuper !== 1"
                :title="t('system.user.toggleConfirm', { action: record.status === 1 ? t('common.disabled') : t('common.enabled') })"
                @confirm="onToggleStatus(record)"
              >
                <a v-perm="'system:user:update'">{{ record.status === 1 ? t('common.disabled') : t('common.enabled') }}</a>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.isSuper !== 1"
                :title="t('system.user.deleteConfirm')"
                @confirm="onDelete(record)"
              >
                <a v-perm="'system:user:delete'" class="text-red-500">{{ t('common.delete') }}</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('system.user.editUser') : t('system.user.createUser')"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>

    <!-- 赋角色 -->
    <a-modal v-model:open="rolesOpen" :title="t('system.user.assignRole')" @ok="onSubmitRoles">
      <a-select
        v-model:value="selectedRoleIds"
        mode="multiple"
        class="w-full"
        :placeholder="t('system.user.selectRole')"
        :options="roleOptions"
      />
    </a-modal>

    <!-- 重置密码 -->
    <a-modal v-model:open="pwdOpen" :title="t('system.user.resetPwd')" @ok="onSubmitPwd">
      <a-input-password v-model:value="newPwd" :placeholder="t('system.user.newPwdPlaceholder')" />
    </a-modal>
  </div>
</template>
