import api from '@/lib/api';

export const stockService = {
  async getExceptions(filters?: { resolved?: boolean; from_date?: string; to_date?: string }) {
    const response = await api.get('/out-of-stock', { params: filters });
    return response.data;
  },

  async exportCSV() {
    const response = await api.get('/out-of-stock/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stock_exceptions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async sendNotification(channel: 'email' | 'sms', recipients?: string[], message?: string) {
    const response = await api.post('/out-of-stock/send', { channel, recipients, message });
    return response.data;
  },

  async resolveException(exceptionId: number) {
    const response = await api.post(`/out-of-stock/${exceptionId}/resolve`);
    return response.data;
  },
};
