<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { UploadProps } from 'ant-design-vue';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons-vue';
import { apiUploadImage } from '@/api/file';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    value?: string;
    category?: string;
    maxSize?: number; // MB
    accept?: string;
  }>(),
  { value: '', category: 'common', maxSize: 2, accept: 'image/*' },
);
const emit = defineEmits<{ (e: 'update:value', v: string): void }>();

const loading = ref(false);
const previewUrl = computed(() => props.value || '');

const beforeUpload = (file: File): boolean => {
  if (!file.type.startsWith('image/')) {
    message.error(t('common.uploadImageOnly'));
    return false;
  }
  if (file.size / 1024 / 1024 > props.maxSize) {
    message.error(t('common.uploadTooLarge', { size: props.maxSize }));
    return false;
  }
  return true;
};

const customRequest: UploadProps['customRequest'] = async (opt) => {
  loading.value = true;
  try {
    const res = await apiUploadImage(opt.file as File, props.category);
    emit('update:value', res.url);
    opt.onSuccess?.(res, undefined as never);
  } catch (e) {
    message.error(t('common.uploadFailed'));
    opt.onError?.(e as Error);
  } finally {
    loading.value = false;
  }
};

const clear = () => emit('update:value', '');

defineExpose({ beforeUpload, customRequest, clear });
</script>

<template>
  <div class="image-upload">
    <a-upload
      list-type="picture-card"
      :show-upload-list="false"
      :accept="accept"
      :before-upload="beforeUpload"
      :custom-request="customRequest"
    >
      <img v-if="previewUrl" :src="previewUrl" alt="logo" class="preview-img" />
      <div v-else class="placeholder">
        <loading-outlined v-if="loading" />
        <plus-outlined v-else />
        <div class="mt-1 text-xs">{{ t('common.upload') }}</div>
      </div>
    </a-upload>
    <a v-if="previewUrl" class="text-xs text-red-500" @click.stop="clear">{{ t('common.remove') }}</a>
  </div>
</template>

<style scoped>
.preview-img {
  width: 86px;
  height: 86px;
  object-fit: contain;
}
.placeholder {
  color: rgba(0, 0, 0, 0.45);
}
</style>
