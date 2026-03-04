import axios from 'axios';
import { dispatchToast } from '../context/ToastContext';
import { Sentry } from '../utils/sentry.js';
import { getStoredLocale } from '../context/LocaleContext';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const CSRF_METHODS = ['post', 'put', 'patch', 'delete'];

const ERROR_I18N = {
  ru: {
    network: 'Нет соединения с сервером',
    unknown: 'Произошла ошибка',
    validation_error: 'Ошибка валидации',
    unauthorized: 'Требуется авторизация',
    forbidden: 'Нет доступа',
    not_found: 'Ресурс не найден',
    conflict: 'Конфликт данных',
    too_many_requests: 'Слишком много запросов, попробуйте позже',
    server_error: 'Ошибка сервера',
    service_unavailable: 'Сервис временно недоступен',
    bad_request: 'Некорректный запрос',
  },
  en: {
    network: 'Network error',
    unknown: 'Unexpected error',
    validation_error: 'Validation error',
    unauthorized: 'Authorization required',
    forbidden: 'Access denied',
    not_found: 'Resource not found',
    conflict: 'Data conflict',
    too_many_requests: 'Too many requests, try again later',
    server_error: 'Server error',
    service_unavailable: 'Service temporarily unavailable',
    bad_request: 'Bad request',
  },
  kg: {
    network: 'Сервер менен байланыш жок',
    unknown: 'Ката кетти',
    validation_error: 'Текшерүү катасы',
    unauthorized: 'Авторизация талап кылынат',
    forbidden: 'Кирүүгө уруксат жок',
    not_found: 'Ресурс табылган жок',
    conflict: 'Маалыматтар конфликтинде',
    too_many_requests: 'Сурам өтө көп, кийин кайра аракет кылыңыз',
    server_error: 'Сервер катасы',
    service_unavailable: 'Сервис убактылуу жеткиликсиз',
    bad_request: 'Туура эмес сурам',
  },
};

function trError(key) {
  const locale = getStoredLocale();
  const dict = ERROR_I18N[locale] || ERROR_I18N.ru;
  return dict[key] || ERROR_I18N.ru[key] || key;
}

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const chunks = document.cookie ? document.cookie.split(';') : [];
  for (let i = 0; i < chunks.length; i += 1) {
    const part = chunks[i].trim();
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

function mapStatusToCode(status) {
  switch (status) {
    case 400: return 'bad_request';
    case 401: return 'unauthorized';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 409: return 'conflict';
    case 422: return 'validation_error';
    case 429: return 'too_many_requests';
    case 500:
    case 502:
      return 'server_error';
    case 503:
      return 'service_unavailable';
    default:
      return 'unknown';
  }
}

function fromValidationObject(data) {
  if (!data || typeof data !== 'object') return '';
  const keys = Object.keys(data).filter((k) => k !== 'code' && k !== 'detail' && k !== 'message');
  if (!keys.length) return '';
  const key = keys[0];
  const val = data[key];
  if (Array.isArray(val) && val.length) return `${key}: ${val[0]}`;
  if (typeof val === 'string') return `${key}: ${val}`;
  return '';
}

function getErrorMessage(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;

  if (!error?.response) {
    return trError('network');
  }

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    const fieldError = fromValidationObject(data);
    if (fieldError) return fieldError;

    const code = String(data.code || '').trim().toLowerCase();
    if (code) {
      return trError(code);
    }
  }

  return trError(mapStatusToCode(status));
}

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = getStoredLocale();

  if (CSRF_METHODS.includes(String(config.method || '').toLowerCase())) {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) config.headers['X-CSRFToken'] = csrfToken;
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
    const status = error.response?.status;
    const silent = Boolean(original?._silent);

    if (status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
          localStorage.setItem('access_token', data.access);
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }

      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (status >= 500) {
      Sentry.captureException(error, {
        extra: {
          url: original?.url,
          method: original?.method,
          status,
          response: error.response?.data,
        },
      });
    }

    if (!silent && status !== 401) {
      dispatchToast(getErrorMessage(error), 'error');
    }

    return Promise.reject(error);
  }
);

export default api;
