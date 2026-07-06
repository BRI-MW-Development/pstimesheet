import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ username, password }) => {
      // Fetch geo from the browser — it sees the real public IP, the server sees a private/NAT IP
      let city, country;
      try {
        const geo = await fetch('https://ip-api.com/json/?fields=city,country,status', { signal: AbortSignal.timeout(3000) })
          .then((r) => r.json());
        if (geo?.status === 'success') { city = geo.city; country = geo.country; }
      } catch { /* non-critical — login still works without location */ }

      const loginRes = await api.post('/auth/login', { username, password, city, country }).then((r) => r.data);
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
