import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ username, password }) => {
      const loginRes = await api.post('/auth/login', { username, password }).then((r) => r.data);
      // Fetch permissions immediately after login using the token we just got
      const permsRes = await api
        .get('/auth/permissions', {
          headers: { Authorization: `Bearer ${loginRes.token}` },
        })
        .then((r) => r.data);
      return { ...loginRes, permissions: permsRes.permissions ?? [], dataScope: permsRes.dataScope ?? 'All' };
    },
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      setPermissions(data.permissions, data.dataScope);
      queryClient.clear();
    },
  });
}

export function useLogout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  return () => {
    if (token) api.post('/auth/logout').catch(() => {});
    logout();
    queryClient.clear();
    window.location.href = '/login';
  };
}
