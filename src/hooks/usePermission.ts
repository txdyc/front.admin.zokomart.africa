import { useAuthStore } from '@/store/auth';

export function usePermission() {
  const auth = useAuthStore();
  return {
    hasPerm: (code: string) => auth.hasPerm(code),
  };
}
