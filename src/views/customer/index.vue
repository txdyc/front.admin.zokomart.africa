<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import BasicTable from '@/components/BasicTable.vue';
import { apiCustomerPage } from '@/api/customer';

const { t } = useI18n();

const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);

const tableRef = ref<InstanceType<typeof BasicTable>>();
const searchForm = reactive<{ keyword?: string }>({});
const query = ref<Record<string, any>>({});
const onSearch = () => (query.value = { ...searchForm });
const onReset = () => {
  searchForm.keyword = undefined;
  query.value = {};
};

const columns = computed<TableColumnsType>(() => [
  { title: t('customer.customerName'), dataIndex: 'customerName', key: 'customerName' },
  { title: t('customer.phone'), dataIndex: 'customerPhone', key: 'customerPhone', width: 150 },
  { title: t('common.address'), dataIndex: 'customerAddress', key: 'customerAddress' },
  { title: t('customer.orderCount'), dataIndex: 'orderCount', key: 'orderCount', width: 90 },
  { title: t('customer.totalAmount'), dataIndex: 'totalAmount', key: 'totalAmount', width: 140 },
  { title: t('customer.lastOrderTime'), dataIndex: 'lastOrderTime', key: 'lastOrderTime', width: 180 },
]);

defineExpose({ searchForm, query, onSearch, onReset });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item :label="t('common.keyword')">
          <a-input
            v-model:value="searchForm.keyword"
            :placeholder="t('customer.keywordPlaceholder')"
            allow-clear
            style="width: 220px"
            @press-enter="onSearch"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" data-test="customer-search" @click="onSearch">{{ t('common.search') }}</a-button>
            <a-button @click="onReset">{{ t('common.reset') }}</a-button>
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
