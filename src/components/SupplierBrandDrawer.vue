<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { apiBrandPage } from '@/api/basedata/brand';
import { apiAuthorizedBrands, apiAssignBrands } from '@/api/basedata/supplierBrand';
import type { Id } from '@/types/api';

const props = defineProps<{ supplierId: Id | null; open: boolean }>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'saved'): void }>();

const { t } = useI18n();

interface Item {
  key: string;
  title: string;
}
const dataSource = ref<Item[]>([]);
const targetKeys = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);

async function load() {
  if (!props.supplierId) return;
  loading.value = true;
  try {
    const [brands, authorized] = await Promise.all([
      apiBrandPage({ status: 1, size: 1000, current: 1 }),
      apiAuthorizedBrands(props.supplierId),
    ]);
    dataSource.value = brands.records.map((b) => ({ key: String(b.id), title: b.name }));
    targetKeys.value = authorized.map((a) => String(a.brandId));
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) load();
  },
);

function onChange(keys: string[]) {
  targetKeys.value = keys;
}

async function onSave() {
  if (!props.supplierId) return;
  saving.value = true;
  try {
    await apiAssignBrands(props.supplierId, targetKeys.value);
    message.success(t('supplierBrand.saved'));
    emit('saved');
    emit('update:open', false);
  } finally {
    saving.value = false;
  }
}

function onClose() {
  emit('update:open', false);
}

defineExpose({ load, onSave, targetKeys, dataSource });
</script>

<template>
  <a-drawer :open="open" :title="t('supplierBrand.title')" :width="520" @close="onClose">
    <a-spin :spinning="loading">
      <a-transfer
        :data-source="dataSource"
        :target-keys="targetKeys"
        :titles="[t('supplierBrand.allBrands'), t('supplierBrand.authorized')]"
        :render="(item: any) => item.title"
        :list-style="{ width: '220px', height: '420px' }"
        @change="onChange"
      />
    </a-spin>
    <template #footer>
      <a-space>
        <a-button @click="onClose">{{ t('common.cancel') }}</a-button>
        <a-button type="primary" :loading="saving" @click="onSave">{{ t('common.save') }}</a-button>
      </a-space>
    </template>
  </a-drawer>
</template>
