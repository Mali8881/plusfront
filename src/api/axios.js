import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const REFRESH_PATH = '/v1/auth/refresh/';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise = null;
let redirectingToLogin = false;

api.interceptors.request.use((config) => {
  const skipAuth = Boolean(config?.skipAuth);
  if (!skipAuth) {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    // Let browser set multipart boundary automatically.
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const requestUrl = String(original.url || '');
    const isLoginRequest = requestUrl.includes('/v1/accounts/login/');
    const isRefreshRequest = requestUrl.includes(REFRESH_PATH);

    if (error.response?.status === 401 && !original._retry && !isLoginRequest && !isRefreshRequest) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (!refresh) return Promise.reject(error);

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${BASE_URL}${REFRESH_PATH}`, { refresh })
            .then(({ data }) => {
              const accessToken = data.access || data.access_token;
              if (!accessToken) throw new Error('No access token in refresh response');
              localStorage.setItem('access_token', accessToken);
              localStorage.setItem('onboarding_access_token', accessToken);
              return accessToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const accessToken = await refreshPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('onboarding_access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('onboarding_role');
        localStorage.removeItem('onboarding_landing');
        if (!redirectingToLogin) {
          redirectingToLogin = true;
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
