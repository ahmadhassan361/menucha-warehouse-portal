import api from '@/lib/api';

export interface ItemIssueField {
  field: string;
  label: string;
  preset_notes: string[];
}

export interface ItemIssue {
  id: number;
  sku: string;
  title: string;
  category: string;
  subcategory: string;
  vendor_name: string;
  image_url: string | null;
  book_binding: boolean;
  field: string;
  field_label: string;
  note: string;
  report_count: number;
  status: 'open' | 'fixed' | 'dismissed';
  status_label: string;
  resolution_notes: string;
  reported_by_name: string;
  resolved_by_name: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemIssueFilters {
  status?: string;
  field?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
}

export const itemIssuesService = {
  async getFields(): Promise<ItemIssueField[]> {
    const response = await api.get('/item-issues/fields');
    return response.data;
  },

  async getIssues(filters?: ItemIssueFilters): Promise<ItemIssue[]> {
    const response = await api.get('/item-issues', { params: filters });
    return response.data;
  },

  async report(sku: string, issues: { field: string; note: string }[]) {
    const response = await api.post('/item-issues/report', { sku, issues });
    return response.data;
  },

  async updateStatus(issueId: number, status: string, resolutionNotes?: string) {
    const response = await api.post(`/item-issues/${issueId}/status`, {
      status,
      resolution_notes: resolutionNotes || '',
    });
    return response.data;
  },

  async exportCSV(filters?: ItemIssueFilters) {
    const response = await api.get('/item-issues/export', { params: filters, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inaccurate_items_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
