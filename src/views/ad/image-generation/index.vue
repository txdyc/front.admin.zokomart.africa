<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { UploadProps } from 'ant-design-vue';
import { PlusOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons-vue';
import { apiUploadImage } from '@/api/file';
import { apiSupplierPage } from '@/api/basedata/supplier';
import { apiSupplierProductPage } from '@/api/product/supplierProduct';
import {
  apiAdModelEnabled, apiAdGenerate, apiAdKeep, apiAdDiscard, apiAdImageList, apiAdImageDelete,
} from '@/api/ad';
import type { AdAiModelVO, AdProductImageVO } from '@/types/ad';
import type { Id } from '@/types/api';

const { t } = useI18n();

// ---- 顶部表单 ----
const suppliers = ref<{ label: string; value: Id }[]>([]);
const products = ref<{ label: string; value: Id }[]>([]);
const models = ref<AdAiModelVO[]>([]);
const selectedSupplierId = ref<Id>();
const selectedProductId = ref<Id>();
const form = reactive<{ modelId?: Id; prompt: string; count: number }>({ prompt: '', count: 1 });
const refImages = ref<string[]>([]);   // 参考图公开相对路径
const uploading = ref(false);

onMounted(async () => {
  const [sup, mods] = await Promise.all([
    apiSupplierPage({ status: 1, current: 1, size: 1000 }),
    apiAdModelEnabled(),
  ]);
  suppliers.value = sup.records.map((s: any) => ({ label: s.name, value: s.id }));
  models.value = mods;
});

async function onSupplierChange() {
  selectedProductId.value = undefined;
  products.value = [];
  keptImages.value = [];
  if (selectedSupplierId.value == null) return;
  const page = await apiSupplierProductPage({
    supplierId: selectedSupplierId.value, current: 1, size: 1000,
  } as any);
  products.value = page.records.map((p: any) => ({ label: `${p.name} (${p.productCode})`, value: p.id }));
}

async function onProductChange() {
  await loadKept();
}

const beforeUpload = (file: File): boolean => {
  if (!file.type.startsWith('image/')) {
    message.error(t('common.uploadImageOnly'));
    return false;
  }
  return true;
};
const customRequest: UploadProps['customRequest'] = async (opt) => {
  uploading.value = true;
  try {
    const res = await apiUploadImage(opt.file as File, 'ad-source');
    refImages.value.push(res.url);
    opt.onSuccess?.(res, undefined as never);
  } catch (e) {
    message.error(t('common.uploadFailed'));
    opt.onError?.(e as Error);
  } finally {
    uploading.value = false;
  }
};
const removeRef = (url: string) => (refImages.value = refImages.value.filter((u) => u !== url));

// ---- 生成与结果 ----
interface ResultItem { tempUrl: string; prompt: string; modelId?: Id; busy?: boolean }
const results = ref<ResultItem[]>([]);
const generating = ref(false);
const lastErrors = ref<string[]>([]);

async function onGenerate() {
  if (!form.modelId) return message.warning(t('ad.gen.selectModel'));
  if (!form.prompt.trim()) return message.warning(t('ad.gen.promptPlaceholder'));
  generating.value = true;
  lastErrors.value = [];
  try {
    const vo = await apiAdGenerate({
      modelId: form.modelId, prompt: form.prompt, sourceImageUrls: [...refImages.value], count: form.count,
    });
    results.value.push(...vo.tempUrls.map((u) => ({ tempUrl: u, prompt: form.prompt, modelId: form.modelId })));
    lastErrors.value = vo.errors ?? [];
  } finally {
    generating.value = false;
  }
}

async function onKeep(item: ResultItem) {
  if (selectedProductId.value == null) {
    message.warning(t('ad.gen.keepNeedProduct'));
    return;
  }
  item.busy = true;
  try {
    await apiAdKeep({
      supplierProductId: selectedProductId.value,
      items: [{ tempUrl: item.tempUrl, prompt: item.prompt, modelId: item.modelId }],
    });
    results.value = results.value.filter((r) => r !== item);
    await loadKept();
    message.success(t('common.saveSuccess'));
  } finally {
    item.busy = false;
  }
}

async function onDiscard(item: ResultItem) {
  item.busy = true;
  try {
    await apiAdDiscard([item.tempUrl]);
    results.value = results.value.filter((r) => r !== item);
  } finally {
    item.busy = false;
  }
}

// 离开页面：静默丢弃未处理的临时图（失败不打扰，后端定时清理兜底）
onBeforeUnmount(() => {
  const rest = results.value.map((r) => r.tempUrl);
  if (rest.length) apiAdDiscard(rest).catch(() => undefined);
});

// ---- 缩略图墙 ----
const keptImages = ref<AdProductImageVO[]>([]);
async function loadKept() {
  keptImages.value = selectedProductId.value == null ? [] : await apiAdImageList(selectedProductId.value);
}
async function onDeleteKept(row: Pick<AdProductImageVO, 'id'>) {
  await apiAdImageDelete(row.id);
  message.success(t('common.deleteSuccess'));
  await loadKept();
}

defineExpose({ form, results, selectedSupplierId, selectedProductId, keptImages, onGenerate, onKeep, onDiscard, onDeleteKept, onSupplierChange, onProductChange, beforeUpload, customRequest, removeRef });
</script>

<template>
  <div>
    <a-card :bordered="false" class="mb-3">
      <a-form layout="vertical">
        <div class="flex flex-wrap gap-4">
          <a-form-item :label="t('cascade.supplier')" style="min-width: 220px">
            <a-select
              v-model:value="selectedSupplierId" :options="suppliers" show-search option-filter-prop="label"
              allow-clear :placeholder="t('ad.gen.selectSupplier')" data-test="gen-supplier" @change="onSupplierChange"
            />
          </a-form-item>
          <a-form-item :label="t('ad.gen.product')" style="min-width: 280px">
            <a-select
              v-model:value="selectedProductId" :options="products" show-search option-filter-prop="label"
              allow-clear :disabled="selectedSupplierId == null" :placeholder="t('ad.gen.selectProduct')"
              data-test="gen-product" @change="onProductChange"
            />
          </a-form-item>
          <a-form-item :label="t('ad.gen.model')" style="min-width: 200px">
            <a-select
              v-model:value="form.modelId" :placeholder="t('ad.gen.selectModel')" data-test="gen-model"
              :options="models.map((m) => ({ label: m.name, value: m.id }))"
            />
          </a-form-item>
          <a-form-item :label="t('ad.gen.count')" style="width: 90px">
            <a-select v-model:value="form.count" :options="[1, 2, 3, 4].map((n) => ({ label: String(n), value: n }))" />
          </a-form-item>
        </div>

        <a-form-item :label="t('ad.gen.refImages')">
          <div class="flex flex-wrap gap-2">
            <div v-for="u in refImages" :key="u" class="ref-thumb">
              <img :src="u" alt="ref" />
              <delete-outlined class="ref-remove" @click="removeRef(u)" />
            </div>
            <a-upload list-type="picture-card" :show-upload-list="false" accept="image/*"
                      :before-upload="beforeUpload" :custom-request="customRequest">
              <div>
                <loading-outlined v-if="uploading" />
                <plus-outlined v-else />
              </div>
            </a-upload>
          </div>
        </a-form-item>

        <a-form-item :label="t('ad.gen.prompt')">
          <a-textarea v-model:value="form.prompt" :rows="3" :placeholder="t('ad.gen.promptPlaceholder')" data-test="gen-prompt" />
        </a-form-item>

        <a-button
          v-perm="'ad:image:generate'" type="primary" :loading="generating" data-test="gen-submit" @click="onGenerate"
        >
          {{ generating ? t('ad.gen.generating') : t('ad.gen.generate') }}
        </a-button>
      </a-form>
    </a-card>

    <a-card v-if="results.length || lastErrors.length" :bordered="false" class="mb-3" :title="t('ad.gen.results')">
      <a-alert v-if="lastErrors.length" type="warning" class="mb-3"
               :message="t('ad.gen.partialErrors')" :description="lastErrors.join('；')" show-icon />
      <div class="flex flex-wrap gap-4">
        <a-card v-for="item in results" :key="item.tempUrl" size="small" style="width: 220px">
          <img :src="item.tempUrl" alt="result" style="width: 100%; object-fit: contain" />
          <div class="mt-2 flex justify-between">
            <a-button
              v-perm="'ad:image:keep'" type="primary" size="small" :loading="item.busy"
              :disabled="selectedProductId == null" data-test="gen-keep" @click="onKeep(item)"
            >
              {{ t('ad.gen.keep') }}
            </a-button>
            <a-button v-perm="'ad:image:keep'" size="small" danger :loading="item.busy" data-test="gen-discard" @click="onDiscard(item)">
              {{ t('ad.gen.discard') }}
            </a-button>
          </div>
        </a-card>
      </div>
    </a-card>

    <a-card v-if="selectedProductId != null" :bordered="false" :title="t('ad.gen.keptImages')">
      <a-empty v-if="!keptImages.length" :description="t('ad.gen.keptEmpty')" />
      <a-image-preview-group v-else>
        <div class="flex flex-wrap gap-3">
          <div v-for="img in keptImages" :key="String(img.id)" class="kept-thumb">
            <a-image :src="img.fileUrl" :width="120" :height="120" style="object-fit: cover" />
            <a-popconfirm :title="t('ad.gen.deleteKeptConfirm')" @confirm="onDeleteKept(img)">
              <delete-outlined v-perm="'ad:image:delete'" class="kept-remove" />
            </a-popconfirm>
          </div>
        </div>
      </a-image-preview-group>
    </a-card>
  </div>
</template>

<style scoped>
.ref-thumb {
  position: relative;
  width: 86px;
  height: 86px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;
}
.ref-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ref-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #ff4d4f;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 4px;
  padding: 2px;
}
.kept-thumb {
  position: relative;
}
.kept-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  color: #ff4d4f;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 4px;
  padding: 2px;
}
</style>
