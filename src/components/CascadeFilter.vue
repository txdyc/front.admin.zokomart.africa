<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SelectOption } from '@/components/SchemaForm.vue';
import { apiSupplierPage } from '@/api/basedata/supplier';
import { apiSupplierBrands, apiSupplierCategories } from '@/api/product/supplierProduct';
import type { SupplierProductQuery } from '@/types/product';
import type { CategoryVO } from '@/types/basedata';
import type { Id } from '@/types/api';

const props = withDefaults(
  defineProps<{ modelValue?: SupplierProductQuery }>(),
  { modelValue: () => ({}) },
);
const emit = defineEmits<{
  (e: 'update:modelValue', v: SupplierProductQuery): void;
  (e: 'change', v: SupplierProductQuery): void;
}>();

const { t } = useI18n();

const model = reactive<SupplierProductQuery>({ ...props.modelValue });

const statusOptions = computed(() => [
  { label: t('common.enabled'), value: 1 },
  { label: t('common.disabled'), value: 0 },
]);

const supplierOptions = ref<SelectOption[]>([]);
const brandOptions = ref<SelectOption[]>([]);
const categoryOptions = ref<SelectOption[]>([]);

async function loadSuppliers() {
  const page = await apiSupplierPage({ status: 1, current: 1, size: 1000 });
  supplierOptions.value = page.records.map((s) => ({ label: s.name, value: s.id }));
}
onMounted(loadSuppliers);

function flattenCategories(nodes: CategoryVO[], depth: number, acc: SelectOption[]) {
  nodes.forEach((n) => {
    acc.push({ label: `${'　'.repeat(depth)}${n.name}`, value: n.id });
    if (n.children?.length) flattenCategories(n.children, depth + 1, acc);
  });
}

async function loadSupplierScopedOptions(supplierId: Id) {
  const [brands, categories] = await Promise.all([
    apiSupplierBrands(supplierId),
    apiSupplierCategories(supplierId),
  ]);
  brandOptions.value = brands.map((b) => ({ label: b.name, value: b.id }));
  const cats: SelectOption[] = [];
  flattenCategories(categories, 0, cats);
  categoryOptions.value = cats;
}

function emitChange() {
  const snapshot = { ...model };
  emit('update:modelValue', snapshot);
  emit('change', snapshot);
}

// 切换供应商：清空下游品牌/分类选择与选项，按新供应商重载选项
async function onSupplierChange() {
  model.brandId = undefined;
  model.categoryId = undefined;
  brandOptions.value = [];
  categoryOptions.value = [];
  if (model.supplierId != null) {
    await loadSupplierScopedOptions(model.supplierId);
  }
  emitChange();
}

defineExpose({ onSupplierChange, loadSupplierScopedOptions });
</script>

<template>
  <a-form layout="inline">
    <a-form-item :label="t('cascade.supplier')">
      <a-select
        v-model:value="model.supplierId"
        :placeholder="t('cascade.selectSupplier')"
        show-search
        option-filter-prop="label"
        allow-clear
        style="width: 220px"
        :options="supplierOptions"
        data-test="cascade-supplier"
        @change="onSupplierChange"
      />
    </a-form-item>
    <a-form-item :label="t('cascade.brand')">
      <a-select
        v-model:value="model.brandId"
        :placeholder="t('common.all')"
        allow-clear
        style="width: 180px"
        :disabled="model.supplierId == null"
        :options="brandOptions"
        data-test="cascade-brand"
        @change="emitChange"
      />
    </a-form-item>
    <a-form-item :label="t('cascade.category')">
      <a-select
        v-model:value="model.categoryId"
        :placeholder="t('common.all')"
        allow-clear
        style="width: 200px"
        :disabled="model.supplierId == null"
        :options="categoryOptions"
        data-test="cascade-category"
        @change="emitChange"
      />
    </a-form-item>
    <a-form-item :label="t('cascade.keyword')">
      <a-input
        v-model:value="model.keyword"
        :placeholder="t('cascade.keywordPlaceholder')"
        allow-clear
        @press-enter="emitChange"
      />
    </a-form-item>
    <a-form-item :label="t('common.status')">
      <a-select
        v-model:value="model.status"
        :placeholder="t('common.all')"
        allow-clear
        style="width: 120px"
        :options="statusOptions"
        @change="emitChange"
      />
    </a-form-item>
    <a-form-item>
      <a-button type="primary" data-test="cascade-search" @click="emitChange">{{ t('common.search') }}</a-button>
    </a-form-item>
  </a-form>
</template>
