import api from './axios';

const ORG_USERS_ALLOWED_ROLES = new Set(['superadmin', 'administrator', 'admin', 'systemadmin', 'projectmanager']);

function normalizeClientRole(value) {
  return String(value || '').trim().toLowerCase();
}

function getClientRole() {
  const roleFromStorage = normalizeClientRole(localStorage.getItem('onboarding_role') || localStorage.getItem('role'));
  return roleFromStorage || '';
}

function canReadOrgUsersOnClient() {
  const role = getClientRole();
  if (!role) return true;
  return ORG_USERS_ALLOWED_ROLES.has(role);
}

export const authAPI = {
  login: async (username, password) => {
    const identity = String(username || '').trim();
    const secret = String(password || '');
    const payloads = [
      { username: identity, password: secret },
      { login: identity, password: secret },
      { email: identity, password: secret },
    ];

    let lastError = null;
    for (const payload of payloads) {
      try {
        return await api.post('/v1/accounts/login/', payload, { skipAuth: true });
      } catch (err) {
        lastError = err;
        const status = Number(err?.response?.status || 0);
        if (status && status !== 400 && status !== 401 && status !== 422) {
          throw err;
        }
      }
    }
    throw lastError;
  },

  getMe: (config) =>
    api.get('/auth/me/', config),

  logout: () => Promise.resolve({ data: { detail: 'logout handled on client' } }),

  getMe: () => api.get('/v1/accounts/me/profile/'),

  updateMe: (data) => api.patch('/v1/accounts/me/profile/', data),
};

export const usersAPI = {
  list: (params) => {
    if (!canReadOrgUsersOnClient()) {
      return Promise.resolve({ data: [] });
    }
    return api.get('/v1/accounts/org/users/', { params });
  },
  create: (data) => api.post('/v1/accounts/org/users/', data),
  update: (id, data) => api.patch(`/v1/accounts/org/users/${id}/`, data),
  delete: (id) => api.delete(`/v1/accounts/org/users/${id}/`),
  toggleStatus: (id) => api.post(`/v1/accounts/org/users/${id}/toggle-status/`),
  setRole: (id, role) => api.post(`/v1/accounts/org/users/${id}/set-role/`, { role }),
  myTeam: () => api.get('/v1/accounts/me/team/'),
};

export const orgAPI = {
  structure: (params) => api.get('/v1/accounts/org/structure/', { params }),
};

export const departmentsAPI = {
  list: () => api.get('/v1/accounts/org/departments/'),
  create: (data) => api.post('/v1/accounts/org/departments/', data),
  update: async (id, data) => {
    try {
      return await api.patch(`/v1/accounts/org/departments/${id}/`, data);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.patch(`/v1/auth/departments/${id}/`, data);
      }
      throw err;
    }
  },
  delete: (id) => api.delete(`/v1/accounts/org/departments/${id}/`),
};

export const subdivisionsAPI = {
  create: async (data) => {
    try {
      return await api.post('/v1/accounts/org/subdivisions/', data);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.post('/v1/auth/subdivisions/', data);
      }
      throw err;
    }
  },
};

export const positionsAPI = {
  list: (params) => api.get('/v1/accounts/org/positions/', { params }),
  create: (data) => api.post('/v1/accounts/org/positions/', data),
  delete: (id) => api.delete(`/v1/accounts/org/positions/${id}/`),
};

export const promotionRequestsAPI = {
  list: (params) => api.get('/v1/accounts/promotion-requests/', { params }),
  create: (data) => api.post('/v1/accounts/promotion-requests/', data),
  approve: (id, data) => api.post(`/v1/accounts/promotion-requests/${id}/approve/`, data),
  reject: (id, data) => api.post(`/v1/accounts/promotion-requests/${id}/reject/`, data),
};
