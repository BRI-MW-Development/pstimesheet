import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Tab-isolated storage: impersonation tabs only write to sessionStorage,
// so they never pollute the admin's localStorage session in the original tab.
const tabIsolatedStorage = {
  getItem: (name) => {
    // Prefer sessionStorage (tab-specific) — an impersonation tab writes here.
    const session = sessionStorage.getItem(name);
    if (session) return session;
    return localStorage.getItem(name);
  },
  setItem: (name, value) => {
    sessionStorage.setItem(name, value);
    // Only write to localStorage for non-impersonation tabs.
    if (sessionStorage.getItem('ps_impersonation_tab') !== '1') {
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name) => {
    sessionStorage.removeItem(name);
    if (sessionStorage.getItem('ps_impersonation_tab') !== '1') {
      localStorage.removeItem(name);
    }
  },
};

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
      clearMustChangePassword: () => set((s) => ({ user: s.user ? { ...s.user, mustChangePassword: false } : s.user })),
      logout: () => set({ token: null, user: null, permissions: [], dataScope: 'All' }),
    }),
    { name: 'ps_auth', storage: createJSONStorage(() => tabIsolatedStorage) }
  )
);
