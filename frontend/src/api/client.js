import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

// Read token directly from the Zustand store in-memory state — no redundant localStorage parse.
api.interceptors.request.use(cfg => {
  const token = useAuthStore.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Single flag prevents multiple concurrent 401 responses from racing to redirect.
let redirecting = false;

api.interceptors.response.use(
  res => res,
  err => {
    // Skip the redirect for the login endpoint itself — a 401 there just means wrong credentials
    // and the login form handles it via onError. Redirecting from /login would cause a reload loop.
    const isLoginEndpoint = err.config?.url === '/auth/login';
    if (err.response?.status === 401 && !redirecting && !isLoginEndpoint) {
      redirecting = true;
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
