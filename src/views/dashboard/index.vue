<script setup lang="ts">
import { useAuthStore } from '@/store/auth';
import { useI18n } from 'vue-i18n';
const auth = useAuthStore();
const { t } = useI18n();
</script>

<template>
  <a-card :title="t('dashboard.title')">
    <p>{{ t('dashboard.welcome', { name: auth.user?.nickname || auth.user?.username }) }}</p>
    <p class="text-gray-500">{{ t('dashboard.subtitle') }}</p>
  </a-card>
</template>
