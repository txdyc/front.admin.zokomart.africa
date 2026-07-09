<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import { apiSalesOrderPage, apiSalesOrderGet } from '@/api/sales/order';
import {
  apiLogisticsDispatch,
  apiLogisticsUpdateStatus,
  apiLogisticsReject,
  apiLogisticsComplete,
} from '@/api/sales/logistics';
import { apiLogisticsProviderPage } from '@/api/basedata/logisticsProvider';
import type { SalesOrderVO, SalesOrderItemVO, SalesStatus } from '@/types/sales';
import type { SelectOption } from '@/components/SchemaForm.vue';
import type { Id } from '@/types/api';

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
// 合法状态流转（与后端 SalesConst.TRANSITIONS 一致；dispatch 单列）
const TRANSITIONS: Record<SalesStatus, SalesStatus[]> = {
  PENDING_DISPATCH: [],
  DISPATCHING: ['SIGNED', 'SIGNED_PAID', 'UNREACHABLE', 'REJECTED'],
  UNREACHABLE: ['DISPATCHING', 'REJECTED'],
  SIGNED: ['SIGNED_PAID', 'UNREACHABLE', 'REJECTED'],
  SIGNED_PAID: ['REJECTED'],
  REJECTED: [],
};
const SIGNED_STATES: SalesStatus[] = ['SIGNED', 'SIGNED_PAID'];

// ---------------- 列表 ----------------
const tableRef = ref<InstanceType<typeof BasicTable>>();
const completedTab = ref<'all' | 'pending' | 'completed'>('all');
const query = ref<Record<string, any>>({});
function onTabChange() {
  query.value =
    completedTab.value === 'all' ? {} : { completed: completedTab.value === 'completed' };
}

const providerOptions = ref<SelectOption[]>([]);
const providerMap = computed(() => new Map(providerOptions.value.map((o) => [String(o.value), o.label])));
async function loadProviders() {
  const page = await apiLogisticsProviderPage({ status: 1, current: 1, size: 1000 });
  providerOptions.value = page.records.map((p) => ({ label: p.name, value: p.id }));
}
onMounted(loadProviders);

const listColumns = computed<TableColumnsType>(() => [
  { title: t('sales.order.orderNo'), dataIndex: 'orderNo', key: 'orderNo' },
  { title: t('sales.order.customer'), dataIndex: 'customerName', key: 'customerName', width: 150 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120 },
  { title: t('logistics.track.providerCol'), dataIndex: 'logisticsProviderId', key: 'logisticsProviderId', width: 130 },
  { title: t('logistics.track.receivableGhs'), dataIndex: 'totalAmount', key: 'totalAmount', width: 110 },
  { title: t('logistics.track.receivedGhs'), dataIndex: 'actualAmount', key: 'actualAmount', width: 110 },
  { title: t('sales.order.completed'), dataIndex: 'completed', key: 'completed', width: 80 },
  { title: t('common.operation'), key: 'action', width: 80 },
]);

// ---------------- 详情 + 动作 ----------------
const drawerOpen = ref(false);
const detail = ref<SalesOrderVO | null>(null);
const acting = ref(false);

async function openDetail(row: SalesOrderVO) {
  detail.value = await apiSalesOrderGet(row.id);
  drawerOpen.value = true;
}
async function reloadDetail() {
  if (detail.value) detail.value = await apiSalesOrderGet(detail.value.id);
  tableRef.value?.reload();
}

const curStatus = computed<SalesStatus | null>(() => detail.value?.status ?? null);
const canDispatch = computed(() => curStatus.value === 'PENDING_DISPATCH');
const statusTargets = computed<SalesStatus[]>(() => (curStatus.value ? TRANSITIONS[curStatus.value] : []));
const canReject = computed(() => !!curStatus.value && SIGNED_STATES.includes(curStatus.value));
const canComplete = computed(() => !!curStatus.value && SIGNED_STATES.includes(curStatus.value));

// 派送（派送费可留空：NULL=未知，送达后于签收/拒签时补录）
const dispatchOpen = ref(false);
const dispatchForm = reactive<{ logisticsProviderId?: Id; deliveryFee?: number }>({});
function openDispatch() {
  dispatchForm.logisticsProviderId = undefined;
  dispatchForm.deliveryFee = undefined;
  dispatchOpen.value = true;
}
async function doDispatch() {
  if (dispatchForm.logisticsProviderId == null) {
    message.warning(t('logistics.track.selectProvider'));
    return;
  }
  acting.value = true;
  try {
    await apiLogisticsDispatch(detail.value!.id, {
      logisticsProviderId: dispatchForm.logisticsProviderId,
      deliveryFee: dispatchForm.deliveryFee ?? null,
    });
    message.success(t('logistics.track.dispatched'));
    dispatchOpen.value = false;
    await reloadDetail();
  } finally {
    acting.value = false;
  }
}

// 状态流转：outcome（签收/签收已付/拒签）弹费用确认框，其余一键直发
const FEE_PROMPT_STATES: SalesStatus[] = ['SIGNED', 'SIGNED_PAID', 'REJECTED'];
const statusModal = reactive<{ open: boolean; target: SalesStatus | null; deliveryFee?: number }>({
  open: false,
  target: null,
});
function onStatusClick(s: SalesStatus) {
  if (FEE_PROMPT_STATES.includes(s)) {
    statusModal.target = s;
    statusModal.deliveryFee = detail.value?.deliveryFee ?? undefined;
    statusModal.open = true;
  } else {
    doUpdateStatus(s, null);
  }
}
async function doUpdateStatus(status: SalesStatus, deliveryFee: number | null) {
  acting.value = true;
  try {
    await apiLogisticsUpdateStatus(detail.value!.id, { status, deliveryFee });
    message.success(t('logistics.track.statusUpdatedTo', { label: STATUS.value[status].label }));
    await reloadDetail();
  } finally {
    acting.value = false;
  }
}
async function doStatusConfirm() {
  if (!statusModal.target) return;
  await doUpdateStatus(statusModal.target, statusModal.deliveryFee ?? null);
  statusModal.open = false;
}

// 拒收
const rejectOpen = ref(false);
const rejectForm = reactive<{ item: SalesOrderItemVO | null; rejectQty: number }>({ item: null, rejectQty: 1 });
function openReject(item: SalesOrderItemVO) {
  rejectForm.item = item;
  rejectForm.rejectQty = 1;
  rejectOpen.value = true;
}
async function doReject() {
  const item = rejectForm.item!;
  if (rejectForm.rejectQty < 1 || rejectForm.rejectQty > item.qty) {
    message.warning(t('logistics.track.rejectQtyRange'));
    return;
  }
  acting.value = true;
  try {
    await apiLogisticsReject(detail.value!.id, { itemId: item.id, rejectQty: rejectForm.rejectQty });
    message.success(t('logistics.track.rejectRecorded'));
    rejectOpen.value = false;
    await reloadDetail();
  } finally {
    acting.value = false;
  }
}

// 完成
async function doComplete() {
  acting.value = true;
  try {
    await apiLogisticsComplete(detail.value!.id);
    message.success(t('logistics.track.completed'));
    await reloadDetail();
  } finally {
    acting.value = false;
  }
}

defineExpose({
  openDetail, openDispatch, doDispatch, doUpdateStatus, openReject, doReject, doComplete,
  onStatusClick, doStatusConfirm, dispatchForm, statusModal,
});
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-radio-group v-model:value="completedTab" button-style="solid" @change="onTabChange">
        <a-radio-button value="all">{{ t('common.all') }}</a-radio-button>
        <a-radio-button value="pending">{{ t('sales.order.tabPending') }}</a-radio-button>
        <a-radio-button value="completed">{{ t('sales.order.tabCompleted') }}</a-radio-button>
      </a-radio-group>
    </a-card>

    <a-card :bordered="false">
      <BasicTable ref="tableRef" :columns="listColumns" :fetcher="apiSalesOrderPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="STATUS[(record as SalesOrderVO).status].color">
              {{ STATUS[(record as SalesOrderVO).status].label }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'logisticsProviderId'">
            {{ record.logisticsProviderId != null ? providerMap.get(String(record.logisticsProviderId)) ?? record.logisticsProviderId : '—' }}
          </template>
          <template v-else-if="column.key === 'totalAmount'">{{ money(record.totalAmount) }}</template>
          <template v-else-if="column.key === 'actualAmount'">{{ money(record.actualAmount) }}</template>
          <template v-else-if="column.key === 'completed'">
            <a-tag :color="record.completed === 1 ? 'green' : 'default'">
              {{ record.completed === 1 ? t('sales.order.completedYes') : t('sales.order.inProgress') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a data-test="track-detail" @click="openDetail(record as SalesOrderVO)">{{ t('logistics.track.handle') }}</a>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <!-- 详情 + 动作 -->
    <a-drawer v-model:open="drawerOpen" :title="t('logistics.track.handlingTitle')" width="860" destroy-on-close>
      <template v-if="detail">
        <a-descriptions size="small" :column="2" bordered class="mb-3">
          <a-descriptions-item :label="t('sales.order.orderNo')">{{ detail.orderNo }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">
            <a-tag :color="STATUS[detail.status].color">{{ STATUS[detail.status].label }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="t('sales.order.customer')">{{ detail.customerName }} / {{ detail.customerPhone }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.address')">{{ detail.customerAddress }}</a-descriptions-item>
          <a-descriptions-item :label="t('logistics.track.receivableGhs')">{{ money(detail.totalAmount) }}</a-descriptions-item>
          <a-descriptions-item :label="t('logistics.track.receivedGhs')">{{ money(detail.actualAmount) }}</a-descriptions-item>
          <a-descriptions-item :label="t('logistics.track.deliveryFeeGhs')">
            {{ detail.deliveryFee != null ? money(detail.deliveryFee) : '—' }}
          </a-descriptions-item>
        </a-descriptions>

        <!-- 动作区 -->
        <div class="mb-3">
          <a-space wrap>
            <a-button
              v-if="canDispatch"
              v-perm="'logistics:dispatch'"
              type="primary"
              data-test="track-dispatch"
              @click="openDispatch"
            >
              {{ t('logistics.track.dispatch') }}
            </a-button>
            <a-button
              v-for="s in statusTargets"
              :key="s"
              v-perm="'logistics:status'"
              :loading="acting"
              :data-test="`track-to-${s}`"
              @click="onStatusClick(s)"
            >
              {{ t('logistics.track.toStatus', { label: STATUS[s].label }) }}
            </a-button>
            <a-popconfirm v-if="canComplete" :title="t('logistics.track.confirmComplete')" @confirm="doComplete">
              <a-button v-perm="'logistics:complete'" type="primary" :loading="acting" data-test="track-complete">
                {{ t('logistics.track.complete') }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </div>

        <a-table
          :columns="[
            { title: t('sales.order.product'), dataIndex: 'productName', key: 'productName' },
            { title: t('sales.order.unitPrice'), dataIndex: 'unitPrice', key: 'unitPrice', width: 90 },
            { title: t('common.quantity'), dataIndex: 'qty', key: 'qty', width: 70 },
            { title: t('sales.order.rejectQty'), dataIndex: 'rejectQty', key: 'rejectQty', width: 70 },
            { title: t('common.subtotal'), dataIndex: 'amount', key: 'amount', width: 100 },
            { title: t('logistics.track.received'), dataIndex: 'actualAmount', key: 'actualAmount', width: 100 },
            { title: t('common.operation'), key: 'op', width: 80 },
          ]"
          :data-source="detail.items"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'unitPrice'">{{ money(record.unitPrice) }}</template>
            <template v-else-if="column.key === 'amount'">{{ money(record.amount) }}</template>
            <template v-else-if="column.key === 'actualAmount'">{{ money(record.actualAmount) }}</template>
            <template v-else-if="column.key === 'op'">
              <a
                v-if="canReject"
                v-perm="'logistics:reject'"
                class="text-red-500"
                data-test="track-reject"
                @click="openReject(record as SalesOrderItemVO)"
              >{{ t('logistics.track.reject') }}</a>
              <span v-else class="text-gray-300">—</span>
            </template>
          </template>
        </a-table>
      </template>
    </a-drawer>

    <!-- 派送弹窗 -->
    <a-modal v-model:open="dispatchOpen" :title="t('logistics.track.dispatchTitle')" :confirm-loading="acting" @ok="doDispatch">
      <a-form layout="vertical">
        <a-form-item :label="t('logistics.track.provider')" required>
          <a-select
            v-model:value="dispatchForm.logisticsProviderId"
            :placeholder="t('logistics.track.selectProvider')"
            show-search
            option-filter-prop="label"
            :options="providerOptions"
            data-test="dispatch-provider"
          />
        </a-form-item>
        <a-form-item :label="t('logistics.track.deliveryFeeGhs')" :extra="t('logistics.track.feeOptionalHint')">
          <a-input-number v-model:value="dispatchForm.deliveryFee" :min="0" :precision="2" class="w-full" data-test="dispatch-fee" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 拒收弹窗 -->
    <a-modal v-model:open="rejectOpen" :title="t('logistics.track.rejectTitle')" :confirm-loading="acting" @ok="doReject">
      <a-form v-if="rejectForm.item" layout="vertical">
        <a-form-item :label="t('sales.order.product')">{{ rejectForm.item.productName }}{{ t('logistics.track.orderedQty', { qty: rejectForm.item.qty }) }}</a-form-item>
        <a-form-item :label="t('logistics.track.rejectQtyLabel')" required>
          <a-input-number v-model:value="rejectForm.rejectQty" :min="1" :max="rejectForm.item.qty" :precision="0" class="w-full" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 状态确认 + 补录派送费弹窗（SIGNED / SIGNED_PAID / REJECTED） -->
    <a-modal v-model:open="statusModal.open" :title="t('logistics.track.statusConfirmTitle')" :confirm-loading="acting" @ok="doStatusConfirm">
      <a-form layout="vertical">
        <a-form-item :label="t('common.status')">
          <a-tag v-if="statusModal.target" :color="STATUS[statusModal.target].color">
            {{ STATUS[statusModal.target].label }}
          </a-tag>
        </a-form-item>
        <a-form-item :label="t('logistics.track.deliveryFeeGhs')" :extra="t('logistics.track.deliveryFeeNowHint')">
          <a-input-number v-model:value="statusModal.deliveryFee" :min="0" :precision="2" class="w-full" data-test="status-fee" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
