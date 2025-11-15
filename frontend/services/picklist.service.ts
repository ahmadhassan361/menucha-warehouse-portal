import api from '@/lib/api';

export const pickListService = {
  async getPickList() {
    const response = await api.get('/picklist');
    return response.data;
  },

  async getPickListStats() {
    const response = await api.get('/picklist/stats');
    return response.data;
  },

  async pickItems(sku: string, qty: number, notes?: string) {
    const response = await api.post('/pick', { sku, qty, notes });
    return response.data;
  },

  async markNotInStock(sku: string, allocations: Array<{order_id: number; qty_short: number}>, notes?: string) {
    const response = await api.post('/not-in-stock', { sku, allocations, notes });
    return response.data;
  },

  async getOrdersForSku(sku: string) {
    const response = await api.get(`/picklist/${sku}/orders`);
    return response.data;
  },
};
