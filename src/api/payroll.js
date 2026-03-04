import api from './axios';

export const payrollAPI = {
  my: (year, month) => api.get('/v1/payroll/', { params: { year, month } }),
  adminList: (year, month) => api.get('/v1/payroll/admin/', { params: { year, month } }),
  adminSummary: (year, month) => api.get('/v1/payroll/admin/summary/', { params: { year, month } }),
  recalculate: (year, month) => api.post('/v1/payroll/admin/recalculate/', { year, month }),
  setRecordStatus: (recordId, statusOrPayload) => {
    const payload =
      typeof statusOrPayload === 'string'
        ? { status: statusOrPayload }
        : (statusOrPayload || {});
    return api.patch(`/v1/payroll/admin/records/${recordId}/status/`, payload);
  },
  compensationList: () => api.get('/v1/payroll/admin/hourly-rates/'),
  compensationUpdate: (payload) => api.post('/v1/payroll/admin/hourly-rates/', payload),
  compensationHistory: (userId) => api.get(`/v1/payroll/admin/hourly-rates/${userId}/history/`),
};
