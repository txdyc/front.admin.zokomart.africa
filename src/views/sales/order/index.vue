<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import CascadeFilter from '@/components/CascadeFilter.vue';
import { apiSalesOrderCreate, apiSalesOrderPage, apiSalesOrderGet } from '@/api/sales/order';
import { apiStockPage } from '@/api/inventory/stock';
import { apiSupplierProductGet } from '@/api/product/supplierProduct';
import type { SalesOrderVO, SalesOrderCreateDTO, SalesStatus } from '@/types/sales';
import type { InventoryStockVO, InventoryStockQuery } from '@/types/inventory';
import type { Id } from '@/types/api';

const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);

const STATUS: Record<SalesStatus, { label: string; color: string }> = {
  PENDING_DISPATCH: { label: '待派送', color: 'default' },
  DISPATCHING: { label: '派送中', color: 'blue' },
  SIGNED: { label: '已签收', color: 'cyan' },
  SIGNED_PAID: { label: '已签收已付', color: 'green' },
  UNREACHABLE: { label: '无法送达', color: 'orange' },
  REJECTED: { label: '已拒收', color: 'red' },
};

// ---------------- 列表 ----------------
const tableRef = ref<InstanceType<typeof BasicTable>>();
// 'all' | 'pending' | 'completed' → completed 查询参数
const completedTab = ref<'all' | 'pending' | 'completed'>('all');
const query = ref<Record<string, any>>({});
function onTabChange() {
  query.value =
    completedTab.value === 'all'
      ? {}
      : { completed: completedTab.value === 'completed' };
}

const listColumns: TableColumnsType = [
  { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 160 },
  { title: '金额 (GHS)', dataIndex: 'totalAmount', key: 'totalAmount', width: 120 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '完成', dataIndex: 'completed', key: 'completed', width: 90 },
  { title: '下单时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '操作', key: 'action', width: 80 },
];

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

const stockFilter = ref<InventoryStockQuery>({});
const stockQuery = ref<Record<string, any>>({});
const onStockFilterChange = (v: InventoryStockQuery) => (stockQuery.value = { ...v });

const stockColumns: TableColumnsType = [
  { title: '产品', dataIndex: 'productName', key: 'productName' },
  { title: '编码', dataIndex: 'productCode', key: 'productCode', width: 120 },
  { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 130 },
  { title: '当前库存', dataIndex: 'quantity', key: 'quantity', width: 90 },
  { title: '数量', key: 'qty', width: 130 },
];

function getQty(productId: Id): number {
  return cart[String(productId)]?.qty ?? 0;
}
// 录入数量；新加入时按零售价带出默认单价（库存 VO 无价，故取供应商产品）
async function setQty(row: InventoryStockVO, val: number | null) {
  const key = String(row.supplierProductId);
  const qty = val ?? 0;
  if (cart[key]) {
    cart[key].qty = qty;
    cart[key].stockQty = row.quantity;
    return;
  }
  if (qty <= 0) return;
  const sp = await apiSupplierProductGet(row.supplierProductId);
  cart[key] = {
    supplierProductId: row.supplierProductId,
    productName: row.productName,
    productCode: row.productCode,
    stockQty: row.quantity,
    qty,
    unitPrice: sp.retailPrice ?? 0,
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
// 数量须 1..库存（下单时后端再校验防超卖）
const rowInvalid = (r: CartRow) => r.qty > 0 && (r.qty > r.stockQty || r.qty < 1);
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
    message.warning('请至少选择一件商品');
    return;
  }
  if (hasInvalid.value) {
    message.warning('存在数量超过库存或非法的明细，请修正');
    return;
  }
  if (!customerOk.value) {
    message.warning('请填写完整客户信息（姓名/手机号/地址）');
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
    message.success('下单成功');
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
          <a-radio-button value="all">全部</a-radio-button>
          <a-radio-button value="pending">未完成</a-radio-button>
          <a-radio-button value="completed">已完成</a-radio-button>
        </a-radio-group>
        <a-button v-perm="'sales:order:create'" type="primary" data-test="sales-create" @click="openCreate">
          新增销售订单
        </a-button>
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
              {{ record.completed === 1 ? '已完成' : '进行中' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a data-test="sales-detail" @click="openView(record as SalesOrderVO)">查看</a>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <!-- 下单抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="新增销售订单" width="960" destroy-on-close>
      <a-card size="small" title="选择商品（库存为源）" class="mb-3">
        <CascadeFilter v-model="stockFilter" @change="onStockFilterChange" />
        <BasicTable :columns="stockColumns" :fetcher="apiStockPage" :params="stockQuery" class="mt-2">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'qty'">
              <a-input-number
                :value="getQty(record.supplierProductId)"
                :min="0"
                :max="record.quantity"
                :precision="0"
                style="width: 110px"
                @change="(v: any) => setQty(record as InventoryStockVO, v)"
              />
            </template>
          </template>
        </BasicTable>
      </a-card>

      <a-card size="small" :title="`购物车（${selectedRows.length} 项）`" class="mb-3">
        <a-table
          :columns="[
            { title: '产品', dataIndex: 'productName', key: 'productName' },
            { title: '库存', dataIndex: 'stockQty', key: 'stockQty', width: 80 },
            { title: '数量', dataIndex: 'qty', key: 'qty', width: 80 },
            { title: '单价 (GHS)', key: 'unitPrice', width: 140 },
            { title: '小计', key: 'subtotal', width: 110 },
            { title: '操作', key: 'op', width: 70 },
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
                <a-tooltip v-if="rowInvalid(record as CartRow)" title="数量超过库存或非法">⚠</a-tooltip>
              </span>
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
              <a class="text-red-500" @click="removeRow(record as CartRow)">移除</a>
            </template>
          </template>
        </a-table>
        <div class="mt-3 text-right">应收合计：<b>GHS {{ money(totalAmount) }}</b></div>
      </a-card>

      <a-card size="small" title="客户信息">
        <a-form layout="vertical">
          <a-form-item label="客户姓名" required>
            <a-input v-model:value="customer.name" placeholder="必填" allow-clear />
          </a-form-item>
          <a-form-item label="客户手机号" required>
            <a-input v-model:value="customer.phone" placeholder="必填" allow-clear />
          </a-form-item>
          <a-form-item label="客户地址" required>
            <a-input v-model:value="customer.address" placeholder="必填" allow-clear />
          </a-form-item>
          <a-form-item label="备注">
            <a-textarea v-model:value="customer.remark" :rows="2" />
          </a-form-item>
        </a-form>
      </a-card>

      <template #footer>
        <a-space>
          <a-button @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="submitting" :disabled="!canSubmit" data-test="sales-submit" @click="submit">
            提交下单
          </a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- 详情 -->
    <a-drawer v-model:open="viewOpen" title="销售订单详情" width="800" destroy-on-close>
      <template v-if="detail">
        <a-descriptions size="small" :column="2" bordered class="mb-3">
          <a-descriptions-item label="订单号">{{ detail.orderNo }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ STATUS[detail.status].label }}</a-descriptions-item>
          <a-descriptions-item label="客户">{{ detail.customerName }}</a-descriptions-item>
          <a-descriptions-item label="手机号">{{ detail.customerPhone }}</a-descriptions-item>
          <a-descriptions-item label="地址" :span="2">{{ detail.customerAddress }}</a-descriptions-item>
          <a-descriptions-item label="应收金额 (GHS)">{{ money(detail.totalAmount) }}</a-descriptions-item>
          <a-descriptions-item label="实收金额 (GHS)">{{ money(detail.actualAmount) }}</a-descriptions-item>
        </a-descriptions>
        <a-table
          :columns="[
            { title: '产品', dataIndex: 'productName', key: 'productName' },
            { title: '编码', dataIndex: 'productCode', key: 'productCode', width: 120 },
            { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 90 },
            { title: '数量', dataIndex: 'qty', key: 'qty', width: 70 },
            { title: '拒收', dataIndex: 'rejectQty', key: 'rejectQty', width: 70 },
            { title: '小计', dataIndex: 'amount', key: 'amount', width: 100 },
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
