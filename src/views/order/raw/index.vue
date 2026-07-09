<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import { apiRawOrderPage } from '@/api/order/rawOrder';
import type { RawOrderVO, RawOrderStatus } from '@/types/order';
import RawOrderImportModal from './RawOrderImportModal.vue';

const { t } = useI18n();
const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);

const searchForm = reactive<{
  keyword: string;
  status: RawOrderStatus | undefined;
  brand: string | undefined;
  dateRange: [string, string] | undefined;
}>({
  keyword: '',
  status: undefined,
  brand: undefined,
  dateRange: undefined,
});

// 当前生效的查询参数（含分页）。暴露给测试与 BasicTable 之外的手动加载使用。
const query = reactive<Record<string, any>>({ current: 1, size: 10 });
const loading = ref(false);
const dataSource = ref<RawOrderVO[]>([]);
const total = ref(0);

const load = async () => {
  loading.value = true;
  try {
    const res = await apiRawOrderPage({ ...query });
    dataSource.value = res.records;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
};

const onSearch = () => {
  query.current = 1;
  query.keyword = searchForm.keyword || undefined;
  query.status = searchForm.status;
  query.brand = searchForm.brand || undefined;
  if (searchForm.dateRange && searchForm.dateRange.length === 2) {
    query.dateStart = searchForm.dateRange[0];
    query.dateEnd = searchForm.dateRange[1];
  } else {
    query.dateStart = undefined;
    query.dateEnd = undefined;
  }
  load();
};

const onReset = () => {
  searchForm.keyword = '';
  searchForm.status = undefined;
  searchForm.brand = undefined;
  searchForm.dateRange = undefined;
  Object.keys(query).forEach((k) => {
    if (k !== 'current' && k !== 'size') delete query[k];
  });
  query.current = 1;
  load();
};

const onPageChange = (pag: any) => {
  query.current = pag.current;
  query.size = pag.pageSize;
  load();
};

const pagination = computed(() => ({
  current: query.current,
  pageSize: query.size,
  total: total.value,
  showSizeChanger: true,
  showTotal: (n: number) => `${n}`,
}));

onMounted(load);

const importOpen = ref(false);
const openImport = () => {
  importOpen.value = true;
};
const onImportOk = () => {
  load();
};

const statusColor: Record<RawOrderStatus, string> = {
  PAID: 'green',
  RECIPIENT_REFUSED: 'red',
  UNABLE_TO_CONTACT_RECIPIENT: 'orange',
  RECIPIENT_UNABLE_TO_PAY: 'volcano',
};
const statusLabel = (s: RawOrderStatus) => t(`rawOrder.statusText.${s}`);

const columns = computed<TableColumnsType>(() => [
  { title: t('rawOrder.date'), dataIndex: 'orderDate', key: 'orderDate', width: 110 },
  { title: t('rawOrder.brand'), dataIndex: 'brand', key: 'brand', width: 100 },
  { title: t('rawOrder.productCode'), dataIndex: 'productCode', key: 'productCode', width: 120 },
  { title: t('rawOrder.productName'), dataIndex: 'productName', key: 'productName' },
  { title: t('rawOrder.quantity'), dataIndex: 'quantity', key: 'quantity', width: 70 },
  { title: t('rawOrder.price'), dataIndex: 'price', key: 'price', width: 100 },
  { title: t('rawOrder.customerName'), dataIndex: 'customerName', key: 'customerName', width: 120 },
  { title: t('rawOrder.telephone'), dataIndex: 'telephone', key: 'telephone', width: 130 },
  { title: t('rawOrder.city'), dataIndex: 'city', key: 'city', width: 100 },
  { title: t('rawOrder.address'), dataIndex: 'address', key: 'address' },
  { title: t('rawOrder.cod'), dataIndex: 'cod', key: 'cod', width: 100 },
  { title: t('rawOrder.freight'), dataIndex: 'freight', key: 'freight', width: 100 },
  { title: t('rawOrder.balance'), dataIndex: 'balance', key: 'balance', width: 100 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 140 },
]);

defineExpose({ searchForm, query, onSearch, onReset, importOpen, openImport });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item :label="t('rawOrder.dateRange')">
          <a-range-picker
            v-model:value="searchForm.dateRange"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
        </a-form-item>
        <a-form-item :label="t('rawOrder.brand')">
          <a-input v-model:value="searchForm.brand" allow-clear style="width: 140px" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select
            v-model:value="searchForm.status"
            allow-clear
            style="width: 180px"
            :placeholder="t('common.pleaseSelect')"
          >
            <a-select-option value="PAID">{{ statusLabel('PAID') }}</a-select-option>
            <a-select-option value="RECIPIENT_REFUSED">{{ statusLabel('RECIPIENT_REFUSED') }}</a-select-option>
            <a-select-option value="UNABLE_TO_CONTACT_RECIPIENT">{{ statusLabel('UNABLE_TO_CONTACT_RECIPIENT') }}</a-select-option>
            <a-select-option value="RECIPIENT_UNABLE_TO_PAY">{{ statusLabel('RECIPIENT_UNABLE_TO_PAY') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.keyword')">
          <a-input
            v-model:value="searchForm.keyword"
            :placeholder="t('rawOrder.keywordPlaceholder')"
            allow-clear
            style="width: 220px"
            @press-enter="onSearch"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" data-test="raw-order-search" @click="onSearch">{{ t('common.search') }}</a-button>
            <a-button @click="onReset">{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false">
      <template #title>
        <a-space>
          <span>{{ t('rawOrder.title') }}</span>
          <a-button v-perm="'raw-order:import'" type="primary" @click="openImport">
            {{ t('rawOrder.importBtn') }}
          </a-button>
        </a-space>
      </template>
      <a-table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        @change="onPageChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'price'">{{ money(record.price) }}</template>
          <template v-else-if="column.key === 'cod'">{{ money(record.cod) }}</template>
          <template v-else-if="column.key === 'freight'">{{ money(record.freight) }}</template>
          <template v-else-if="column.key === 'balance'">{{ money(record.balance) }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status as RawOrderStatus]">
              {{ statusLabel(record.status as RawOrderStatus) }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-card>

    <RawOrderImportModal v-model:visible="importOpen" @ok="onImportOk" />
  </div>
</template>
