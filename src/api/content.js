import api from './axios';
import { getStoredLocale } from '../context/LocaleContext';

export const newsAPI = {
  // list uses compat layer (GET only) — works fine for reading
  list: () => api.get('/core/news/'),
  // admin CRUD uses the real v1 content endpoint
  create: (data) => api.post('/v1/content/news/', data),
  update: (id, data) => api.patch(`/v1/content/news/${id}/`, data),
  delete: (id) => api.delete(`/v1/content/news/${id}/`),
};

export const regulationsAPI = {
  // list uses compat layer (GET only) — works fine for user reading
  list: (params) => api.get('/content/regulations/', { params }),
  detail: (id) => api.get(`/v1/regulations/${id}/`),
  // admin CRUD uses the real v1 regulations admin endpoint
  create: (data) => api.post('/v1/regulations/admin/', data),
  update: (id, data) => api.patch(`/v1/regulations/admin/${id}/`, data),
  delete: (id) => api.delete(`/v1/regulations/admin/${id}/`),
  internOverview: () => api.get('/v1/regulations/intern/overview/'),
  submitInternCompletion: () => api.post('/v1/regulations/intern/submit/'),
  adminInternRequests: (params) => api.get('/v1/regulations/admin/intern-requests/', { params }),
  approveInternRequest: (requestId, data) => api.post(`/v1/regulations/admin/intern-requests/${requestId}/approve/`, data || {}),
  markRead: (id) => api.post(`/v1/regulations/${id}/read/`),
  sendFeedback: (id, data) => api.post(`/v1/regulations/${id}/feedback/`, data),
  submitFeedback: (id, data) => api.post(`/v1/regulations/${id}/feedback/`, data),
  submitQuiz: (id, data) => api.post(`/v1/regulations/${id}/quiz/`, data),
  // read-report endpoint does not exist in backend — fall back to sendFeedback
  submitReadReport: (id, data) => api.post(`/v1/regulations/${id}/feedback/`, data),
  acknowledge: (id) => api.post(`/v1/regulations/${id}/acknowledge/`),
};

export const instructionsAPI = {
  // list uses compat layer (GET only) — works fine for reading
  list: () => api.get('/content/instructions/'),
  // admin CRUD uses the real v1 content endpoint
  create: (data) => api.post('/v1/content/instruction/', data),
  update: (id, data) => api.patch(`/v1/content/instruction/${id}/`, data),
  delete: (id) => api.delete(`/v1/content/instruction/${id}/`),
};

export const onboardingAPI = {
  getMy: () => api.get('/onboarding/my/'),
  listDays: () => api.get('/v1/onboarding/days/'),
  getDay: (id) => api.get(`/v1/onboarding/days/${id}/`),
  completeDay: (id) => api.post(`/v1/onboarding/days/${id}/complete/`),
  getInternRole: () => api.get('/v1/accounts/me/intern-role/'),
  setInternRole: (subdivision_id) => api.post('/v1/accounts/me/intern-role/', { subdivision_id }),
  submitReport: (data) => api.post('/onboarding/reports/', data),
  updateReport: (id, data) => api.patch(`/onboarding/reports/${id}/`, data),
  getReports: (params) => api.get('/onboarding/reports/', { params }),
  reviewReport: (id, data) => api.post(`/onboarding/reports/${id}/review/`, data),
  getInternProgress: (userId) => api.get(`/v1/onboarding/progress/${userId}/detail/`),
  // Admin day management
  adminListDays: () => api.get('/v1/onboarding/admin/onboarding/days/'),
  adminCreateDay: (data) => api.post('/v1/onboarding/admin/onboarding/days/', data),
  adminUpdateDay: (id, data) => api.patch(`/v1/onboarding/admin/onboarding/days/${id}/`, data),
  adminDeleteDay: (id) => api.delete(`/v1/onboarding/admin/onboarding/days/${id}/`),
  adminCreateMaterial: (data) => api.post('/v1/onboarding/admin/onboarding/materials/', data),
  adminDeleteMaterial: (id) => api.delete(`/v1/onboarding/admin/onboarding/materials/${id}/`),
};

export const schedulesAPI = {
  getWorkSchedules: () => api.get('/schedules/work-schedules/'),
  getMine: () => api.get('/schedules/user-schedules/mine/'),
  getHolidays: (year) => api.get('/schedules/holidays/', { params: { year } }),
  select: (scheduleId) => api.post('/v1/work-schedules/select/', { schedule_id: scheduleId }),
  weeklyPlanSubmit: (data) => api.post('/v1/work-schedules/weekly-plans/my/', data),
  adminTemplates: () => api.get('/v1/work-schedules/admin/templates/'),
  adminCreateTemplate: (data) => api.post('/v1/work-schedules/admin/templates/', data),
  adminUpdateTemplate: (id, data) => api.patch(`/v1/work-schedules/admin/templates/${id}/`, data),
  adminRequests: (params) => api.get('/v1/work-schedules/admin/requests/', { params }),
  adminRequestDecision: (id, approved) => api.post(`/v1/work-schedules/admin/requests/${id}/decision/`, { approved }),
  adminAssign: (data) => api.post('/v1/work-schedules/admin/assign/', data),
  weeklyPlansMy: () => api.get('/v1/work-schedules/weekly-plans/my/'),
  weeklyPlansAdmin: (params) => api.get('/v1/work-schedules/admin/weekly-plans/', { params }),
  weeklyPlanDecision: (id, data) => api.post(`/v1/work-schedules/admin/weekly-plans/${id}/decision/`, data),
};

export const attendanceAPI = {
  getMy: (params) => api.get('/v1/attendance/my/', { params }),
  getTeam: (params) => api.get('/v1/attendance/team/', { params }),
  checkinsReport: (params) => api.get('/v1/attendance/checkins-report/', { params }),
  mark: (data) => api.post('/v1/attendance/mark/', data),
  officeCheckIn: (data) => api.post('/v1/attendance/check-in/', data),
};

export const feedbackAPI = {
  list: () => api.get('/v1/content/admin/feedback/'),
  create: (data) => api.post('/v1/content/feedback/', data),
  reply: (id, data) => api.post(`/v1/content/admin/feedback/${id}/set-status/`, data),
  delete: (id) => api.delete(`/v1/content/admin/feedback/${id}/`),
};

export const auditAPI = {
  list: (params) => api.get('/core/audit/', { params }),
};

export const tasksAPI = {
  my: () => api.get('/v1/tasks/my/'),
  team: () => api.get('/v1/tasks/team/'),
  assignees: () => api.get('/v1/tasks/assignees/'),
  create: (data) => api.post('/v1/tasks/create/', data),
  detail: (id) => api.get(`/v1/tasks/${id}/`),
  update: (id, data) => api.patch(`/v1/tasks/${id}/`, data),
  move: (id, column_id) => api.patch(`/v1/tasks/${id}/move/`, { column_id }),
  dailyReports: (params) => api.get('/v1/reports/employee/daily/', { params }),
  submitDailyReport: (data) => api.post('/v1/reports/employee/daily/', data),
};

export const companyAPI = {
  structure: () => api.get('/v1/accounts/company/structure/'),
  org: (params) => api.get('/v1/accounts/org/structure/', { params }),
};

export const notificationsAPI = {
  list: (params = {}) => api.get('/v1/common/notifications/', { params: { lang: getStoredLocale(), ...params } }),
  markRead: (id) => api.patch(`/v1/common/notifications/${id}/read/`, null, { params: { lang: getStoredLocale() } }),
  markAllRead: () => api.patch('/v1/common/notifications/read-all/', null, { params: { lang: getStoredLocale() } }),
};


