<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
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

const STATUS: Record<SalesStatus, { label: string; color: string }> = {
  PENDING_DISPATCH: { label: '待派送', color: 'default' },
  DISPATCHING: { label: '派送中', color: 'blue' },
  SIGNED: { label: '已签收', color: 'cyan' },
  SIGNED_PAID: { label: '已签收已付', color: 'green' },
  UNREACHABLE: { label: '无法送达', color: 'orange' },
  REJECTED: { label: '已拒收', color: 'red' },
};
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

const listColumns: TableColumnsType = [
  { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '物流商', dataIndex: 'logisticsProviderId', key: 'logisticsProviderId', width: 130 },
  { title: '应收 (GHS)', dataIndex: 'totalAmount', key: 'totalAmount', width: 110 },
  { title: '实收 (GHS)', dataIndex: 'actualAmount', key: 'actualAmount', width: 110 },
  { title: '完成', dataIndex: 'completed', key: 'completed', width: 80 },
  { title: '操作', key: 'action', width: 80 },
];

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

// 派送
const dispatchOpen = ref(false);
const dispatchForm = reactive<{ logisticsProviderId?: Id; deliveryFee: number }>({ deliveryFee: 0 });
function openDispatch() {
  dispatchForm.logisticsProviderId = undefined;
  dispatchForm.deliveryFee = 0;
  dispatchOpen.value = true;
}
async function doDispatch() {
  if (dispatchForm.logisticsProviderId == null) {
    message.warning('请选择物流服务商');
    return;
  }
  if (dispatchForm.deliveryFee < 0) {
    message.warning('派送费不能为负');
    return;
  }
  acting.value = true;
  try {
    await apiLogisticsDispatch(detail.value!.id, {
      logisticsProviderId: dispatchForm.logisticsProviderId,
      deliveryFee: dispatchForm.deliveryFee,
    });
    message.success('已派送');
    dispatchOpen.value = false;
    await reloadDetail();
  } finally {
    acting.value = false;
  }
}

// 状态流转
async function doUpdateStatus(status: SalesStatus) {
  acting.value = true;
  try {
    await apiLogisticsUpdateStatus(detail.value!.id, status);
    message.success(`状态更新为「${STATUS[status].label}」`);
    await reloadDetail();
  } finally {
    acting.value = false;
  }
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
    message.warning('拒收数量需在 1..订购数量之间');
    return;
  }
  acting.value = true;
  try {
    await apiLogisticsReject(detail.value!.id, { itemId: item.id, rejectQty: rejectForm.rejectQty });
    message.success('已记录拒收');
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
    message.success('订单已完成，已结算实收金额');
    await reloadDetail();
  } finally {
    acting.value = false;
  }
}

defineExpose({
  openDetail, openDispatch, doDispatch, doUpdateStatus, openReject, doReject, doComplete,
});
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-radio-group v-model:value="completedTab" button-style="solid" @change="onTabChange">
        <a-radio-button value="all">全部</a-radio-button>
        <a-radio-button value="pending">未完成</a-radio-button>
        <a-radio-button value="completed">已完成</a-radio-button>
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
              {{ record.completed === 1 ? '已完成' : '进行中' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a data-test="track-detail" @click="openDetail(record as SalesOrderVO)">处理</a>
          </template>
        </template>
      </BasicTable>
    </a-card>

    <!-- 详情 + 动作 -->
    <a-drawer v-model:open="drawerOpen" title="物流处理" width="860" destroy-on-close>
      <template v-if="detail">
        <a-descriptions size="small" :column="2" bordered class="mb-3">
          <a-descriptions-item label="订单号">{{ detail.orderNo }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="STATUS[detail.status].color">{{ STATUS[detail.status].label }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="客户">{{ detail.customerName }} / {{ detail.customerPhone }}</a-descriptions-item>
          <a-descriptions-item label="地址">{{ detail.customerAddress }}</a-descriptions-item>
          <a-descriptions-item label="应收 (GHS)">{{ money(detail.totalAmount) }}</a-descriptions-item>
          <a-descriptions-item label="实收 (GHS)">{{ money(detail.actualAmount) }}</a-descriptions-item>
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
              派送
            </a-button>
            <a-button
              v-for="s in statusTargets"
              :key="s"
              v-perm="'logistics:status'"
              :loading="acting"
              @click="doUpdateStatus(s)"
            >
              转「{{ STATUS[s].label }}」
            </a-button>
            <a-popconfirm v-if="canComplete" title="确认完成并结算实收？" @confirm="doComplete">
              <a-button v-perm="'logistics:complete'" type="primary" :loading="acting" data-test="track-complete">
                完成
              </a-button>
            </a-popconfirm>
          </a-space>
        </div>

        <a-table
          :columns="[
            { title: '产品', dataIndex: 'productName', key: 'productName' },
            { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 90 },
            { title: '数量', dataIndex: 'qty', key: 'qty', width: 70 },
            { title: '拒收', dataIndex: 'rejectQty', key: 'rejectQty', width: 70 },
            { title: '小计', dataIndex: 'amount', key: 'amount', width: 100 },
            { title: '实收', dataIndex: 'actualAmount', key: 'actualAmount', width: 100 },
            { title: '操作', key: 'op', width: 80 },
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
              >拒收</a>
              <span v-else class="text-gray-300">—</span>
            </template>
          </template>
        </a-table>
      </template>
    </a-drawer>

    <!-- 派送弹窗 -->
    <a-modal v-model:open="dispatchOpen" title="派送" :confirm-loading="acting" @ok="doDispatch">
      <a-form layout="vertical">
        <a-form-item label="物流服务商" required>
          <a-select
            v-model:value="dispatchForm.logisticsProviderId"
            placeholder="请选择物流服务商"
            show-search
            option-filter-prop="label"
            :options="providerOptions"
            data-test="dispatch-provider"
          />
        </a-form-item>
        <a-form-item label="派送费 (GHS)" required>
          <a-input-number v-model:value="dispatchForm.deliveryFee" :min="0" :precision="2" class="w-full" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 拒收弹窗 -->
    <a-modal v-model:open="rejectOpen" title="标记拒收" :confirm-loading="acting" @ok="doReject">
      <a-form v-if="rejectForm.item" layout="vertical">
        <a-form-item label="产品">{{ rejectForm.item.productName }}（订购 {{ rejectForm.item.qty }}）</a-form-item>
        <a-form-item label="拒收数量" required>
          <a-input-number v-model:value="rejectForm.rejectQty" :min="1" :max="rejectForm.item.qty" :precision="0" class="w-full" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
