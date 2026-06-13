<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useAuthStore } from '@/store/auth';
import type { MenuVO } from '@/types/api';
import type { ItemType } from 'ant-design-vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

function toItems(nodes: MenuVO[]): ItemType[] {
  return nodes
    .filter((n) => n.type !== 3 && n.visible === 1 && n.status === 1)
    .map((n) => {
      const children = n.children?.length ? toItems(n.children) : undefined;
      return {
        key: n.routePath || `menu_${n.id}`,
        label: n.name,
        icon: n.icon ? () => h(Icon, { icon: n.icon as string }) : undefined,
        children: children && children.length ? children : undefined,
      } as ItemType;
    });
}

const menuItems = computed(() => toItems(auth.menus));
const selectedKeys = ref<string[]>([route.path]);
watch(() => route.path, (p) => (selectedKeys.value = [p]));

function onMenuClick({ key }: { key: string | number }) {
  const k = String(key);
  if (k.startsWith('/')) router.push(k);
}

async function onLogout() {
  await auth.logout();
  router.replace('/login');
}
</script>

<template>
  <a-layout class="h-screen">
    <a-layout-sider theme="dark" collapsible>
      <div class="h-12 flex items-center justify-center text-white font-bold">ZokoMart</div>
      <a-menu
        theme="dark"
        mode="inline"
        :items="menuItems"
        :selected-keys="selectedKeys"
        @click="onMenuClick"
      />
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="bg-white px-4 flex items-center justify-end">
        <a-dropdown>
          <span class="cursor-pointer">{{ auth.user?.nickname || auth.user?.username }}</span>
          <template #overlay>
            <a-menu>
              <a-menu-item key="logout" @click="onLogout">退出登录</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-layout-header>
      <a-layout-content class="p-4 overflow-auto">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
