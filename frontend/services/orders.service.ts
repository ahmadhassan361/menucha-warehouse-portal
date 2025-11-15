import api from '@/lib/api';

export const ordersService = {
  async getReadyToPack() {
    const response = await api.get('/orders/ready-to-pack');
    return response.data;
  },

  async getPackedOrders(params?: { from_date?: string; to_date?: string; search?: string }) {
    const response = await api.get('/orders/packed', { params });
    return response.data;
  },

  async getOrderDetail(orderId: number) {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  },

  async markPacked(orderId: number, notes?: string) {
    const response = await api.post(`/orders/${orderId}/mark-packed`, { notes });
    return response.data;
  },

  async revertToPicking(orderId: number) {
    const response = await api.post(`/orders/${orderId}/revert-to-picking`);
    return response.data;
  },

  async changeOrderState(orderId: number, state: 'open' | 'ready_to_pack' | 'packed') {
    const response = await api.post(`/orders/${orderId}/change-state`, { state });
    return response.data;
  },
};
