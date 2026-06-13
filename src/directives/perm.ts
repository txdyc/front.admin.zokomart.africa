import type { Directive } from 'vue';
import { useAuthStore } from '@/store/auth';

// 用法：<a-button v-perm="'brand:create'">新增</a-button>
// 无权限则从 DOM 移除该元素。超管 / 含 "*" 时恒保留。
export const perm: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    const auth = useAuthStore();
    if (!auth.hasPerm(binding.value)) {
      el.parentNode?.removeChild(el);
    }
  },
};
