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
  list: async (params) => {
    try {
      return await api.get('/v1/regulations/', { params });
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        return api.get('/content/regulations/', { params });
      }
      throw err;
    }
  },
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

export const userLessonsAPI = {
  list: () => api.get('/v1/content/user-lessons/'),
  update: (id, data) => api.patch(`/v1/content/user-lessons/${id}/`, data),
};

export const lessonsAdminAPI = {
  list: () => api.get('/v1/content/lessons/'),
  create: (data) => api.post('/v1/content/lessons/', data),
  update: (id, data) => api.patch(`/v1/content/lessons/${id}/`, data),
  delete: (id) => api.delete(`/v1/content/lessons/${id}/`),
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
  mySession: () => api.get('/v1/attendance/my/session/'),
  getTeam: (params) => api.get('/v1/attendance/team/', { params }),
  checkinsReport: (params) => api.get('/v1/attendance/checkins-report/', { params }),
  mark: (data) => api.post('/v1/attendance/mark/', data),
  officeCheckIn: (data) => api.post('/v1/attendance/check-in/', data),
  officeCheckOut: (data) => api.post('/v1/attendance/check-out/', data || {}),
};

export const feedbackAPI = {
  list: () => api.get('/v1/content/admin/feedback/'),
  create: (data) => api.post('/v1/content/feedback/', data),
  reply: (id, data) => api.post(`/v1/content/admin/feedback/${id}/set-status/`, data),
  delete: (id) => api.delete(`/v1/content/admin/feedback/${id}/`),
};

export const coursesAPI = {
  menuAccess: () => api.get('/v1/content/courses/menu-access/'),
  available: () => api.get('/v1/content/courses/available/'),
  my: () => api.get('/v1/content/courses/my/'),
  selfEnroll: (course_id) => api.post('/v1/content/courses/self-enroll/', { course_id }),
  accept: (enrollment_id) => api.post('/v1/content/courses/accept/', { enrollment_id }),
  start: (enrollment_id) => api.post('/v1/content/courses/start/', { enrollment_id }),
  progress: (enrollment_id, progress_percent) =>
    api.post('/v1/content/courses/progress/', { enrollment_id, progress_percent }),
};

export const coursesAdminAPI = {
  list: () => api.get('/v1/content/admin/courses/'),
  create: (data) => api.post('/v1/content/admin/courses/', data),
  update: (id, data) => api.patch(`/v1/content/admin/courses/${id}/`, data),
  delete: (id) => api.delete(`/v1/content/admin/courses/${id}/`),
  assign: (data) => api.post('/v1/content/admin/courses/assign/', data),
};

export const auditAPI = {
  list: (params) => api.get('/core/audit/', { params }),
};

export const tasksAPI = {
  my: (params) => api.get('/v1/tasks/my/', { params }),
  team: (params) => api.get('/v1/tasks/team/', { params }),
  assignees: () => api.get('/v1/tasks/assignees/'),
  templates: () => api.get('/v1/tasks/templates/'),
  createTemplate: (data) => api.post('/v1/tasks/templates/', data),
  updateTemplate: (id, data) => api.patch(`/v1/tasks/templates/${id}/`, data),
  deleteTemplate: (id) => api.delete(`/v1/tasks/templates/${id}/`),
  applyTemplate: (data) => api.post('/v1/tasks/templates/apply/', data),
  create: (data) => api.post('/v1/tasks/create/', data),
  detail: (id) => api.get(`/v1/tasks/${id}/`),
  update: (id, data) => api.patch(`/v1/tasks/${id}/`, data),
  comments: (id) => api.get(`/v1/tasks/${id}/comments/`),
  addComment: (id, data) => api.post(`/v1/tasks/${id}/comments/`, data),
  attachments: (id) => api.get(`/v1/tasks/${id}/attachments/`),
  uploadAttachment: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/v1/tasks/${id}/attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteAttachment: (id, attachmentId) => api.delete(`/v1/tasks/${id}/attachments/${attachmentId}/`),
  history: (id) => api.get(`/v1/tasks/${id}/history/`),
  move: (id, column_id) => api.patch(`/v1/tasks/${id}/move/`, { column_id }),
  dailyReports: (params) => api.get('/v1/reports/employee/daily/', { params }),
  submitDailyReport: (data) => api.post('/v1/reports/employee/daily/', data),
  reviewDailyReport: (id, data) => api.post(`/v1/reports/employee/daily/${id}/review/`, data),
  analyzeReport: (id) => api.post(`/v1/reports/employee/daily/${id}/analyze/`),
};

export const pulseAPI = {
  submit: (data) => api.post('/v1/pulse/', data),
  my: () => api.get('/v1/pulse/my/'),
  team: () => api.get('/v1/pulse/team/'),
};

export const wikiAPI = {
  // Официальная KB
  kbList: (params) => api.get('/v1/kb/', { params }),
  kbDetail: (id) => api.get(`/v1/kb/${id}/`),
  // UserContent
  list: (params) => api.get('/v1/kb/wiki/', { params }),
  my: () => api.get('/v1/kb/wiki/my/'),
  create: (data) => api.post('/v1/kb/wiki/', data),
  detail: (id) => api.get(`/v1/kb/wiki/${id}/`),
  update: (id, data) => api.patch(`/v1/kb/wiki/${id}/`, data),
  remove: (id) => api.delete(`/v1/kb/wiki/${id}/`),
  submit: (id) => api.post(`/v1/kb/wiki/${id}/submit/`),
  moderate: (id, data) => api.post(`/v1/kb/wiki/${id}/moderate/`, data),
  moderationQueue: () => api.get('/v1/kb/wiki/moderation/'),
  // FailLibrary
  fails: (params) => api.get('/v1/kb/fails/', { params }),
  failsQueue: () => api.get('/v1/kb/fails/queue/'),
  submitFail: (data) => api.post('/v1/kb/fails/', data),
  moderateFail: (id, data) => api.post(`/v1/kb/fails/${id}/moderate/`, data),
  // Categories
  categories: () => api.get('/v1/kb/admin/categories/'),
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

export const gamificationAPI = {
  my: () => api.get('/v1/gamification/my/'),
};

export const metricsAPI = {
  my: () => api.get('/v1/metrics/'),
  team: () => api.get('/v1/metrics/team/'),
  dau: () => api.get('/v1/metrics/dau/'),
  snapshots: (params) => api.get('/v1/metrics/snapshots/', { params }),
  risks: (params) => api.get('/v1/metrics/risks/', { params }),
  resolveRisk: (id, data) => api.patch(`/v1/metrics/risks/${id}/`, data),
  onboardingKpi: () => api.get('/v1/metrics/onboarding-kpi/'),
};



export const desksAPI = {
  list: (params) => api.get('/v1/desks/', { params }),
  availability: (params) => api.get('/v1/desks/availability/', { params }),
  book: (data) => api.post('/v1/desks/bookings/', data),
  cancel: (id) => api.delete(`/v1/desks/bookings/${id}/`),
  rooms: (params) => api.get('/v1/desks/rooms/', { params }),
  roomCreate: (data) => api.post('/v1/desks/rooms/', data),
  roomDelete: (id) => api.delete(`/v1/desks/rooms/${id}/`),
  roomOptions: () => api.get('/v1/desks/rooms/options/'),
  roomsAvailability: (params) => api.get('/v1/desks/rooms/availability/', { params }),
  roomBook: (data) => api.post('/v1/desks/rooms/bookings/', data),
  roomCancel: (id) => api.delete(`/v1/desks/rooms/bookings/${id}/`),
};
