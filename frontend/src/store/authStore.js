import { create } from 'zustand';
import api from '../services/api';

const getStoredToken = () => {
  const t = localStorage.getItem('crm_token');
  if (!t || t === 'undefined' || t === 'null') return null;
  return t;
};

const getStoredAdmin = () => {
  try {
    const a = localStorage.getItem('crm_admin');
    if (!a || a === 'undefined' || a === 'null') return null;
    return JSON.parse(a);
  } catch {
    return null;
  }
};

const useAuthStore = create((set) => ({
  admin: getStoredAdmin(),
  token: getStoredToken(),
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
