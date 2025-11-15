import api from '@/lib/api';

export const adminService = {
  async syncNow() {
    const response = await api.post('/admin/sync');
    return response.data;
  },

  async getSyncStatus() {
    const response = await api.get('/admin/sync-status');
    return response.data;
  },

  async getSettings() {
    const response = await api.get('/admin/settings');
    return response.data;
  },

  async updateSettings(settings: any) {
    const response = await api.put('/admin/settings', settings);
    return response.data;
  },

  async getEmailSMSSettings() {
    const response = await api.get('/admin/email-sms-settings');
    return response.data;
  },

  async updateEmailSMSSettings(settings: any) {
    const response = await api.put('/admin/email-sms-settings', settings);
    return response.data;
  },

  async getUsers() {
    const response = await api.get('/users/');
    return response.data;
  },

  async createUser(userData: any) {
    const response = await api.post('/users/', userData);
    return response.data;
  },

  async updateUser(userId: number, userData: any) {
    const response = await api.put(`/users/${userId}/`, userData);
    return response.data;
  },

  async deleteUser(userId: number) {
    await api.delete(`/users/${userId}/`);
  },

  async resetUserPassword(userId: number, newPassword: string) {
    const response = await api.post(`/users/${userId}/reset_password/`, {
      new_password: newPassword,
    });
    return response.data;
  },
};
