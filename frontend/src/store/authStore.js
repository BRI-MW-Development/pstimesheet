import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      permissions: [],
      dataScope: 'All',
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      setPermissions: (permissions, dataScope) => set({ permissions, dataScope }),
      logout: () => set({ token: null, user: null, permissions: [], dataScope: 'All' }),
    }),
    { name: 'ps_auth' }
  )
);
