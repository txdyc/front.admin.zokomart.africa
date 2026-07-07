<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
const router = useRouter();
const { t } = useI18n();
</script>

<template>
  <a-result status="404" title="404" :sub-title="t('error.notFound')">
    <template #extra>
      <a-button type="primary" @click="router.replace('/')">{{ t('common.backHome') }}</a-button>
    </template>
  </a-result>
</template>
