<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import CascadeFilter from '@/components/CascadeFilter.vue';
import {
  apiPlanPage,
  apiPlanGet,
  apiPlanCreate,
  apiPlanUpdate,
  apiPlanDelete,
  apiPlanSubmit,
  apiPlanApprove,
  apiPlanReject,
} from '@/api/purchase/plan';
import { apiSupplierProductPage } from '@/api/product/supplierProduct';
import { apiSupplierPage } from '@/api/basedata/supplier';
import type { PurchasePlanVO, PurchasePlanSaveDTO, PlanStatus } from '@/types/purchase';
import type { SupplierProductVO, SupplierProductQuery } from '@/types/product';
import type { SelectOption } from '@/components/SchemaForm.vue';
import type { Id } from '@/types/api';

const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);
const { t } = useI18n();

const STATUS_LABEL = computed<Record<PlanStatus, string>>(() => ({
  DRAFT: t('purchase.plan.statusDraft'),
  PENDING: t('purchase.plan.statusPending'),
  APPROVED: t('purchase.plan.statusApproved'),
  REJECTED: t('purchase.plan.statusRejected'),
}));
const STATUS_COLOR: Record<PlanStatus, string> = {
  DRAFT: 'default',
  PENDING: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
};
const isEditable = (s: PlanStatus) => s === 'DRAFT' || s === 'REJECTED';

// ---------------- 列表 ----------------
const tableRef = ref<InstanceType<typeof BasicTable>>();
const searchForm = reactive<{ status?: PlanStatus; supplierId?: Id }>({});
const query = ref<Record<string, any>>({});
const supplierOptions = ref<SelectOption[]>([]);

async function loadSuppliers() {
  const page = await apiSupplierPage({ status: 1, current: 1, size: 1000 });
  supplierOptions.value = page.records.map((s) => ({ label: s.name, value: s.id }));
}
onMounted(loadSuppliers);

const onSearch = () => (query.value = { ...searchForm });
const onReset = () => {
  searchForm.status = undefined;
  searchForm.supplierId = undefined;
  query.value = {};
};

const listColumns = computed<TableColumnsType>(() => [
  { title: t('purchase.plan.planNo'), dataIndex: 'planNo', key: 'planNo' },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 100 },
  { title: t('common.totalQty'), dataIndex: 'totalQty', key: 'totalQty', width: 90 },
  { title: t('purchase.plan.totalAmountGhs'), dataIndex: 'totalAmount', key: 'totalAmount', width: 130 },
  { title: t('common.createTime'), dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: t('common.operation'), key: 'action', width: 240 },
]);

const statusOptions = computed(() => [
  { label: t('purchase.plan.statusDraft'), value: 'DRAFT' },
  { label: t('purchase.plan.statusPending'), value: 'PENDING' },
  { label: t('purchase.plan.statusApproved'), value: 'APPROVED' },
  { label: t('purchase.plan.statusRejected'), value: 'REJECTED' },
]);

// ---------------- 编辑抽屉：草稿购物车 ----------------
interface DraftRow {
  supplierProductId: Id;
  productName: string;
  productCode: string;
  supplierId: Id;
  minPurchaseQty: number;
  wholesalePrice: number;
  purchaseQty: number;
}
// 跨供应商累积所选明细，键为 String(supplierProductId)
const draft = reactive<Record<string, DraftRow>>({});
function clearDraft() {
  Object.keys(draft).forEach((k) => delete draft[k]);
}

const drawerOpen = ref(false);
const mode = ref<'create' | 'edit' | 'view'>('create');
const editingId = ref<Id | null>(null);
const remark = ref<string>('');
const approveRemark = ref<string | null>(null);
const viewMeta = ref<Pick<PurchasePlanVO, 'planNo' | 'status' | 'totalQty' | 'totalAmount'> | null>(null);
const submitting = ref(false);

// 产品选择器（编辑态）
const productFilter = ref<SupplierProductQuery>({});
const productQuery = ref<Record<string, any>>({});
const onProductFilterChange = (v: SupplierProductQuery) => (productQuery.value = { ...v });

const productColumns = computed<TableColumnsType>(() => [
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.code'), dataIndex: 'productCode', key: 'productCode', width: 120 },
  { title: 'MOQ', dataIndex: 'minPurchaseQty', key: 'minPurchaseQty', width: 70 },
  { title: t('common.wholesalePrice'), dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
  { title: t('purchase.plan.purchaseQty'), key: 'qty', width: 140 },
]);

function getQty(productId: Id): number {
  return draft[String(productId)]?.purchaseQty ?? 0;
}
function setQty(row: SupplierProductVO, val: number | null) {
  const key = String(row.id);
  const qty = val ?? 0;
  if (qty <= 0 && draft[key]) {
    // 0/清空：仍保留为 0，便于输入框回显；汇总与保存按 >0 过滤
    draft[key].purchaseQty = 0;
    return;
  }
  draft[key] = {
    supplierProductId: row.id,
    productName: row.name,
    productCode: row.productCode,
    supplierId: row.supplierId,
    minPurchaseQty: row.minPurchaseQty ?? 1,
    wholesalePrice: row.wholesalePrice ?? 0,
    purchaseQty: qty,
  };
}

const selectedRows = computed(() => Object.values(draft).filter((r) => r.purchaseQty > 0));
const totalQty = computed(() => selectedRows.value.reduce((s, r) => s + r.purchaseQty, 0));
const totalAmount = computed(() =>
  selectedRows.value.reduce((s, r) => s + r.wholesalePrice * r.purchaseQty, 0),
);
// 任何 0<qty<MOQ 行为非法
const rowInvalid = (r: DraftRow) => r.purchaseQty > 0 && r.purchaseQty < r.minPurchaseQty;
const hasInvalid = computed(() => selectedRows.value.some(rowInvalid));
const canSave = computed(() => selectedRows.value.length > 0 && !hasInvalid.value);

function openCreate() {
  mode.value = 'create';
  editingId.value = null;
  remark.value = '';
  approveRemark.value = null;
  viewMeta.value = null;
  clearDraft();
  productFilter.value = {};
  productQuery.value = {};
  drawerOpen.value = true;
}

async function loadIntoDraft(id: Id, m: 'edit' | 'view') {
  const detail = await apiPlanGet(id);
  mode.value = m;
  editingId.value = id;
  remark.value = detail.remark ?? '';
  approveRemark.value = detail.approveRemark ?? null;
  viewMeta.value = {
    planNo: detail.planNo,
    status: detail.status,
    totalQty: detail.totalQty,
    totalAmount: detail.totalAmount,
  };
  clearDraft();
  (detail.items ?? []).forEach((it) => {
    draft[String(it.supplierProductId)] = {
      supplierProductId: it.supplierProductId,
      productName: it.productName,
      productCode: it.productCode,
      supplierId: it.supplierId,
      minPurchaseQty: it.minPurchaseQty ?? 1,
      wholesalePrice: it.wholesalePrice ?? 0,
      purchaseQty: it.purchaseQty,
    };
  });
  productFilter.value = {};
  productQuery.value = {};
  drawerOpen.value = true;
}
const openEdit = (row: PurchasePlanVO) => loadIntoDraft(row.id, 'edit');
const openView = (row: PurchasePlanVO) => loadIntoDraft(row.id, 'view');

function buildPayload(): PurchasePlanSaveDTO {
  return {
    remark: remark.value || null,
    items: selectedRows.value.map((r) => ({
      supplierProductId: r.supplierProductId,
      purchaseQty: r.purchaseQty,
    })),
  };
}

async function save() {
  if (selectedRows.value.length === 0) {
    message.warning(t('purchase.plan.atLeastOneItem'));
    return;
  }
  if (hasInvalid.value) {
    message.warning(t('purchase.plan.belowMoqExists'));
    return;
  }
  submitting.value = true;
  try {
    if (editingId.value) await apiPlanUpdate(editingId.value, buildPayload());
    else await apiPlanCreate(buildPayload());
    message.success(t('purchase.plan.savedDraft'));
    drawerOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

// ---------------- 列表行操作 ----------------
async function submitPlan(row: PurchasePlanVO) {
  await apiPlanSubmit(row.id);
  message.success(t('purchase.plan.submitted'));
  tableRef.value?.reload();
}
async function deletePlan(row: PurchasePlanVO) {
  await apiPlanDelete(row.id);
  message.success(t('common.deleteSuccess'));
  tableRef.value?.reload();
}
async function approve(row: PurchasePlanVO) {
  await apiPlanApprove(row.id);
  message.success(t('purchase.plan.approvedGenerated'));
  tableRef.value?.reload();
}

// 退回
const rejectOpen = ref(false);
const rejectReason = ref('');
const rejectTarget = ref<PurchasePlanVO | null>(null);
function openReject(row: PurchasePlanVO) {
  rejectTarget.value = row;
  rejectReason.value = '';
  rejectOpen.value = true;
}
async function doReject() {
  if (!rejectReason.value.trim()) {
    message.warning(t('purchase.plan.fillRejectReason'));
    return;
  }
  await apiPlanReject(rejectTarget.value!.id, rejectReason.value.trim());
  message.success(t('purchase.plan.rejected'));
  rejectOpen.value = false;
  tableRef.value?.reload();
}

defineExpose({
  openCreate, openEdit, openView, setQty, getQty, save,
  submitPlan, deletePlan, approve, openReject, doReject,
});
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item :label="t('common.status')">
          <a-select
            v-model:value="searchForm.status"
            :placeholder="t('common.all')"
            allow-clear
            style="width: 130px"
            :options="statusOptions"
          />
        </a-form-item>
        <a-form-item :label="t('common.supplier')">
          <a-select
            v-model:value="searchForm.supplierId"
            :placeholder="t('common.all')"
            show-search
            option-filter-prop="label"
            allow-clear
            style="width: 200px"
            :options="supplierOptions"
            data-test="plan-filter-supplier"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" data-test="plan-search" @click="onSearch">{{ t('common.search') }}</a-button>
            <a-button @click="onReset">{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false">
      <div class="mb-3">
        <a-button v-perm="'purchase:plan:create'" type="primary" data-test="plan-create" @click="openCreate">
          {{ t('purchase.plan.createPlan') }}
        </a-button>
      </div>

      <BasicTable ref="tableRef" :columns="listColumns" :fetcher="apiPlanPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="STATUS_COLOR[(record as PurchasePlanVO).status]">
              {{ STATUS_LABEL[(record as PurchasePlanVO).status] }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'totalAmount'">
            {{ money(record.totalAmount) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a @click="openView(record as PurchasePlanVO)">{{ t('purchase.plan.view') }}</a>
              <template v-if="isEditable((record as PurchasePlanVO).status)">
                <a v-perm="'purchase:plan:update'" @click="openEdit(record as PurchasePlanVO)">{{ t('common.edit') }}</a>
                <a-popconfirm :title="t('purchase.plan.confirmSubmit')" @confirm="submitPlan(record as PurchasePlanVO)">
                  <a v-perm="'purchase:plan:submit'">{{ t('purchase.plan.submit') }}</a>
                </a-popconfirm>
                <a-popconfirm :title="t('purchase.plan.confirmDelete')" @confirm="deletePlan(record as PurchasePlanVO)">
                  <a v-perm="'purchase:plan:delete'" class="text-red-500">{{ t('common.delete') }}</a>
                </a-popconfirm>
              </template>
              <template v-else-if="(record as PurchasePlanVO).status === 'PENDING'">
                <a-popconfirm :title="t('purchase.plan.confirmApprove')" @confirm="approve(record as PurchasePlanVO)">
                  <a v-perm="'purchase:plan:approve'" class="text-green-600">{{ t('purchase.plan.approve') }}</a>
                </a-popconfirm>
                <a v-perm="'purchase:plan:approve'" class="text-red-500" @click="openReject(record as PurchasePlanVO)">{{ t('purchase.plan.reject') }}</a>
              </template>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <!-- 编辑 / 查看抽屉 -->
    <a-drawer
      v-model:open="drawerOpen"
      :title="mode === 'create' ? t('purchase.plan.createTitle') : mode === 'edit' ? t('purchase.plan.editTitle') : t('purchase.plan.viewTitle')"
      width="920"
      destroy-on-close
    >
      <a-alert
        v-if="approveRemark"
        type="warning"
        show-icon
        class="mb-3"
        :message="t('purchase.plan.rejectReasonPrefix', { reason: approveRemark })"
      />

      <div v-if="viewMeta && mode === 'view'" class="mb-3">
        <a-descriptions size="small" :column="2" bordered>
          <a-descriptions-item :label="t('purchase.plan.planNo')">{{ viewMeta.planNo }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">{{ STATUS_LABEL[viewMeta.status] }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.totalQty')">{{ viewMeta.totalQty ?? 0 }}</a-descriptions-item>
          <a-descriptions-item :label="t('purchase.plan.totalAmountGhs')">{{ money(viewMeta.totalAmount) }}</a-descriptions-item>
        </a-descriptions>
      </div>

      <!-- 编辑态：联动筛选 + 产品选择器 -->
      <template v-if="mode !== 'view'">
        <a-card size="small" :title="t('purchase.plan.selectSupplierProduct')" class="mb-3">
          <CascadeFilter v-model="productFilter" @change="onProductFilterChange" />
          <BasicTable
            :columns="productColumns"
            :fetcher="apiSupplierProductPage"
            :params="productQuery"
            class="mt-2"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'wholesalePrice'">{{ money(record.wholesalePrice) }}</template>
              <template v-else-if="column.key === 'qty'">
                <a-input-number
                  :value="getQty(record.id)"
                  :min="0"
                  :precision="0"
                  style="width: 110px"
                  @change="(v: any) => setQty(record as SupplierProductVO, v)"
                />
              </template>
            </template>
          </BasicTable>
        </a-card>
      </template>

      <!-- 已选明细 -->
      <a-card size="small" :title="t('purchase.plan.selectedItems', { n: selectedRows.length })">
        <a-table
          :columns="[
            { title: t('common.name'), dataIndex: 'productName', key: 'productName' },
            { title: t('common.code'), dataIndex: 'productCode', key: 'productCode', width: 120 },
            { title: 'MOQ', dataIndex: 'minPurchaseQty', key: 'minPurchaseQty', width: 70 },
            { title: t('common.wholesalePrice'), dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
            { title: t('common.quantity'), dataIndex: 'purchaseQty', key: 'purchaseQty', width: 80 },
            { title: t('common.subtotal'), key: 'subtotal', width: 110 },
          ]"
          :data-source="selectedRows"
          :pagination="false"
          row-key="supplierProductId"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'wholesalePrice'">{{ money(record.wholesalePrice) }}</template>
            <template v-else-if="column.key === 'purchaseQty'">
              <span :class="{ 'text-red-500': rowInvalid(record as DraftRow) }">
                {{ record.purchaseQty }}
                <a-tooltip v-if="rowInvalid(record as DraftRow)" :title="t('purchase.plan.qtyBelowMoq')">⚠</a-tooltip>
              </span>
            </template>
            <template v-else-if="column.key === 'subtotal'">
              {{ money(record.wholesalePrice * record.purchaseQty) }}
            </template>
          </template>
        </a-table>

        <div class="mt-3 flex justify-end gap-6">
          <span>{{ t('purchase.plan.totalQtyColon') }}<b>{{ totalQty }}</b></span>
          <span>{{ t('purchase.plan.totalAmountColon') }}<b>GHS {{ money(totalAmount) }}</b></span>
        </div>
      </a-card>

      <div v-if="mode !== 'view'" class="mt-3">
        <a-textarea v-model:value="remark" :placeholder="t('purchase.plan.remarkOptional')" :rows="2" />
      </div>

      <template #footer>
        <a-space v-if="mode !== 'view'">
          <a-button @click="drawerOpen = false">{{ t('common.cancel') }}</a-button>
          <a-button type="primary" :loading="submitting" :disabled="!canSave" data-test="plan-save" @click="save">
            {{ t('purchase.plan.saveDraft') }}
          </a-button>
        </a-space>
        <a-button v-else @click="drawerOpen = false">{{ t('common.close') }}</a-button>
      </template>
    </a-drawer>

    <!-- 退回原因 -->
    <a-modal v-model:open="rejectOpen" :title="t('purchase.plan.rejectTitle')" @ok="doReject">
      <a-textarea v-model:value="rejectReason" :placeholder="t('purchase.plan.rejectPlaceholder')" :rows="3" />
    </a-modal>
  </div>
</template>
