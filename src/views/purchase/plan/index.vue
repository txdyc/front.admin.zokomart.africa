<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
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

const STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已退回',
};
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

const listColumns: TableColumnsType = [
  { title: '计划单号', dataIndex: 'planNo', key: 'planNo' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '总数量', dataIndex: 'totalQty', key: 'totalQty', width: 90 },
  { title: '总金额 (GHS)', dataIndex: 'totalAmount', key: 'totalAmount', width: 130 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '操作', key: 'action', width: 240 },
];

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

const productColumns: TableColumnsType = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '编码', dataIndex: 'productCode', key: 'productCode', width: 120 },
  { title: 'MOQ', dataIndex: 'minPurchaseQty', key: 'minPurchaseQty', width: 70 },
  { title: '批发价', dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
  { title: '采购数量', key: 'qty', width: 140 },
];

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
    message.warning('请至少录入一条采购明细（数量 > 0）');
    return;
  }
  if (hasInvalid.value) {
    message.warning('存在采购数量小于 MOQ 的明细，请修正');
    return;
  }
  submitting.value = true;
  try {
    if (editingId.value) await apiPlanUpdate(editingId.value, buildPayload());
    else await apiPlanCreate(buildPayload());
    message.success('已保存草稿');
    drawerOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

// ---------------- 列表行操作 ----------------
async function submitPlan(row: PurchasePlanVO) {
  await apiPlanSubmit(row.id);
  message.success('已提交审批');
  tableRef.value?.reload();
}
async function deletePlan(row: PurchasePlanVO) {
  await apiPlanDelete(row.id);
  message.success('已删除');
  tableRef.value?.reload();
}
async function approve(row: PurchasePlanVO) {
  await apiPlanApprove(row.id);
  message.success('已通过，已按供应商生成采购订单');
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
    message.warning('请填写退回原因');
    return;
  }
  await apiPlanReject(rejectTarget.value!.id, rejectReason.value.trim());
  message.success('已退回');
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
        <a-form-item label="状态">
          <a-select
            v-model:value="searchForm.status"
            placeholder="全部"
            allow-clear
            style="width: 130px"
            :options="[
              { label: '草稿', value: 'DRAFT' },
              { label: '待审批', value: 'PENDING' },
              { label: '已通过', value: 'APPROVED' },
              { label: '已退回', value: 'REJECTED' },
            ]"
          />
        </a-form-item>
        <a-form-item label="供应商">
          <a-select
            v-model:value="searchForm.supplierId"
            placeholder="全部"
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
            <a-button type="primary" data-test="plan-search" @click="onSearch">查询</a-button>
            <a-button @click="onReset">重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false">
      <div class="mb-3">
        <a-button v-perm="'purchase:plan:create'" type="primary" data-test="plan-create" @click="openCreate">
          新增采购计划
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
              <a @click="openView(record as PurchasePlanVO)">查看</a>
              <template v-if="isEditable((record as PurchasePlanVO).status)">
                <a v-perm="'purchase:plan:update'" @click="openEdit(record as PurchasePlanVO)">编辑</a>
                <a-popconfirm title="确认提交审批？" @confirm="submitPlan(record as PurchasePlanVO)">
                  <a v-perm="'purchase:plan:submit'">提交</a>
                </a-popconfirm>
                <a-popconfirm title="确认删除该计划？" @confirm="deletePlan(record as PurchasePlanVO)">
                  <a v-perm="'purchase:plan:delete'" class="text-red-500">删除</a>
                </a-popconfirm>
              </template>
              <template v-else-if="(record as PurchasePlanVO).status === 'PENDING'">
                <a-popconfirm title="确认通过该计划？" @confirm="approve(record as PurchasePlanVO)">
                  <a v-perm="'purchase:plan:approve'" class="text-green-600">通过</a>
                </a-popconfirm>
                <a v-perm="'purchase:plan:approve'" class="text-red-500" @click="openReject(record as PurchasePlanVO)">退回</a>
              </template>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <!-- 编辑 / 查看抽屉 -->
    <a-drawer
      v-model:open="drawerOpen"
      :title="mode === 'create' ? '新增采购计划' : mode === 'edit' ? '编辑采购计划' : '查看采购计划'"
      width="920"
      destroy-on-close
    >
      <a-alert
        v-if="approveRemark"
        type="warning"
        show-icon
        class="mb-3"
        :message="`退回原因：${approveRemark}`"
      />

      <div v-if="viewMeta && mode === 'view'" class="mb-3">
        <a-descriptions size="small" :column="2" bordered>
          <a-descriptions-item label="计划单号">{{ viewMeta.planNo }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ STATUS_LABEL[viewMeta.status] }}</a-descriptions-item>
          <a-descriptions-item label="总数量">{{ viewMeta.totalQty ?? 0 }}</a-descriptions-item>
          <a-descriptions-item label="总金额 (GHS)">{{ money(viewMeta.totalAmount) }}</a-descriptions-item>
        </a-descriptions>
      </div>

      <!-- 编辑态：联动筛选 + 产品选择器 -->
      <template v-if="mode !== 'view'">
        <a-card size="small" title="选择供应商产品" class="mb-3">
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
      <a-card size="small" :title="`已选明细（${selectedRows.length} 项）`">
        <a-table
          :columns="[
            { title: '名称', dataIndex: 'productName', key: 'productName' },
            { title: '编码', dataIndex: 'productCode', key: 'productCode', width: 120 },
            { title: 'MOQ', dataIndex: 'minPurchaseQty', key: 'minPurchaseQty', width: 70 },
            { title: '批发价', dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
            { title: '数量', dataIndex: 'purchaseQty', key: 'purchaseQty', width: 80 },
            { title: '小计', key: 'subtotal', width: 110 },
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
                <a-tooltip v-if="rowInvalid(record as DraftRow)" title="数量小于 MOQ">⚠</a-tooltip>
              </span>
            </template>
            <template v-else-if="column.key === 'subtotal'">
              {{ money(record.wholesalePrice * record.purchaseQty) }}
            </template>
          </template>
        </a-table>

        <div class="mt-3 flex justify-end gap-6">
          <span>总数量：<b>{{ totalQty }}</b></span>
          <span>总金额：<b>GHS {{ money(totalAmount) }}</b></span>
        </div>
      </a-card>

      <div v-if="mode !== 'view'" class="mt-3">
        <a-textarea v-model:value="remark" placeholder="备注（可选）" :rows="2" />
      </div>

      <template #footer>
        <a-space v-if="mode !== 'view'">
          <a-button @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="submitting" :disabled="!canSave" data-test="plan-save" @click="save">
            保存草稿
          </a-button>
        </a-space>
        <a-button v-else @click="drawerOpen = false">关闭</a-button>
      </template>
    </a-drawer>

    <!-- 退回原因 -->
    <a-modal v-model:open="rejectOpen" title="退回采购计划" @ok="doReject">
      <a-textarea v-model:value="rejectReason" placeholder="请填写退回原因" :rows="3" />
    </a-modal>
  </div>
</template>
