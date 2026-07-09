<script setup lang="ts">
import { antdLocale } from '@/locales';
</script>

<template>
  <a-config-provider :locale="antdLocale">
    <router-view />
  </a-config-provider>
</template>
