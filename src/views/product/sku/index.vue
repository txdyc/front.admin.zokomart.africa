<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import SchemaForm, { type FormField, type SelectOption } from '@/components/SchemaForm.vue';
import { apiSpuPage, apiSpuSkus } from '@/api/product/spu';
import { apiSkuCreate, apiSkuUpdate, apiSkuDelete } from '@/api/product/sku';
import type { ProductSkuVO, ProductSkuSaveDTO } from '@/types/product';
import type { Id } from '@/types/api';

const { t } = useI18n();

const formRef = ref<InstanceType<typeof SchemaForm>>();

// 顶部 SPU 选择器：选定后列出其下 SKU
const spuOptions = ref<SelectOption[]>([]);
const selectedSpuId = ref<Id | undefined>(undefined);
const loading = ref(false);
const skuList = ref<ProductSkuVO[]>([]);

async function loadSpus() {
  const page = await apiSpuPage({ current: 1, size: 1000 });
  spuOptions.value = page.records.map((s) => ({ label: s.name, value: s.id }));
}
onMounted(loadSpus);

async function loadSkus() {
  if (selectedSpuId.value == null) {
    skuList.value = [];
    return;
  }
  loading.value = true;
  try {
    skuList.value = await apiSpuSkus(selectedSpuId.value);
  } finally {
    loading.value = false;
  }
}
function onSpuChange() {
  loadSkus();
}

const columns = computed<TableColumnsType>(() => [
  { title: t('product.sku.image'), dataIndex: 'image', key: 'image', width: 80 },
  { title: t('product.sku.skuCode'), dataIndex: 'skuCode', key: 'skuCode' },
  { title: t('product.sku.spec'), dataIndex: 'spec', key: 'spec' },
  { title: t('product.sku.price'), dataIndex: 'price', key: 'price', width: 120 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 90 },
  { title: t('common.operation'), key: 'action', width: 160 },
]);

const formSchema = computed<FormField[]>(() => [
  { field: 'skuCode', label: t('product.sku.skuCode'), component: 'input', rules: [{ required: true, message: t('product.sku.inputSkuCode') }] },
  { field: 'spec', label: t('product.sku.spec'), component: 'input', placeholder: t('product.sku.specPlaceholder') },
  { field: 'image', label: t('product.sku.imageUrl'), component: 'input', placeholder: t('product.sku.imageUrlPlaceholder') },
  { field: 'price', label: t('product.sku.price'), component: 'number', props: { min: 0, precision: 2 } },
  { field: 'status', label: t('product.sku.onSale'), component: 'switch' },
]);

const modalOpen = ref(false);
const editingId = ref<Id | null>(null);
const formInitial = ref<Record<string, any>>({});
const submitting = ref(false);

function openCreate() {
  editingId.value = null;
  formInitial.value = { status: 1 };
  modalOpen.value = true;
}
function openEdit(row: ProductSkuVO) {
  editingId.value = row.id;
  formInitial.value = {
    skuCode: row.skuCode,
    spec: row.spec,
    image: row.image,
    price: row.price,
    status: row.status,
  };
  modalOpen.value = true;
}

async function onSubmit() {
  if (selectedSpuId.value == null) {
    message.warning(t('product.sku.selectSpuFirst'));
    return;
  }
  if (!(await formRef.value?.validate())) return;
  const payload = { ...formRef.value!.getValues(), spuId: selectedSpuId.value } as ProductSkuSaveDTO;
  submitting.value = true;
  try {
    if (editingId.value) await apiSkuUpdate(editingId.value, payload);
    else await apiSkuCreate(payload);
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    await loadSkus();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: ProductSkuVO) {
  await apiSkuDelete(row.id);
  message.success(t('common.deleteSuccess'));
  await loadSkus();
}

defineExpose({ openCreate, openEdit, onSubmit, onDelete, loadSkus });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="inline">
        <a-form-item :label="t('product.sku.belongsToSpu')">
          <a-select
            v-model:value="selectedSpuId"
            :placeholder="t('product.sku.selectSpu')"
            show-search
            option-filter-prop="label"
            allow-clear
            style="width: 260px"
            :options="spuOptions"
            data-test="sku-spu-select"
            @change="onSpuChange"
          />
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false">
      <div class="mb-3">
        <a-button
          v-perm="'product:sku:create'"
          type="primary"
          data-test="sku-create"
          :disabled="selectedSpuId == null"
          @click="openCreate"
        >
          {{ t('product.sku.create') }}
        </a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="skuList"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'image'">
            <a-image v-if="record.image" :src="record.image" :width="40" />
            <span v-else class="text-gray-400">—</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? t('product.sku.onSale') : t('product.sku.offSale') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'product:sku:update'" @click="openEdit(record as ProductSkuVO)">{{ t('common.edit') }}</a>
              <a-popconfirm :title="t('product.sku.deleteConfirm')" @confirm="onDelete(record as ProductSkuVO)">
                <a v-perm="'product:sku:delete'" class="text-red-500">{{ t('common.delete') }}</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('product.sku.edit') : t('product.sku.create')"
      :confirm-loading="submitting"
      destroy-on-close
      @ok="onSubmit"
    >
      <SchemaForm ref="formRef" :schema="formSchema" :initial="formInitial" />
    </a-modal>
  </div>
</template>
