<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import { apiCustomerPage } from '@/api/customer';

const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);

const tableRef = ref<InstanceType<typeof BasicTable>>();
const searchForm = reactive<{ keyword?: string }>({});
const query = ref<Record<string, any>>({});
const onSearch = () => (query.value = { ...searchForm });
const onReset = () => {
  searchForm.keyword = undefined;
  query.value = {};
};

const columns: TableColumnsType = [
  { title: '客户姓名', dataIndex: 'customerName', key: 'customerName' },
  { title: '电话', dataIndex: 'customerPhone', key: 'customerPhone', width: 150 },
  { title: '地址', dataIndex: 'customerAddress', key: 'customerAddress' },
  { title: '订单数', dataIndex: 'orderCount', key: 'orderCount', width: 90 },
  { title: '累计金额 (GHS)', dataIndex: 'totalAmount', key: 'totalAmount', width: 140 },
  { title: '最近下单时间', dataIndex: 'lastOrderTime', key: 'lastOrderTime', width: 180 },
];

defineExpose({ searchForm, query, onSearch, onReset });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item label="关键字">
          <a-input
            v-model:value="searchForm.keyword"
            placeholder="客户姓名 / 电话"
            allow-clear
            style="width: 220px"
            @press-enter="onSearch"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" data-test="customer-search" @click="onSearch">查询</a-button>
            <a-button @click="onReset">重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false">
      <BasicTable ref="tableRef" :columns="columns" :fetcher="apiCustomerPage" :params="query">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'totalAmount'">{{ money(record.totalAmount) }}</template>
          <template v-else-if="column.key === 'customerAddress'">{{ record.customerAddress ?? '—' }}</template>
        </template>
      </BasicTable>
    </a-card>
  </div>
</template>
