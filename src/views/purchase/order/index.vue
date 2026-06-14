<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import { apiOrderPage, apiOrderGet, apiOrderMarkPayment, apiOrderConfirm } from '@/api/purchase/order';
import { apiActualOrderPage, apiActualOrderGet, apiActualOrderInbound } from '@/api/purchase/actualOrder';
import { apiSupplierPage } from '@/api/basedata/supplier';
import type {
  PurchaseOrderVO,
  ActualPurchaseOrderVO,
  OrderStatus,
  ActualStatus,
  PaymentStatus,
} from '@/types/purchase';
import type { SelectOption } from '@/components/SchemaForm.vue';
import type { Id } from '@/types/api';

const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);

const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: '待付款', color: 'orange' },
  CONFIRMED: { label: '已确认', color: 'green' },
};
const PAY_STATUS: Record<PaymentStatus, { label: string; color: string }> = {
  UNSET: { label: '未设置', color: 'default' },
  PAID: { label: '已付', color: 'green' },
  UNPAID: { label: '未付', color: 'red' },
};
const ACTUAL_STATUS: Record<ActualStatus, { label: string; color: string }> = {
  PENDING_INBOUND: { label: '待入库', color: 'orange' },
  INBOUND_DONE: { label: '已入库', color: 'green' },
};

const activeTab = ref<'order' | 'actual'>('order');
const supplierOptions = ref<SelectOption[]>([]);
const supplierMap = computed(() => new Map(supplierOptions.value.map((o) => [String(o.value), o.label])));
const supplierName = (id: Id) => supplierMap.value.get(String(id)) ?? id;

async function loadSuppliers() {
  const page = await apiSupplierPage({ status: 1, current: 1, size: 1000 });
  supplierOptions.value = page.records.map((s) => ({ label: s.name, value: s.id }));
}
onMounted(loadSuppliers);

function onTabChange() {
  if (activeTab.value === 'order') orderTableRef.value?.reload();
  else actualTableRef.value?.reload();
}

// ================= 采购订单 =================
const orderTableRef = ref<InstanceType<typeof BasicTable>>();
const orderSearch = reactive<{ planId?: Id; supplierId?: Id; status?: OrderStatus }>({});
const orderQuery = ref<Record<string, any>>({});
const onOrderSearch = () => (orderQuery.value = { ...orderSearch });
const onOrderReset = () => {
  orderSearch.planId = undefined;
  orderSearch.supplierId = undefined;
  orderSearch.status = undefined;
  orderQuery.value = {};
};

const orderColumns: TableColumnsType = [
  { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '计划', dataIndex: 'planId', key: 'planId', width: 90 },
  { title: '供应商', dataIndex: 'supplierId', key: 'supplierId', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '总数量', dataIndex: 'totalQty', key: 'totalQty', width: 80 },
  { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 110 },
  { title: '已付金额', dataIndex: 'paidAmount', key: 'paidAmount', width: 110 },
  { title: '操作', key: 'action', width: 90 },
];

const orderDrawerOpen = ref(false);
const orderDetail = ref<PurchaseOrderVO | null>(null);
const selectedItemIds = ref<Id[]>([]);
const payLoading = ref(false);

async function openOrderDetail(row: PurchaseOrderVO) {
  orderDetail.value = await apiOrderGet(row.id);
  selectedItemIds.value = [];
  orderDrawerOpen.value = true;
}

const canConfirm = computed(
  () =>
    !!orderDetail.value &&
    orderDetail.value.status === 'PENDING_PAYMENT' &&
    orderDetail.value.items.some((i) => i.paymentStatus === 'PAID'),
);

async function markPay(status: PaymentStatus) {
  if (selectedItemIds.value.length === 0) {
    message.warning('请先选择明细');
    return;
  }
  payLoading.value = true;
  try {
    await apiOrderMarkPayment(orderDetail.value!.id, {
      itemIds: selectedItemIds.value,
      paymentStatus: status,
    });
    message.success('付款状态已更新');
    orderDetail.value = await apiOrderGet(orderDetail.value!.id);
    selectedItemIds.value = [];
    orderTableRef.value?.reload();
  } finally {
    payLoading.value = false;
  }
}

async function confirmOrder() {
  await apiOrderConfirm(orderDetail.value!.id);
  message.success('已确认，生成实际采购单');
  orderDrawerOpen.value = false;
  orderTableRef.value?.reload();
  actualTableRef.value?.reload();
  activeTab.value = 'actual';
}

// ================= 实际采购单 =================
const actualTableRef = ref<InstanceType<typeof BasicTable>>();
const actualSearch = reactive<{ purchaseOrderId?: Id; status?: ActualStatus }>({});
const actualQuery = ref<Record<string, any>>({});
const onActualSearch = () => (actualQuery.value = { ...actualSearch });
const onActualReset = () => {
  actualSearch.purchaseOrderId = undefined;
  actualSearch.status = undefined;
  actualQuery.value = {};
};

const actualColumns: TableColumnsType = [
  { title: '实际单号', dataIndex: 'actualNo', key: 'actualNo' },
  { title: '采购订单', dataIndex: 'purchaseOrderId', key: 'purchaseOrderId', width: 110 },
  { title: '供应商', dataIndex: 'supplierId', key: 'supplierId', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '总数量', dataIndex: 'totalQty', key: 'totalQty', width: 80 },
  { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 110 },
  { title: '操作', key: 'action', width: 90 },
];

const actualDrawerOpen = ref(false);
const actualDetail = ref<ActualPurchaseOrderVO | null>(null);
const inboundLoading = ref(false);

async function openActualDetail(row: ActualPurchaseOrderVO) {
  actualDetail.value = await apiActualOrderGet(row.id);
  actualDrawerOpen.value = true;
}

const canInbound = computed(
  () => !!actualDetail.value && actualDetail.value.status === 'PENDING_INBOUND',
);

async function inbound() {
  inboundLoading.value = true;
  try {
    // 整单入库（不传 itemIds）
    await apiActualOrderInbound(actualDetail.value!.id);
    message.success('已入库，库存已更新');
    actualDetail.value = await apiActualOrderGet(actualDetail.value!.id);
    actualTableRef.value?.reload();
  } finally {
    inboundLoading.value = false;
  }
}

defineExpose({
  openOrderDetail, markPay, confirmOrder, openActualDetail, inbound,
});
</script>

<template>
  <a-card :bordered="false">
    <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
      <!-- ============ 采购订单 ============ -->
      <a-tab-pane key="order" tab="采购订单">
        <a-form layout="inline" class="mb-3">
          <a-form-item label="计划ID">
            <a-input-number v-model:value="orderSearch.planId" placeholder="全部" :controls="false" style="width: 140px" />
          </a-form-item>
          <a-form-item label="供应商">
            <a-select
              v-model:value="orderSearch.supplierId"
              placeholder="全部"
              show-search
              option-filter-prop="label"
              allow-clear
              style="width: 180px"
              :options="supplierOptions"
              data-test="order-filter-supplier"
            />
          </a-form-item>
          <a-form-item label="状态">
            <a-select
              v-model:value="orderSearch.status"
              placeholder="全部"
              allow-clear
              style="width: 130px"
              :options="[
                { label: '待付款', value: 'PENDING_PAYMENT' },
                { label: '已确认', value: 'CONFIRMED' },
              ]"
            />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" data-test="order-search" @click="onOrderSearch">查询</a-button>
              <a-button @click="onOrderReset">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>

        <BasicTable ref="orderTableRef" :columns="orderColumns" :fetcher="apiOrderPage" :params="orderQuery">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'supplierId'">{{ supplierName(record.supplierId) }}</template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="ORDER_STATUS[(record as PurchaseOrderVO).status].color">
                {{ ORDER_STATUS[(record as PurchaseOrderVO).status].label }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'totalAmount'">{{ money(record.totalAmount) }}</template>
            <template v-else-if="column.key === 'paidAmount'">{{ money(record.paidAmount) }}</template>
            <template v-else-if="column.key === 'action'">
              <a data-test="order-detail" @click="openOrderDetail(record as PurchaseOrderVO)">详情</a>
            </template>
          </template>
        </BasicTable>
      </a-tab-pane>

      <!-- ============ 实际采购单 ============ -->
      <a-tab-pane key="actual" tab="实际采购单">
        <a-form layout="inline" class="mb-3">
          <a-form-item label="采购订单ID">
            <a-input-number v-model:value="actualSearch.purchaseOrderId" placeholder="全部" :controls="false" style="width: 160px" />
          </a-form-item>
          <a-form-item label="状态">
            <a-select
              v-model:value="actualSearch.status"
              placeholder="全部"
              allow-clear
              style="width: 130px"
              :options="[
                { label: '待入库', value: 'PENDING_INBOUND' },
                { label: '已入库', value: 'INBOUND_DONE' },
              ]"
            />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" data-test="actual-search" @click="onActualSearch">查询</a-button>
              <a-button @click="onActualReset">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>

        <BasicTable ref="actualTableRef" :columns="actualColumns" :fetcher="apiActualOrderPage" :params="actualQuery">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'supplierId'">{{ supplierName(record.supplierId) }}</template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="ACTUAL_STATUS[(record as ActualPurchaseOrderVO).status].color">
                {{ ACTUAL_STATUS[(record as ActualPurchaseOrderVO).status].label }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'totalAmount'">{{ money(record.totalAmount) }}</template>
            <template v-else-if="column.key === 'action'">
              <a data-test="actual-detail" @click="openActualDetail(record as ActualPurchaseOrderVO)">详情</a>
            </template>
          </template>
        </BasicTable>
      </a-tab-pane>
    </a-tabs>

    <!-- 采购订单详情：付款 + 确认 -->
    <a-drawer v-model:open="orderDrawerOpen" title="采购订单详情" width="860" destroy-on-close>
      <template v-if="orderDetail">
        <a-descriptions size="small" :column="2" bordered class="mb-3">
          <a-descriptions-item label="订单号">{{ orderDetail.orderNo }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ ORDER_STATUS[orderDetail.status].label }}</a-descriptions-item>
          <a-descriptions-item label="供应商">{{ supplierName(orderDetail.supplierId) }}</a-descriptions-item>
          <a-descriptions-item label="总金额 (GHS)">{{ money(orderDetail.totalAmount) }}</a-descriptions-item>
          <a-descriptions-item label="已付金额 (GHS)">{{ money(orderDetail.paidAmount) }}</a-descriptions-item>
        </a-descriptions>

        <div v-if="orderDetail.status === 'PENDING_PAYMENT'" class="mb-2">
          <a-space>
            <span class="text-gray-500">批量标记：</span>
            <a-button v-perm="'purchase:order:pay'" size="small" :loading="payLoading" data-test="mark-paid" @click="markPay('PAID')">标记已付</a-button>
            <a-button v-perm="'purchase:order:pay'" size="small" :loading="payLoading" @click="markPay('UNPAID')">标记未付</a-button>
            <a-button v-perm="'purchase:order:pay'" size="small" :loading="payLoading" @click="markPay('UNSET')">重置</a-button>
          </a-space>
        </div>

        <a-table
          :columns="[
            { title: '名称', dataIndex: 'productName', key: 'productName' },
            { title: '编码', dataIndex: 'productCode', key: 'productCode', width: 120 },
            { title: '批发价', dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
            { title: '数量', dataIndex: 'qty', key: 'qty', width: 70 },
            { title: '小计', dataIndex: 'amount', key: 'amount', width: 100 },
            { title: '付款', dataIndex: 'paymentStatus', key: 'paymentStatus', width: 90 },
          ]"
          :data-source="orderDetail.items"
          :pagination="false"
          row-key="id"
          size="small"
          :row-selection="orderDetail.status === 'PENDING_PAYMENT'
            ? { selectedRowKeys: selectedItemIds, onChange: (keys: Id[]) => (selectedItemIds = keys) }
            : undefined"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'wholesalePrice'">{{ money(record.wholesalePrice) }}</template>
            <template v-else-if="column.key === 'amount'">{{ money(record.amount) }}</template>
            <template v-else-if="column.key === 'paymentStatus'">
              <a-tag :color="PAY_STATUS[(record as any).paymentStatus as PaymentStatus].color">
                {{ PAY_STATUS[(record as any).paymentStatus as PaymentStatus].label }}
              </a-tag>
            </template>
          </template>
        </a-table>
      </template>

      <template #footer>
        <a-space>
          <a-button @click="orderDrawerOpen = false">关闭</a-button>
          <a-popconfirm title="确认生成实际采购单？" @confirm="confirmOrder">
            <a-button
              v-perm="'purchase:order:confirm'"
              type="primary"
              :disabled="!canConfirm"
              data-test="order-confirm"
            >
              确认生成实际采购单
            </a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-drawer>

    <!-- 实际采购单详情：入库 -->
    <a-drawer v-model:open="actualDrawerOpen" title="实际采购单详情" width="820" destroy-on-close>
      <template v-if="actualDetail">
        <a-descriptions size="small" :column="2" bordered class="mb-3">
          <a-descriptions-item label="实际单号">{{ actualDetail.actualNo }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ ACTUAL_STATUS[actualDetail.status].label }}</a-descriptions-item>
          <a-descriptions-item label="供应商">{{ supplierName(actualDetail.supplierId) }}</a-descriptions-item>
          <a-descriptions-item label="总金额 (GHS)">{{ money(actualDetail.totalAmount) }}</a-descriptions-item>
        </a-descriptions>

        <a-table
          :columns="[
            { title: '名称', dataIndex: 'productName', key: 'productName' },
            { title: '数量', dataIndex: 'qty', key: 'qty', width: 80 },
            { title: '批发价', dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
            { title: '小计', dataIndex: 'amount', key: 'amount', width: 100 },
            { title: '入库状态', dataIndex: 'inboundStatus', key: 'inboundStatus', width: 100 },
            { title: '入库量', dataIndex: 'inboundQty', key: 'inboundQty', width: 80 },
          ]"
          :data-source="actualDetail.items"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'wholesalePrice'">{{ money(record.wholesalePrice) }}</template>
            <template v-else-if="column.key === 'amount'">{{ money(record.amount) }}</template>
            <template v-else-if="column.key === 'inboundStatus'">
              <a-tag :color="record.inboundStatus === 'DONE' ? 'green' : 'orange'">
                {{ record.inboundStatus === 'DONE' ? '已入库' : '待入库' }}
              </a-tag>
            </template>
          </template>
        </a-table>
      </template>

      <template #footer>
        <a-space>
          <a-button @click="actualDrawerOpen = false">关闭</a-button>
          <a-popconfirm title="确认整单入库？" @confirm="inbound">
            <a-button
              v-perm="'inventory:inbound'"
              type="primary"
              :loading="inboundLoading"
              :disabled="!canInbound"
              data-test="actual-inbound"
            >
              整单入库
            </a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-drawer>
  </a-card>
</template>
