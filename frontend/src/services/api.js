import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request Interceptor: Attach Token & Log Clean Outgoing Request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    console.log(`🌐 [API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ [API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response Interceptor: Log Clean Status & Handle 401 Session Expiry
api.interceptors.response.use(
  (res) => {
    console.log(`✅ [API Response] ${res.status} ${res.config.url}`);
    return res;
  },
  (err) => {
    console.error(`⚠️ [API Response Error] ${err.response?.status || 'Network Error'} ${err.config?.url}`);
    const isLoginReq = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginReq) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_admin');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
