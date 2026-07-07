<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = reactive({ username: '', password: '' });
const loading = ref(false);

async function onSubmit() {
  if (!form.username || !form.password) return;
  loading.value = true;
  try {
    await auth.login(form.username, form.password);
    const redirect = (route.query.redirect as string) || '/';
    router.replace(redirect);
  } catch {
    /* 错误已由 request 拦截器提示 */
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="h-screen flex items-center justify-center bg-gray-100">
    <a-card :title="t('login.title')" class="w-96">
      <a-form layout="vertical">
        <a-form-item :label="t('login.username')">
          <a-input v-model:value="form.username" :placeholder="t('login.usernamePlaceholder')" @press-enter="onSubmit" />
        </a-form-item>
        <a-form-item :label="t('login.password')">
          <a-input-password v-model:value="form.password" :placeholder="t('login.passwordPlaceholder')" @press-enter="onSubmit" />
        </a-form-item>
        <a-button type="primary" block :loading="loading" @click="onSubmit">{{ t('login.submit') }}</a-button>
      </a-form>
    </a-card>
  </div>
</template>
