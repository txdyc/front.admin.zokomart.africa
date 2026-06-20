<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import type { TableColumnsType } from 'ant-design-vue';
import { apiSalesOrderLabels } from '@/api/sales/order';
import type { SalesOrderLabelVO } from '@/types/sales';
import type { Id } from '@/types/api';
import {
  expandLabels,
  totalLabelCount,
  renderLabelQr,
  buildLabelsHtml,
} from '@/utils/label/packageLabel';
import { printHtml } from '@/utils/label/print';

const open = ref(false);
const loading = ref(false);
const printing = ref(false);
const orders = ref<SalesOrderLabelVO[]>([]);
const selectedKeys = ref<Id[]>([]);

const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);

const columns: TableColumnsType = [
  { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 160 },
  { title: '件数', dataIndex: 'totalQty', key: 'totalQty', width: 80 },
  { title: '应收 (GHS)', dataIndex: 'totalAmount', key: 'totalAmount', width: 120 },
];

const selectedOrders = computed(() =>
  orders.value.filter((o) => selectedKeys.value.includes(o.id)),
);
const labelCount = computed(() => totalLabelCount(selectedOrders.value));

async function load() {
  loading.value = true;
  try {
    const data = await apiSalesOrderLabels({
      status: 'PENDING_DISPATCH',
      date: dayjs().format('YYYY-MM-DD'),
    });
    orders.value = data;
    selectedKeys.value = data.map((o) => o.id); // 默认全选
  } catch {
    // 错误已由 request 响应拦截器统一 message.error 提示，此处仅防止未处理的 promise 拒绝
  } finally {
    loading.value = false;
  }
}

function openDrawer() {
  open.value = true;
  orders.value = [];
  selectedKeys.value = [];
  load();
}

async function doPrint() {
  if (selectedOrders.value.length === 0) {
    message.warning('请至少选择一个订单');
    return;
  }
  printing.value = true;
  try {
    const units = expandLabels(selectedOrders.value);
    const uniqueNos = [...new Set(selectedOrders.value.map((o) => o.orderNo))];
    const qrPairs = await Promise.all(
      uniqueNos.map(async (no) => [no, await renderLabelQr(no)] as const),
    );
    const qrMap = new Map<string, string>(qrPairs);
    const html = buildLabelsHtml(units, qrMap);
    const ok = printHtml(html);
    if (!ok) message.error('打印窗口被拦截，请允许本站弹出窗口后重试');
  } catch {
    message.error('生成面单失败，请重试');
  } finally {
    printing.value = false;
  }
}

const onSelChange = (keys: Id[]) => (selectedKeys.value = keys);

defineExpose({ openDrawer, doPrint, labelCount });
</script>

<template>
  <a-drawer v-model:open="open" title="打印今日面单" width="720" destroy-on-close>
    <div class="mb-3">
      已选 <b>{{ selectedOrders.length }}</b> 单，将打印 <b>{{ labelCount }}</b> 张面单
    </div>
    <a-table
      :columns="columns"
      :data-source="orders"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="small"
      :row-selection="{ selectedRowKeys: selectedKeys, onChange: onSelChange }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'totalAmount'">{{ money(record.totalAmount) }}</template>
      </template>
    </a-table>
    <template #footer>
      <a-space>
        <a-button @click="open = false">取消</a-button>
        <a-button
          type="primary"
          :loading="printing"
          :disabled="selectedOrders.length === 0"
          data-test="label-print-go"
          @click="doPrint"
        >
          打印（{{ labelCount }} 张）
        </a-button>
      </a-space>
    </template>
  </a-drawer>
</template>
