import api from './axios';

export const payrollAPI = {
  my: (params) => api.get('/v1/payroll/', { params }),
  mySummary: (params) => api.get('/v1/payroll/my/', { params }),
  all: (params) => api.get('/v1/payroll/all/', { params }),
  adminList: (params) => api.get('/v1/payroll/admin/', { params }),
  departmentSummary: (params) => api.get('/v1/payroll/department-summary/', { params }),
  adminSummary: (year, month) => api.get('/v1/payroll/admin/summary/', { params: { year, month } }),
  recalculate: (data) => api.post('/v1/payroll/admin/recalculate/', data),
  generate: (data) => api.post('/v1/payroll/admin/recalculate/', data),

  payslipPdf: (year, month) => api.get(`/v1/payroll/payslip/${year}/${month}/pdf/`, { responseType: 'blob' }),
  adminPayslipPdf: (userId, year, month) => api.get(`/v1/payroll/admin/payslip/${userId}/${year}/${month}/pdf/`, { responseType: 'blob' }),
  downloadPayslip: (recordId) => api.get(`/v1/payroll/payslip/${recordId}/`, { responseType: 'blob' }),

  createBonus: (payload) => api.post('/v1/payroll/bonus/', payload),
  createPenalty: (payload) => api.post('/v1/payroll/penalty/', payload),

  expenses: (params) => api.get('/v1/payroll/expenses/', { params }),
  createExpense: (payload) => api.post('/v1/payroll/expenses/', payload),

  setRecordStatus: (recordId, statusOrPayload) => {
    const payload = typeof statusOrPayload === 'string' ? { status: statusOrPayload } : (statusOrPayload || {});
    return api.patch(`/v1/payroll/admin/records/${recordId}/status/`, payload);
  },
  adjustRecord: (recordId, payload) => api.patch(`/v1/payroll/admin/records/${recordId}/adjustments/`, payload || {}),

  salaryProfiles: () => api.get('/v1/payroll/admin/salary-profiles/'),
  saveSalaryProfile: (data) => api.post('/v1/payroll/admin/salary-profiles/', data),
  createSalaryProfile: (data) => api.post('/v1/payroll/admin/salary-profiles/', data),
  updateSalaryProfile: (_id, data) => api.post('/v1/payroll/admin/salary-profiles/', data),
  compensationList: () => api.get('/v1/payroll/admin/hourly-rates/'),
  compensationUpdate: (payload) => api.post('/v1/payroll/admin/hourly-rates/', payload),
  compensationHistory: (userId) => api.get(`/v1/payroll/admin/hourly-rates/${userId}/history/`),
};
