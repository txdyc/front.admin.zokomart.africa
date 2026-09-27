<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import CascadeFilter from '@/components/CascadeFilter.vue';
import { usePermission } from '@/hooks/usePermission';
import { apiSalesOrderGet, apiSalesOrderUpdate, apiOrderableProductsPage } from '@/api/sales/order';
import type { SalesOrderVO, SalesOrderUpdateDTO, OrderableProductVO, OrderableProductQuery } from '@/types/sales';
import type { Id } from '@/types/api';

const emit = defineEmits<{ ok: [] }>();
const { t } = useI18n();
const { hasPerm } = usePermission();
const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);

interface EditRow {
  /** 行 key：已有明细用 id，新增行用临时串 */
  key: string;
  id?: Id;
  supplierProductId: Id;
  productName: string;
  productCode: string | null;
  qty: number;
  unitPrice: number;
  /** 原行金额；改过数量/单价后置 null，交由后端按 unitPrice*qty 重算 */
  amount: number | null;
}

const open = ref(false);
const saving = ref(false);
const order = ref<SalesOrderVO | null>(null);
const form = reactive({ customerName: '', customerPhone: '', customerAddress: '', city: '', orderDate: '', remark: '' });
const rows = ref<EditRow[]>([]);
let newSeq = 0;

// 明细仅未派送、未完成订单可改（与后端一致）；已派送只能修正客户信息
const itemsEditable = computed(
  () => !!order.value && order.value.status === 'PENDING_DISPATCH' && order.value.completed !== 1,
);
// 添加商品依赖可下单产品接口（sales:order:create）
const canAddProduct = computed(() => itemsEditable.value && hasPerm('sales:order:create'));

async function openDrawer(id: Id) {
  const o = await apiSalesOrderGet(id);
  order.value = o;
  form.customerName = o.customerName ?? '';
  form.customerPhone = o.customerPhone ?? '';
  form.customerAddress = o.customerAddress ?? '';
  form.city = o.city ?? '';
  form.orderDate = o.orderDate ?? '';
  form.remark = o.remark ?? '';
  rows.value = (o.items ?? []).map((it) => ({
    key: String(it.id),
    id: it.id,
    supplierProductId: it.supplierProductId,
    productName: it.productName,
    productCode: it.productCode,
    qty: it.qty,
    unitPrice: it.unitPrice ?? 0,
    amount: it.amount,
  }));
  stockFilter.value = {};
  stockQuery.value = {};
  open.value = true;
}

function setQty(r: EditRow, v: number | null) {
  r.qty = v ?? 0;
  r.amount = null;
}
function setUnitPrice(r: EditRow, v: number | null) {
  r.unitPrice = v ?? 0;
  r.amount = null;
}
function removeRow(r: EditRow) {
  rows.value = rows.value.filter((x) => x.key !== r.key);
}
function addProduct(p: OrderableProductVO) {
  const exist = rows.value.find((r) => String(r.supplierProductId) === String(p.supplierProductId));
  if (exist) {
    setQty(exist, exist.qty + 1);
    return;
  }
  rows.value.push({
    key: `new-${++newSeq}`,
    supplierProductId: p.supplierProductId,
    productName: p.productName,
    productCode: p.productCode,
    qty: 1,
    unitPrice: p.retailPrice ?? 0,
    amount: null,
  });
}

const rowSubtotal = (r: EditRow) => r.amount ?? r.unitPrice * r.qty;
const totalAmount = computed(() => rows.value.reduce((s, r) => s + rowSubtotal(r), 0));
const customerOk = computed(
  () => !!form.customerName.trim() && !!form.customerPhone.trim() && !!form.customerAddress.trim(),
);
const itemsOk = computed(() => !itemsEditable.value || (rows.value.length > 0 && rows.value.every((r) => r.qty >= 1)));

async function submit() {
  if (!order.value) return;
  if (!customerOk.value) {
    message.warning(t('sales.order.fillCustomerInfo'));
    return;
  }
  if (!itemsOk.value) {
    message.warning(t('sales.order.editItemsInvalid'));
    return;
  }
  const payload: SalesOrderUpdateDTO = {
    customerName: form.customerName.trim(),
    customerPhone: form.customerPhone.trim(),
    customerAddress: form.customerAddress.trim(),
    city: form.city.trim() || null,
    orderDate: form.orderDate || null,
    remark: form.remark.trim() || null,
  };
  if (itemsEditable.value) {
    payload.items = rows.value.map((r) => ({
      id: r.id,
      supplierProductId: r.supplierProductId,
      qty: r.qty,
      unitPrice: r.unitPrice,
      amount: r.amount,
    }));
  }
  saving.value = true;
  try {
    await apiSalesOrderUpdate(order.value.id, payload);
    message.success(t('common.saveSuccess'));
    open.value = false;
    emit('ok');
  } finally {
    saving.value = false;
  }
}

// ---------------- 添加商品 ----------------
const stockFilter = ref<OrderableProductQuery>({});
const stockQuery = ref<Record<string, any>>({});
const onStockFilterChange = (v: OrderableProductQuery) => (stockQuery.value = { ...v });
const stockColumns = computed<TableColumnsType>(() => [
  { title: t('sales.order.product'), dataIndex: 'productName', key: 'productName' },
  { title: t('common.code'), dataIndex: 'productCode', key: 'productCode', width: 120 },
  { title: t('sales.order.currentStock'), dataIndex: 'quantity', key: 'quantity', width: 90 },
  { title: t('common.operation'), key: 'add', width: 80 },
]);
const itemColumns = computed<TableColumnsType>(() => [
  { title: t('sales.order.product'), dataIndex: 'productName', key: 'productName' },
  { title: t('common.code'), dataIndex: 'productCode', key: 'productCode', width: 110 },
  { title: t('common.quantity'), key: 'qty', width: 110 },
  { title: t('sales.order.unitPriceGhs'), key: 'unitPrice', width: 140 },
  { title: t('common.subtotal'), key: 'subtotal', width: 100 },
  ...(itemsEditable.value ? [{ title: t('common.operation'), key: 'op', width: 70 }] : []),
]);

defineExpose({ openDrawer, setQty, setUnitPrice, removeRow, addProduct, submit, rows, form, itemsEditable, totalAmount });
</script>

<template>
  <a-drawer v-model:open="open" :title="t('sales.order.editTitle')" width="900" destroy-on-close>
    <template v-if="order">
      <a-alert
        v-if="!itemsEditable"
        type="info"
        show-icon
        class="mb-3"
        :message="t('sales.order.editItemsLocked')"
        data-test="sales-edit-locked"
      />

      <a-card size="small" :title="t('sales.order.customerInfo')" class="mb-3">
        <a-form layout="vertical">
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item :label="t('sales.order.customerName')" required>
                <a-input v-model:value="form.customerName" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('sales.order.customerPhone')" required>
                <a-input v-model:value="form.customerPhone" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item :label="t('sales.order.customerAddress')" required>
                <a-input v-model:value="form.customerAddress" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('sales.order.city')">
                <a-input v-model:value="form.city" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('sales.order.orderDate')">
                <a-date-picker v-model:value="form.orderDate" value-format="YYYY-MM-DD" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item :label="t('common.remark')">
                <a-textarea v-model:value="form.remark" :rows="2" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-card>

      <a-card size="small" :title="t('sales.order.editItems')" class="mb-3">
        <a-table :columns="itemColumns" :data-source="rows" :pagination="false" row-key="key" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'qty'">
              <a-input-number
                v-if="itemsEditable"
                :value="record.qty"
                :min="1"
                :precision="0"
                style="width: 90px"
                @change="(v: any) => setQty(record as EditRow, v)"
              />
              <span v-else>{{ record.qty }}</span>
            </template>
            <template v-else-if="column.key === 'unitPrice'">
              <a-input-number
                v-if="itemsEditable"
                :value="record.unitPrice"
                :min="0"
                :precision="2"
                style="width: 120px"
                @change="(v: any) => setUnitPrice(record as EditRow, v)"
              />
              <span v-else>{{ money(record.unitPrice) }}</span>
            </template>
            <template v-else-if="column.key === 'subtotal'">{{ money(rowSubtotal(record as EditRow)) }}</template>
            <template v-else-if="column.key === 'op'">
              <a class="text-red-500" @click="removeRow(record as EditRow)">{{ t('common.remove') }}</a>
            </template>
          </template>
        </a-table>
        <div class="mt-3 text-right">{{ t('sales.order.receivableTotal') }}<b>GHS {{ money(totalAmount) }}</b></div>
      </a-card>

      <a-card v-if="canAddProduct" size="small" :title="t('sales.order.addProduct')">
        <CascadeFilter v-model="stockFilter" @change="onStockFilterChange" />
        <BasicTable :columns="stockColumns" :fetcher="apiOrderableProductsPage" :params="stockQuery" class="mt-2">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'quantity'">
              <span :class="{ 'text-red-500': record.quantity <= 0 }">{{ record.quantity }}</span>
            </template>
            <template v-else-if="column.key === 'add'">
              <a @click="addProduct(record as OrderableProductVO)">{{ t('sales.order.add') }}</a>
            </template>
          </template>
        </BasicTable>
      </a-card>
    </template>

    <template #footer>
      <a-space>
        <a-button @click="open = false">{{ t('common.cancel') }}</a-button>
        <a-button
          type="primary"
          :loading="saving"
          :disabled="!customerOk || !itemsOk"
          data-test="sales-edit-submit"
          @click="submit"
        >
          {{ t('common.save') }}
        </a-button>
      </a-space>
    </template>
  </a-drawer>
</template>
