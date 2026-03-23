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
    return api.post(
      '/v1/accounts/login/',
      { username: identity, password: secret },
      { skipAuth: true }
    );
  },

  refresh: (refresh) =>
    api.post('/auth/token/refresh/', { refresh }, { _silent: true }),

  logout: (refresh) =>
    api.post('/v1/accounts/logout/', refresh ? { refresh } : {}),

  getMe: () => api.get('/v1/auth/me/'),

  updateMe: (data) => api.patch('/v1/auth/me/', data),

  changePassword: (data) => api.post('/v1/accounts/me/profile/password/', data),

  requestPasswordReset: (username_or_email) =>
    api.post('/v1/accounts/password-reset/request/', { username_or_email }, { skipAuth: true }),

  confirmPasswordReset: (token, new_password) =>
    api.post('/v1/accounts/password-reset/confirm/', { token, new_password }, { skipAuth: true }),
};

export const usersAPI = {
  list: async (params) => {
    if (!canReadOrgUsersOnClient()) {
      return Promise.resolve({ data: [] });
    }
    try {
      return await api.get('/v1/accounts/org/users/', { params });
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.get('/v1/auth/users/', { params });
      }
      throw err;
    }
  },
  create: async (data) => {
    try {
      return await api.post('/v1/accounts/org/users/', data);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.post('/v1/auth/users/', data);
      }
      throw err;
    }
  },
  update: async (id, data) => {
    try {
      return await api.patch(`/v1/accounts/org/users/${id}/`, data);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.patch(`/v1/auth/users/${id}/`, data);
      }
      throw err;
    }
  },
  delete: async (id) => {
    try {
      return await api.delete(`/v1/accounts/org/users/${id}/`);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.delete(`/v1/auth/users/${id}/`);
      }
      throw err;
    }
  },
  toggleStatus: async (id) => {
    try {
      return await api.post(`/v1/accounts/org/users/${id}/toggle-status/`);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.post(`/v1/auth/users/${id}/toggle_status/`);
      }
      throw err;
    }
  },
  setRole: async (id, role) => {
    try {
      return await api.post(`/v1/accounts/org/users/${id}/set-role/`, { role });
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.post(`/v1/auth/users/${id}/set_role/`, { role });
      }
      throw err;
    }
  },
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
  transferUsers: (id, data) => api.post(`/v1/accounts/org/departments/${id}/transfer-users/`, data),
};

export const subdivisionsAPI = {
  list: async (params) => {
    try {
      return await api.get('/v1/accounts/org/subdivisions/', { params });
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.get('/v1/auth/subdivisions/', { params });
      }
      throw err;
    }
  },
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
  update: async (id, data) => {
    try {
      return await api.patch(`/v1/accounts/org/subdivisions/${id}/`, data);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.patch(`/v1/auth/subdivisions/${id}/`, data);
      }
      throw err;
    }
  },
  delete: (id) => api.delete(`/v1/accounts/org/subdivisions/${id}/`),
};

export const positionsAPI = {
  list: (params) => api.get('/v1/accounts/org/positions/', { params }),
  create: (data) => api.post('/v1/accounts/org/positions/', data),
  delete: (id) => api.delete(`/v1/accounts/org/positions/${id}/`),
};

export const rolesAPI = {
  list: () => api.get('/v1/accounts/org/roles/'),
  create: (data) => api.post('/v1/accounts/org/roles/', data),
  update: (id, data) => api.patch(`/v1/accounts/org/roles/${id}/`, data),
  delete: (id) => api.delete(`/v1/accounts/org/roles/${id}/`),
};

export const promotionRequestsAPI = {
  list: (params) => api.get('/v1/accounts/promotion-requests/', { params }),
  create: (data) => api.post('/v1/accounts/promotion-requests/', data),
  approve: (id, data) => api.post(`/v1/accounts/promotion-requests/${id}/approve/`, data),
  reject: (id, data) => api.post(`/v1/accounts/promotion-requests/${id}/reject/`, data),
};

export const exitInterviewsAPI = {
  getByToken: (token) => api.get(`/exit-interviews/${token}/`),
  submitByToken: (token, data) => api.post(`/exit-interviews/${token}/`, data),
};

export const securityAPI = {
  unlockUsers: async (data = { all: true }) => {
    try {
      return await api.post('/v1/security/unlock-users/', data);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.post('/security/unlock-users/', data);
      }
      throw err;
    }
  },
  forceLogoutAll: async () => {
    try {
      return await api.post('/v1/security/force-logout/', {});
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.post('/security/force-logout/', {});
      }
      throw err;
    }
  },
};

export const orgStructureAPI = {
  list: (params) => api.get('/auth/org-units/', { params }),
  tree: () => api.get('/auth/org-units/tree/'),
  create: (data) => api.post('/auth/org-units/', data),
  update: (id, data) => api.patch(`/auth/org-units/${id}/`, data),
  delete: (id) => api.delete(`/auth/org-units/${id}/`),
  seedLargeDemo: () => api.post('/auth/org-units/seed_large_demo/'),
};
