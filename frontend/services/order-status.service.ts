import api from '@/lib/api';

export interface OrderItemStatus {
  id: number;
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
  shipment_batch: number;
  picked_by?: string;
  picked_at?: string;
}

export interface OrderProgress {
  total_items: number;
  items_with_picks: number;
  items_with_shorts: number;
  fully_picked_items: number;
  completion_percent: number;
}

export interface OrderStatus {
  id: number;
  number: string;
  customer_name: string;
  status: string;
  ready_to_pack: boolean;
  total_shipments: number;
  current_shipment: number;
  created_at: string;
  updated_at: string;
  customer_message: string;
  email_sent: boolean;
  items: OrderItemStatus[];
  progress: OrderProgress;
}

export interface OrderStatusParams {
  status?: 'in_progress' | 'all' | 'open' | 'picking' | 'ready_to_pack' | 'packed';
  search?: string;
}

export interface ItemBatchAssignment {
  item_id: number;
  batch: number;
}

export interface SplitOrderRequest {
  item_batches: ItemBatchAssignment[];
}

export const orderStatusService = {
  async getOrderStatus(params?: OrderStatusParams): Promise<OrderStatus[]> {
    const response = await api.get('/orders/status', { params });
    return response.data;
  },

  async updateOrderMessage(orderId: number, data: { customer_message?: string; email_sent?: boolean }) {
    const response = await api.patch(`/orders/${orderId}/update-message`, data);
    return response.data;
  },

  async splitOrder(orderId: number, data: SplitOrderRequest) {
    const response = await api.post(`/orders/${orderId}/split`, data);
    return response.data;
  },

  async unsplitOrder(orderId: number) {
    const response = await api.post(`/orders/${orderId}/unsplit`);
    return response.data;
  },
};
