import axios from 'axios';
import { loginUrlFor } from '../utils/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        await api.post('/auth/refresh');
        return api(original);
      } catch {
        // Sessão expirou de vez: volta ao login lembrando onde a pessoa estava (a menos que já esteja nele).
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = loginUrlFor(window.location.pathname + window.location.search);
        }
      }
    }
    return Promise.reject(error);
  },
);
