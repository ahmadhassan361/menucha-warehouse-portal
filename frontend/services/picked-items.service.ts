import api from '@/lib/api';

export interface PickedItem {
  id: number;
  order_id: number;
  order_number: string;
  customer_name: string;
  sku: string;
  title: string;
  category: string;
  subcategory?: string;
  vendor_name?: string;
  variation_details?: string;
  image_url: string;
  qty_ordered: number;
  qty_picked: number;
  qty_short: number;
  qty_remaining: number;
  picked_by: string;
  picked_by_id: number;
  picked_at: string;
  created_at: string;
}

export interface PickedItemsParams {
  sort_by?: 'picked_at' | 'sku' | 'order_number' | 'category';
  order?: 'asc' | 'desc';
  search?: string;
  category?: string;
  subcategory?: string;
}

export const pickedItemsService = {
  async getPickedItems(params?: PickedItemsParams): Promise<PickedItem[]> {
    const response = await api.get('/picked-items', { params });
    return response.data;
  },

  async revertPickedItem(itemId: number, qty?: number): Promise<{ message: string }> {
    const response = await api.post(`/picked-items/${itemId}/revert`, qty ? { qty } : {});
    return response.data;
  },
};
