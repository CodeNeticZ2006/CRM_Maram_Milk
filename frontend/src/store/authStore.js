import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set) => ({
  admin: JSON.parse(localStorage.getItem('crm_admin') || 'null'),
  token: localStorage.getItem('crm_token') || null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, admin } = res.data;
      localStorage.setItem('crm_token', token);
      localStorage.setItem('crm_admin', JSON.stringify(admin));
      set({ token, admin, loading: false });
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      set({ loading: false, error: msg });
      return { success: false, message: msg };
    }
  },

  logout: () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_admin');
    set({ token: null, admin: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
