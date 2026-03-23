import api from './axios';

export const newsAPI = {
  list: () => api.get('/core/news/'),
  create: (data) => api.post('/core/news/', data),
  update: (id, data) => api.patch(`/core/news/${id}/`, data),
  delete: (id) => api.delete(`/core/news/${id}/`),
};

export const regulationsAPI = {
  list: (params) => api.get('/content/regulations/', { params }),
  create: (data) => api.post('/content/regulations/', data),
  update: (id, data) => api.patch(`/content/regulations/${id}/`, data),
  delete: (id) => api.delete(`/content/regulations/${id}/`),
  internOverview: () => api.get('/v1/regulations/intern/overview/'),
  submitInternCompletion: () => api.post('/v1/regulations/intern/submit/'),
  adminInternRequests: (params) => api.get('/v1/regulations/admin/intern-requests/', { params }),
  approveInternRequest: (requestId, data) => api.post(`/v1/regulations/admin/intern-requests/${requestId}/approve/`, data || {}),
  markRead: (id, data) => api.post(`/v1/regulations/${id}/read/`, data),
  sendFeedback: (id, data) => api.post(`/v1/regulations/${id}/feedback/`, data),
  submitQuiz: (id, data) => api.post(`/v1/regulations/${id}/quiz/`, data),
  acknowledge: (id) => api.post(`/v1/regulations/${id}/acknowledge/`),
};

export const instructionsAPI = {
  list: () => api.get('/content/instructions/'),
  create: (data) => api.post('/content/instructions/', data),
  update: (id, data) => api.patch(`/content/instructions/${id}/`, data),
  delete: (id) => api.delete(`/content/instructions/${id}/`),
};

export const onboardingAPI = {
  getMy: () => api.get('/onboarding/my/'),
  listDays: () => api.get('/v1/onboarding/days/'),
  adminCreateDay: (data) => api.post('/v1/onboarding/admin/onboarding/days/', data),
  adminUpdateDay: (id, data) => api.patch(`/v1/onboarding/admin/onboarding/days/${id}/`, data),
  getDay: (id) => api.get(`/v1/onboarding/days/${id}/`),
  completeDay: (id) => api.post(`/v1/onboarding/days/${id}/complete/`),
  getInternRole: () => api.get('/v1/accounts/me/intern-role/'),
  setInternRole: (subdivision_id) => api.post('/v1/accounts/me/intern-role/', { subdivision_id }),
  submitReport: (data) => api.post('/onboarding/reports/', data),
  updateReport: (id, data) => api.patch(`/onboarding/reports/${id}/`, data),
  getReports: (params) => api.get('/onboarding/reports/', { params }),
  reviewReport: (id, data) => api.post(`/onboarding/reports/${id}/review/`, data),
  getInternProgress: (userId) => api.get(`/v1/onboarding/progress/${userId}/detail/`),
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
  list: () => api.get('/feedback/tickets/'),
  exitSurveys: () => api.get('/feedback/exit-surveys/'),
  create: (data) => api.post('/feedback/tickets/', data),
  reply: (id, data) => api.post(`/feedback/tickets/${id}/reply/`, data),
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
  attachments: (taskId) => api.get(`/v1/tasks/${taskId}/attachments/`),
  uploadAttachment: (taskId, data) => api.post(`/v1/tasks/${taskId}/attachments/`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteAttachment: (attachmentId) => api.delete(`/v1/tasks/attachments/${attachmentId}/`),
  moves: (params) => api.get('/v1/tasks/moves/', { params }),
  dailyReports: (params) => api.get('/v1/reports/employee/daily/', { params }),
  submitDailyReport: (data) => api.post('/v1/reports/employee/daily/', data),
};

export const companyAPI = {
  structure: () => api.get('/v1/accounts/company/structure/'),
  org: (params) => api.get('/v1/accounts/org/structure/', { params }),
};

export const notificationsAPI = {
  list: (params) => api.get('/v1/common/notifications/', { params }),
  markRead: (id) => api.patch(`/v1/common/notifications/${id}/read/`),
  markAllRead: () => api.patch('/v1/common/notifications/read-all/'),
};

export const payrollAPI = {
  my: (params) => api.get('/v1/payroll/', { params }),
  adminList: (params) => api.get('/v1/payroll/admin/', { params }),
  generate: (data) => api.post('/v1/payroll/admin/generate/', data),
  setPeriodStatus: (periodId, data) => api.patch(`/v1/payroll/admin/periods/${periodId}/status/`, data),
  salaryProfiles: () => api.get('/v1/payroll/admin/salary-profiles/'),
  createSalaryProfile: (data) => api.post('/v1/payroll/admin/salary-profiles/', data),
  updateSalaryProfile: (id, data) => api.patch(`/v1/payroll/admin/salary-profiles/${id}/`, data),
};

export const gamificationAPI = {
  my: () => api.get('/v1/gamification/my/'),
  leaderboard: (params) => api.get('/v1/gamification/leaderboard/', { params }),
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
