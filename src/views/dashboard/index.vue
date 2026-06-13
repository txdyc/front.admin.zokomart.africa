<script setup lang="ts">
import { useAuthStore } from '@/store/auth';
const auth = useAuthStore();
</script>

<template>
  <a-card title="工作台">
    <p>欢迎，{{ auth.user?.nickname || auth.user?.username }}。</p>
    <p class="text-gray-500">ZokoMart 独立站后台管理系统。</p>
  </a-card>
</template>
