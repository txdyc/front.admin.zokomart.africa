<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();

const ORDER_STATUS = computed<Record<OrderStatus, { label: string; color: string }>>(() => ({
  PENDING_PAYMENT: { label: t('purchase.order.statusPendingPayment'), color: 'orange' },
  CONFIRMED: { label: t('purchase.order.statusConfirmed'), color: 'green' },
}));
const PAY_STATUS = computed<Record<PaymentStatus, { label: string; color: string }>>(() => ({
  UNSET: { label: t('purchase.order.payUnset'), color: 'default' },
  PAID: { label: t('purchase.order.payPaid'), color: 'green' },
  UNPAID: { label: t('purchase.order.payUnpaid'), color: 'red' },
}));
const ACTUAL_STATUS = computed<Record<ActualStatus, { label: string; color: string }>>(() => ({
  PENDING_INBOUND: { label: t('purchase.order.actualPendingInbound'), color: 'orange' },
  INBOUND_DONE: { label: t('purchase.order.actualInboundDone'), color: 'green' },
}));

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

const orderColumns = computed<TableColumnsType>(() => [
  { title: t('purchase.order.orderNo'), dataIndex: 'orderNo', key: 'orderNo' },
  { title: t('purchase.order.plan'), dataIndex: 'planId', key: 'planId', width: 90 },
  { title: t('common.supplier'), dataIndex: 'supplierId', key: 'supplierId', width: 150 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 100 },
  { title: t('common.totalQty'), dataIndex: 'totalQty', key: 'totalQty', width: 80 },
  { title: t('common.totalAmount'), dataIndex: 'totalAmount', key: 'totalAmount', width: 110 },
  { title: t('purchase.order.paidAmount'), dataIndex: 'paidAmount', key: 'paidAmount', width: 110 },
  { title: t('common.operation'), key: 'action', width: 90 },
]);

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
    message.warning(t('purchase.order.selectItemsFirst'));
    return;
  }
  payLoading.value = true;
  try {
    await apiOrderMarkPayment(orderDetail.value!.id, {
      itemIds: selectedItemIds.value,
      paymentStatus: status,
    });
    message.success(t('purchase.order.payStatusUpdated'));
    orderDetail.value = await apiOrderGet(orderDetail.value!.id);
    selectedItemIds.value = [];
    orderTableRef.value?.reload();
  } finally {
    payLoading.value = false;
  }
}

async function confirmOrder() {
  await apiOrderConfirm(orderDetail.value!.id);
  message.success(t('purchase.order.confirmedGenerated'));
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

const actualColumns = computed<TableColumnsType>(() => [
  { title: t('purchase.order.actualNo'), dataIndex: 'actualNo', key: 'actualNo' },
  { title: t('purchase.order.tabOrder'), dataIndex: 'purchaseOrderId', key: 'purchaseOrderId', width: 110 },
  { title: t('common.supplier'), dataIndex: 'supplierId', key: 'supplierId', width: 150 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 100 },
  { title: t('common.totalQty'), dataIndex: 'totalQty', key: 'totalQty', width: 80 },
  { title: t('common.totalAmount'), dataIndex: 'totalAmount', key: 'totalAmount', width: 110 },
  { title: t('common.operation'), key: 'action', width: 90 },
]);

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
    message.success(t('purchase.order.inboundDone'));
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
      <a-tab-pane key="order" :tab="t('purchase.order.tabOrder')">
        <a-form layout="inline" class="mb-3">
          <a-form-item :label="t('purchase.order.planId')">
            <a-input-number v-model:value="orderSearch.planId" :placeholder="t('common.all')" :controls="false" style="width: 140px" />
          </a-form-item>
          <a-form-item :label="t('common.supplier')">
            <a-select
              v-model:value="orderSearch.supplierId"
              :placeholder="t('common.all')"
              show-search
              option-filter-prop="label"
              allow-clear
              style="width: 180px"
              :options="supplierOptions"
              data-test="order-filter-supplier"
            />
          </a-form-item>
          <a-form-item :label="t('common.status')">
            <a-select
              v-model:value="orderSearch.status"
              :placeholder="t('common.all')"
              allow-clear
              style="width: 130px"
              :options="[
                { label: t('purchase.order.statusPendingPayment'), value: 'PENDING_PAYMENT' },
                { label: t('purchase.order.statusConfirmed'), value: 'CONFIRMED' },
              ]"
            />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" data-test="order-search" @click="onOrderSearch">{{ t('common.search') }}</a-button>
              <a-button @click="onOrderReset">{{ t('common.reset') }}</a-button>
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
              <a data-test="order-detail" @click="openOrderDetail(record as PurchaseOrderVO)">{{ t('common.detail') }}</a>
            </template>
          </template>
        </BasicTable>
      </a-tab-pane>

      <!-- ============ 实际采购单 ============ -->
      <a-tab-pane key="actual" :tab="t('purchase.order.tabActual')">
        <a-form layout="inline" class="mb-3">
          <a-form-item :label="t('purchase.order.purchaseOrderId')">
            <a-input-number v-model:value="actualSearch.purchaseOrderId" :placeholder="t('common.all')" :controls="false" style="width: 160px" />
          </a-form-item>
          <a-form-item :label="t('common.status')">
            <a-select
              v-model:value="actualSearch.status"
              :placeholder="t('common.all')"
              allow-clear
              style="width: 130px"
              :options="[
                { label: t('purchase.order.actualPendingInbound'), value: 'PENDING_INBOUND' },
                { label: t('purchase.order.actualInboundDone'), value: 'INBOUND_DONE' },
              ]"
            />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" data-test="actual-search" @click="onActualSearch">{{ t('common.search') }}</a-button>
              <a-button @click="onActualReset">{{ t('common.reset') }}</a-button>
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
              <a data-test="actual-detail" @click="openActualDetail(record as ActualPurchaseOrderVO)">{{ t('common.detail') }}</a>
            </template>
          </template>
        </BasicTable>
      </a-tab-pane>
    </a-tabs>

    <!-- 采购订单详情：付款 + 确认 -->
    <a-drawer v-model:open="orderDrawerOpen" :title="t('purchase.order.orderDetailTitle')" width="860" destroy-on-close>
      <template v-if="orderDetail">
        <a-descriptions size="small" :column="2" bordered class="mb-3">
          <a-descriptions-item :label="t('purchase.order.orderNo')">{{ orderDetail.orderNo }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">{{ ORDER_STATUS[orderDetail.status].label }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.supplier')">{{ supplierName(orderDetail.supplierId) }}</a-descriptions-item>
          <a-descriptions-item :label="t('purchase.order.totalAmountGhs')">{{ money(orderDetail.totalAmount) }}</a-descriptions-item>
          <a-descriptions-item :label="t('purchase.order.paidAmountGhs')">{{ money(orderDetail.paidAmount) }}</a-descriptions-item>
        </a-descriptions>

        <div v-if="orderDetail.status === 'PENDING_PAYMENT'" class="mb-2">
          <a-space>
            <span class="text-gray-500">{{ t('purchase.order.batchMark') }}</span>
            <a-button v-perm="'purchase:order:pay'" size="small" :loading="payLoading" data-test="mark-paid" @click="markPay('PAID')">{{ t('purchase.order.markPaid') }}</a-button>
            <a-button v-perm="'purchase:order:pay'" size="small" :loading="payLoading" @click="markPay('UNPAID')">{{ t('purchase.order.markUnpaid') }}</a-button>
            <a-button v-perm="'purchase:order:pay'" size="small" :loading="payLoading" @click="markPay('UNSET')">{{ t('common.reset') }}</a-button>
          </a-space>
        </div>

        <a-table
          :columns="[
            { title: t('common.name'), dataIndex: 'productName', key: 'productName' },
            { title: t('common.code'), dataIndex: 'productCode', key: 'productCode', width: 120 },
            { title: t('common.wholesalePrice'), dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
            { title: t('common.quantity'), dataIndex: 'qty', key: 'qty', width: 70 },
            { title: t('common.subtotal'), dataIndex: 'amount', key: 'amount', width: 100 },
            { title: t('purchase.order.payment'), dataIndex: 'paymentStatus', key: 'paymentStatus', width: 90 },
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
          <a-button @click="orderDrawerOpen = false">{{ t('common.close') }}</a-button>
          <a-popconfirm :title="t('purchase.order.confirmGenerateActual')" @confirm="confirmOrder">
            <a-button
              v-perm="'purchase:order:confirm'"
              type="primary"
              :disabled="!canConfirm"
              data-test="order-confirm"
            >
              {{ t('purchase.order.confirmGenerateActualBtn') }}
            </a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-drawer>

    <!-- 实际采购单详情：入库 -->
    <a-drawer v-model:open="actualDrawerOpen" :title="t('purchase.order.actualDetailTitle')" width="820" destroy-on-close>
      <template v-if="actualDetail">
        <a-descriptions size="small" :column="2" bordered class="mb-3">
          <a-descriptions-item :label="t('purchase.order.actualNo')">{{ actualDetail.actualNo }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">{{ ACTUAL_STATUS[actualDetail.status].label }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.supplier')">{{ supplierName(actualDetail.supplierId) }}</a-descriptions-item>
          <a-descriptions-item :label="t('purchase.order.totalAmountGhs')">{{ money(actualDetail.totalAmount) }}</a-descriptions-item>
        </a-descriptions>

        <a-table
          :columns="[
            { title: t('common.name'), dataIndex: 'productName', key: 'productName' },
            { title: t('common.quantity'), dataIndex: 'qty', key: 'qty', width: 80 },
            { title: t('common.wholesalePrice'), dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 90 },
            { title: t('common.subtotal'), dataIndex: 'amount', key: 'amount', width: 100 },
            { title: t('purchase.order.inboundStatus'), dataIndex: 'inboundStatus', key: 'inboundStatus', width: 100 },
            { title: t('purchase.order.inboundQty'), dataIndex: 'inboundQty', key: 'inboundQty', width: 80 },
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
                {{ record.inboundStatus === 'DONE' ? t('purchase.order.actualInboundDone') : t('purchase.order.actualPendingInbound') }}
              </a-tag>
            </template>
          </template>
        </a-table>
      </template>

      <template #footer>
        <a-space>
          <a-button @click="actualDrawerOpen = false">{{ t('common.close') }}</a-button>
          <a-popconfirm :title="t('purchase.order.confirmInboundAll')" @confirm="inbound">
            <a-button
              v-perm="'inventory:inbound'"
              type="primary"
              :loading="inboundLoading"
              :disabled="!canInbound"
              data-test="actual-inbound"
            >
              {{ t('purchase.order.inboundAll') }}
            </a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-drawer>
  </a-card>
</template>
