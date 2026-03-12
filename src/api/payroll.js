import api from './axios';

export const payrollAPI = {
  my: (params) => api.get('/v1/payroll/', { params }),
  adminList: (params) => api.get('/v1/payroll/admin/', { params }),
  adminSummary: (year, month) => api.get('/v1/payroll/admin/summary/', { params: { year, month } }),
  // recalculate / generate — одно и то же действие
  recalculate: (data) => api.post('/v1/payroll/admin/recalculate/', data),
  generate: (data) => api.post('/v1/payroll/admin/recalculate/', data),
  // статус записи (record_id = id конкретной записи или "period")
  setRecordStatus: (recordId, statusOrPayload) => {
    const payload = typeof statusOrPayload === 'string' ? { status: statusOrPayload } : (statusOrPayload || {});
    return api.patch(`/v1/payroll/admin/records/${recordId}/status/`, payload);
  },
  setPeriodStatus: (recordId, statusOrPayload) => {
    const payload = typeof statusOrPayload === 'string' ? { status: statusOrPayload } : (statusOrPayload || {});
    return api.patch(`/v1/payroll/admin/records/${recordId}/status/`, payload);
  },
  // ставки / compensation — POST работает как upsert (create + update через user_id)
  salaryProfiles: () => api.get('/v1/payroll/admin/salary-profiles/'),
  saveSalaryProfile: (data) => api.post('/v1/payroll/admin/salary-profiles/', data),
  createSalaryProfile: (data) => api.post('/v1/payroll/admin/salary-profiles/', data),
  updateSalaryProfile: (_id, data) => api.post('/v1/payroll/admin/salary-profiles/', data),
  compensationList: () => api.get('/v1/payroll/admin/hourly-rates/'),
  compensationUpdate: (payload) => api.post('/v1/payroll/admin/hourly-rates/', payload),
  compensationHistory: (userId) => api.get(`/v1/payroll/admin/hourly-rates/${userId}/history/`),
};
