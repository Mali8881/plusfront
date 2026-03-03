import api from './axios';

async function requestWithFallback(requests) {
  let lastError;
  for (const run of requests) {
    try {
      return await run();
    } catch (err) {
      const status = err?.response?.status;
      lastError = err;
      if (status !== 404) throw err;
    }
  }
  throw lastError;
}

export const newsAPI = {
  list: () => api.get('/v1/core/news/'),
  create: (data) => api.post('/v1/core/news/', data),
  update: (id, data) => api.patch(`/v1/core/news/${id}/`, data),
  delete: (id) => api.delete(`/v1/core/news/${id}/`),
};

export const regulationsAPI = {
  list: (params) => api.get('/v1/content/regulations/', { params }),
  detail: (id) =>
    requestWithFallback([
      () => api.get(`/v1/content/regulations/${id}/`),
      () => api.get(`/v1/content/regulations/${id}`),
    ]),
  create: (data) => api.post('/v1/content/regulations/', data),
  update: (id, data) => api.patch(`/v1/content/regulations/${id}/`, data),
  delete: (id) => api.delete(`/v1/content/regulations/${id}/`),
  acknowledge: (id, data = {}) =>
    requestWithFallback([
      () => api.post(`/v1/content/regulations/${id}/acknowledge/`, data),
      () => api.post(`/v1/content/regulations/${id}/acknowledge`, data),
      () => api.post(`/v1/content/regulations/${id}/mark-read/`, data),
      () => api.post(`/v1/content/regulations/${id}/mark-read`, data),
    ]),
  submitFeedback: (id, data) =>
    requestWithFallback([
      () => api.post(`/v1/content/regulations/${id}/feedback/`, data),
      () => api.post(`/v1/content/regulations/${id}/feedback`, data),
    ]),
  submitQuiz: (id, data) =>
    requestWithFallback([
      () => api.post(`/v1/content/regulations/${id}/quiz/`, data),
      () => api.post(`/v1/content/regulations/${id}/quiz`, data),
      () => api.post(`/v1/content/regulations/${id}/test/`, data),
      () => api.post(`/v1/content/regulations/${id}/test`, data),
    ]),
  submitReadReport: (id, data) =>
    requestWithFallback([
      () => api.post(`/v1/content/regulations/${id}/read-report/`, data),
      () => api.post(`/v1/content/regulations/${id}/read-report`, data),
      () => api.post(`/v1/content/regulations/${id}/report/`, data),
      () => api.post(`/v1/content/regulations/${id}/report`, data),
    ]),
};

export const instructionsAPI = {
  list: () => api.get('/v1/content/instructions/'),
};

export const onboardingAPI = {
  getMy: () => api.get('/v1/onboarding/my/'),
  submitReport: (data) => api.post('/v1/onboarding/reports/', data),
  updateReport: (id, data) => api.patch(`/v1/onboarding/reports/${id}/`, data),
  getReports: (params) => api.get('/v1/onboarding/reports/', { params }),
  reviewReport: (id, data) => api.post(`/v1/onboarding/reports/${id}/review/`, data),
};

export const schedulesAPI = {
  getWorkSchedules: () => api.get('/v1/schedules/work-schedules/'),
  getMine: () => api.get('/v1/schedules/user-schedules/mine/'),
  getHolidays: (year) => api.get('/v1/schedules/holidays/', { params: { year } }),
};

export const feedbackAPI = {
  list: () =>
    requestWithFallback([
      () => api.get('/v1/feedback/tickets/'),
      () => api.get('/v1/feedback/tickets'),
      () => api.get('/v1/feedback/'),
      () => api.get('/v1/feedback'),
    ]),
  create: (data) =>
    requestWithFallback([
      () => api.post('/v1/feedback/tickets/', data),
      () => api.post('/v1/feedback/tickets', data),
      () => api.post('/v1/feedback/', data),
      () => api.post('/v1/feedback', data),
    ]),
  reply: (id, data) =>
    requestWithFallback([
      () => api.post(`/v1/feedback/tickets/${id}/reply/`, data),
      () => api.post(`/v1/feedback/tickets/${id}/reply`, data),
      () => api.post(`/v1/feedback/${id}/reply/`, data),
      () => api.post(`/v1/feedback/${id}/reply`, data),
    ]),
};

export const auditAPI = {
  list: (params) => api.get('/v1/core/audit/', { params }),
};
