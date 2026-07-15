<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import CascadeFilter from '@/components/CascadeFilter.vue';
import { apiSalesOrderCreate, apiSalesOrderPage, apiSalesOrderGet, apiOrderableProductsPage } from '@/api/sales/order';
import type { SalesOrderVO, SalesOrderCreateDTO, SalesStatus, OrderableProductVO, OrderableProductQuery } from '@/types/sales';
import type { Id } from '@/types/api';
import LabelPrintDrawer from './LabelPrintDrawer.vue';

const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);
const { t } = useI18n();

const STATUS = computed<Record<SalesStatus, { label: string; color: string }>>(() => ({
  PENDING_DISPATCH: { label: t('sales.order.statusPendingDispatch'), color: 'default' },
  DISPATCHING: { label: t('sales.order.statusDispatching'), color: 'blue' },
  SIGNED: { label: t('sales.order.statusSigned'), color: 'cyan' },
  SIGNED_PAID: { label: t('sales.order.statusSignedPaid'), color: 'green' },
  UNREACHABLE: { label: t('sales.order.statusUnreachable'), color: 'orange' },
  REJECTED: { label: t('sales.order.statusRejected'), color: 'red' },
}));

// ---------------- 列表 ----------------
const tableRef = ref<InstanceType<typeof BasicTable>>();
const labelDrawerRef = ref<InstanceType<typeof LabelPrintDrawer>>();
// 'all' | 'pending' | 'completed' → completed 查询参数
const completedTab = ref<'all' | 'pending' | 'completed'>('all');
const query = ref<Record<string, any>>({});
function onTabChange() {
  query.value =
    completedTab.value === 'all'
      ? {}
      : { completed: completedTab.value === 'completed' };
}

const listColumns = computed<TableColumnsType>(() => [
  { title: t('sales.order.orderNo'), dataIndex: 'orderNo', key: 'orderNo' },
  { title: t('sales.order.customer'), dataIndex: 'customerName', key: 'customerName', width: 160 },
  { title: t('sales.order.amountGhs'), dataIndex: 'totalAmount', key: 'totalAmount', width: 120 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120 },
  { title: t('sales.order.completed'), dataIndex: 'completed', key: 'completed', width: 90 },
  { title: t('sales.order.orderTime'), dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: t('common.operation'), key: 'action', width: 80 },
]);

// ---------------- 下单抽屉 ----------------
interface CartRow {
  supplierProductId: Id;
  productName: string;
  productCode: string;
  stockQty: number;
  qty: number;
  unitPrice: number;
}
const cart = reactive<Record<string, CartRow>>({});
function clearCart() {
  Object.keys(cart).forEach((k) => delete cart[k]);
}

const drawerOpen = ref(false);
const submitting = ref(false);
const customer = reactive({ name: '', phone: '', address: '', remark: '' });

const stockFilter = ref<OrderableProductQuery>({});
const stockQuery = ref<Record<string, any>>({});
const onStockFilterChange = (v: OrderableProductQuery) => (stockQuery.value = { ...v });

const stockColumns = computed<TableColumnsType>(() => [
  { title: t('sales.order.product'), dataIndex: 'productName', key: 'productName' },
  { title: t('common.code'), dataIndex: 'productCode', key: 'productCode', width: 120 },
  { title: t('common.supplier'), dataIndex: 'supplierName', key: 'supplierName', width: 130 },
  { title: t('sales.order.currentStock'), dataIndex: 'quantity', key: 'quantity', width: 90 },
  { title: t('common.quantity'), key: 'qty', width: 130 },
]);

function getQty(productId: Id): number {
  return cart[String(productId)]?.qty ?? 0;
}
// 录入数量；新加入时按零售价带出默认单价（VO 已带 retailPrice，无需再请求供应商产品）
function setQty(row: OrderableProductVO, val: number | null) {
  const key = String(row.supplierProductId);
  const qty = val ?? 0;
  if (cart[key]) {
    cart[key].qty = qty;
    cart[key].stockQty = row.quantity;
    return;
  }
  if (qty <= 0) return;
  cart[key] = {
    supplierProductId: row.supplierProductId,
    productName: row.productName,
    productCode: row.productCode,
    stockQty: row.quantity,
    qty,
    unitPrice: row.retailPrice ?? 0,
  };
}
function setUnitPrice(r: CartRow, val: number | null) {
  r.unitPrice = val ?? 0;
}
function removeRow(r: CartRow) {
  delete cart[String(r.supplierProductId)];
}

const selectedRows = computed(() => Object.values(cart).filter((r) => r.qty > 0));
const totalAmount = computed(() =>
  selectedRows.value.reduce((s, r) => s + r.unitPrice * r.qty, 0),
);
// 允许缺货下单：仅校验数量为正整数
const rowInvalid = (r: CartRow) => r.qty < 1;
const hasInvalid = computed(() => selectedRows.value.some(rowInvalid));
const customerOk = computed(
  () => !!customer.name.trim() && !!customer.phone.trim() && !!customer.address.trim(),
);
const canSubmit = computed(
  () => selectedRows.value.length > 0 && !hasInvalid.value && customerOk.value,
);

function openCreate() {
  clearCart();
  customer.name = '';
  customer.phone = '';
  customer.address = '';
  customer.remark = '';
  stockFilter.value = {};
  stockQuery.value = {};
  drawerOpen.value = true;
}

async function submit() {
  if (selectedRows.value.length === 0) {
    message.warning(t('sales.order.atLeastOneProduct'));
    return;
  }
  if (hasInvalid.value) {
    message.warning(t('sales.order.invalidQtyExists'));
    return;
  }
  if (!customerOk.value) {
    message.warning(t('sales.order.fillCustomerInfo'));
    return;
  }
  const payload: SalesOrderCreateDTO = {
    customerName: customer.name.trim(),
    customerPhone: customer.phone.trim(),
    customerAddress: customer.address.trim(),
    remark: customer.remark || null,
    items: selectedRows.value.map((r) => ({
      supplierProductId: r.supplierProductId,
      qty: r.qty,
      unitPrice: r.unitPrice,
    })),
  };
  submitting.value = true;
  try {
    // 库存不足等由后端返回业务码，request 拦截器按 msg 提示
    await apiSalesOrderCreate(payload);
    message.success(t('sales.order.orderSuccess'));
    drawerOpen.value = false;
    tableRef.value?.reload();
  } finally {
    submitting.value = false;
  }
}

// ---------------- 详情 ----------------
const viewOpen = ref(false);
const detail = ref<SalesOrderVO | null>(null);
async function openView(row: SalesOrderVO) {
  detail.value = await apiSalesOrderGet(row.id);
  viewOpen.value = true;
}

defineExpose({ openCreate, setQty, setUnitPrice, removeRow, submit, openView });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <div class="flex items-center justify-between">
        <a-radio-group v-model:value="completedTab" button-style="solid" @change="onTabChange">
          <a-radio-button value="all">{{ t('common.all') }}</a-radio-button>
          <a-radio-button value="pending">{{ t('sales.order.tabPending') }}</a-radio-button>
          <a-radio-button value="completed">{{ t('sales.order.tabCompleted') }}</a-radio-button>
        </a-radio-group>
        <a-space>
          <a-button
            v-perm="'sales:order:list'"
            data-test="sales-print-labels"
            @click="labelDrawerRef?.openDrawer()"
          >
            {{ t('sales.order.printLabels') }}
          </a-button>
          <a-button v-perm="'sales:order:create'" type="primary" data-test="sales-create" @click="openCreate">
            {{ t('sales.order.createOrder') }}
          </a-button>
        </a-space>
      </div>
    </a-card>

    <a-card :bordered="false">
      <BasicTable ref="tableRef" :columns="listColumns" :fetcher="apiSalesOrderPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'customerName'">
            {{ record.customerName }}
            <div class="text-xs text-gray-400">{{ record.customerPhone }}</div>
          </template>
          <template v-else-if="column.key === 'totalAmount'">{{ money(record.totalAmount) }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="STATUS[(record as SalesOrderVO).status].color">
              {{ STATUS[(record as SalesOrderVO).status].label }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'completed'">
            <a-tag :color="record.completed === 1 ? 'green' : 'default'">
              {{ record.completed === 1 ? t('sales.order.completedYes') : t('sales.order.inProgress') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a data-test="sales-detail" @click="openView(record as SalesOrderVO)">{{ t('common.view') }}</a>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <!-- 下单抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('sales.order.createTitle')" width="960" destroy-on-close>
      <a-card size="small" :title="t('sales.order.selectProducts')" class="mb-3">
        <CascadeFilter v-model="stockFilter" @change="onStockFilterChange" />
        <BasicTable :columns="stockColumns" :fetcher="apiOrderableProductsPage" :params="stockQuery" class="mt-2">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'quantity'">
              <span :class="{ 'text-red-500': record.quantity <= 0 }">{{ record.quantity }}</span>
              <a-tag v-if="record.quantity <= 0" color="orange" class="ml-1">{{ t('sales.order.backorder') }}</a-tag>
            </template>
            <template v-else-if="column.key === 'qty'">
              <a-input-number
                :value="getQty(record.supplierProductId)"
                :min="0"
                :precision="0"
                style="width: 110px"
                @change="(v: any) => setQty(record as OrderableProductVO, v)"
              />
            </template>
          </template>
        </BasicTable>
      </a-card>

      <a-card size="small" :title="t('sales.order.cart', { n: selectedRows.length })" class="mb-3">
        <a-table
          :columns="[
            { title: t('sales.order.product'), dataIndex: 'productName', key: 'productName' },
            { title: t('sales.order.stock'), dataIndex: 'stockQty', key: 'stockQty', width: 80 },
            { title: t('common.quantity'), dataIndex: 'qty', key: 'qty', width: 80 },
            { title: t('sales.order.unitPriceGhs'), key: 'unitPrice', width: 140 },
            { title: t('common.subtotal'), key: 'subtotal', width: 110 },
            { title: t('common.operation'), key: 'op', width: 70 },
          ]"
          :data-source="selectedRows"
          :pagination="false"
          row-key="supplierProductId"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'qty'">
              <span :class="{ 'text-red-500': rowInvalid(record as CartRow) }">
                {{ record.qty }}
                <a-tooltip v-if="rowInvalid(record as CartRow)" :title="t('sales.order.qtyExceedsStock')">⚠</a-tooltip>
              </span>
              <a-tag v-if="record.stockQty <= 0" color="orange" class="ml-1">{{ t('sales.order.backorder') }}</a-tag>
            </template>
            <template v-else-if="column.key === 'unitPrice'">
              <a-input-number
                :value="record.unitPrice"
                :min="0"
                :precision="2"
                style="width: 120px"
                @change="(v: any) => setUnitPrice(record as CartRow, v)"
              />
            </template>
            <template v-else-if="column.key === 'subtotal'">
              {{ money(record.unitPrice * record.qty) }}
            </template>
            <template v-else-if="column.key === 'op'">
              <a class="text-red-500" @click="removeRow(record as CartRow)">{{ t('common.remove') }}</a>
            </template>
          </template>
        </a-table>
        <div class="mt-3 text-right">{{ t('sales.order.receivableTotal') }}<b>GHS {{ money(totalAmount) }}</b></div>
      </a-card>

      <a-card size="small" :title="t('sales.order.customerInfo')">
        <a-form layout="vertical">
          <a-form-item :label="t('sales.order.customerName')" required>
            <a-input v-model:value="customer.name" :placeholder="t('sales.order.required')" allow-clear />
          </a-form-item>
          <a-form-item :label="t('sales.order.customerPhone')" required>
            <a-input v-model:value="customer.phone" :placeholder="t('sales.order.required')" allow-clear />
          </a-form-item>
          <a-form-item :label="t('sales.order.customerAddress')" required>
            <a-input v-model:value="customer.address" :placeholder="t('sales.order.required')" allow-clear />
          </a-form-item>
          <a-form-item :label="t('common.remark')">
            <a-textarea v-model:value="customer.remark" :rows="2" />
          </a-form-item>
        </a-form>
      </a-card>

      <template #footer>
        <a-space>
          <a-button @click="drawerOpen = false">{{ t('common.cancel') }}</a-button>
          <a-button type="primary" :loading="submitting" :disabled="!canSubmit" data-test="sales-submit" @click="submit">
            {{ t('sales.order.submitOrder') }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>

    <LabelPrintDrawer ref="labelDrawerRef" />

    <!-- 详情 -->
    <a-drawer v-model:open="viewOpen" :title="t('sales.order.detailTitle')" width="800" destroy-on-close>
      <template v-if="detail">
        <a-descriptions size="small" :column="2" bordered class="mb-3">
          <a-descriptions-item :label="t('sales.order.orderNo')">{{ detail.orderNo }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">{{ STATUS[detail.status].label }}</a-descriptions-item>
          <a-descriptions-item :label="t('sales.order.customer')">{{ detail.customerName }}</a-descriptions-item>
          <a-descriptions-item :label="t('sales.order.phone')">{{ detail.customerPhone }}</a-descriptions-item>
          <a-descriptions-item :label="t('sales.order.address')" :span="2">{{ detail.customerAddress }}</a-descriptions-item>
          <a-descriptions-item :label="t('sales.order.receivableAmountGhs')">{{ money(detail.totalAmount) }}</a-descriptions-item>
          <a-descriptions-item :label="t('sales.order.actualAmountGhs')">{{ money(detail.actualAmount) }}</a-descriptions-item>
        </a-descriptions>
        <a-table
          :columns="[
            { title: t('sales.order.product'), dataIndex: 'productName', key: 'productName' },
            { title: t('common.code'), dataIndex: 'productCode', key: 'productCode', width: 120 },
            { title: t('sales.order.unitPrice'), dataIndex: 'unitPrice', key: 'unitPrice', width: 90 },
            { title: t('common.quantity'), dataIndex: 'qty', key: 'qty', width: 70 },
            { title: t('sales.order.rejectQty'), dataIndex: 'rejectQty', key: 'rejectQty', width: 70 },
            { title: t('common.subtotal'), dataIndex: 'amount', key: 'amount', width: 100 },
          ]"
          :data-source="detail.items"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'unitPrice'">{{ money(record.unitPrice) }}</template>
            <template v-else-if="column.key === 'amount'">{{ money(record.amount) }}</template>
          </template>
        </a-table>
      </template>
    </a-drawer>
  </div>
</template>
