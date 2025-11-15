# Frontend Integration Guide

## 🎯 Overview
The Django backend is now running at http://127.0.0.1:8000/. This guide will help you connect the Next.js frontend to the backend API.

---

## 📝 Quick Test - Backend is Working

### Test 1: Access API Documentation
Open your browser: http://127.0.0.1:8000/api/docs/
- You should see the Swagger UI with all 25+ API endpoints

### Test 2: Access Django Admin
Open: http://127.0.0.1:8000/admin/
- Login with: **admin** / **admin123**
- You can view and manage all data from here

### Test 3: Test Login API
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Expected response:
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  },
  "tokens": {
    "refresh": "eyJ...",
    "access": "eyJ..."
  }
}
```

### Test 4: Sync Orders from External API
```bash
# Get access token from previous step, then:
curl -X POST http://127.0.0.1:8000/api/admin/sync \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

This will import real orders from the external API!

---

## 🔧 Frontend Integration Steps

### Step 1: Install Axios in Frontend
```bash
cd frontend
pnpm add axios
```

### Step 2: Create API Client

Create `frontend/lib/api.ts`:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (token expired)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post('http://localhost:8000/api/auth/refresh', {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', response.data.access);
          // Retry original request
          error.config.headers.Authorization = `Bearer ${response.data.access}`;
          return api.request(error.config);
        } catch {
          // Refresh failed, logout
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Step 3: Create API Service Functions

Create `frontend/services/auth.service.ts`:

```typescript
import api from '@/lib/api';

export const authService = {
  async login(username: string, password: string) {
    const response = await api.post('/auth/login', { username, password });
    localStorage.setItem('access_token', response.data.tokens.access);
    localStorage.setItem('refresh_token', response.data.tokens.refresh);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data;
  },

  async logout() {
    await api.post('/auth/logout');
    localStorage.clear();
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  getStoredUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },
};
```

Create `frontend/services/picklist.service.ts`:

```typescript
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
};
```

Create `frontend/services/orders.service.ts`:

```typescript
import api from '@/lib/api';

export const ordersService = {
  async getReadyToPack() {
    const response = await api.get('/orders/ready-to-pack');
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
};
```

Create `frontend/services/stock.service.ts`:

```typescript
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
    link.setAttribute('download', 'stock_exceptions.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  async sendNotification(channel: 'email' | 'sms', recipients?: string[], message?: string) {
    const response = await api.post('/out-of-stock/send', { channel, recipients, message });
    return response.data;
  },
};
```

Create `frontend/services/admin.service.ts`:

```typescript
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
};
```

### Step 4: Create Login Page

Create `frontend/app/login/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login(username, password);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Login - Order Picking System</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          <p className="text-sm text-gray-500 mt-4">
            Default credentials: admin / admin123
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 5: Update Pick List Component

Update `frontend/components/pick-list-page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { pickListService } from '@/services/picklist.service';
// ... rest of imports

export function PickListPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    loadPickList();
    loadStats();
  }, []);

  const loadPickList = async () => {
    try {
      const data = await pickListService.getPickList();
      setItems(data);
    } catch (error) {
      console.error('Failed to load pick list:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await pickListService.getPickListStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handlePickOne = async (sku: string) => {
    try {
      await pickListService.pickItems(sku, 1);
      await loadPickList(); // Reload data
      await loadStats();
    } catch (error) {
      console.error('Failed to pick item:', error);
    }
  };

  const handlePickQuantity = async (sku: string, qty: number) => {
    try {
      await pickListService.pickItems(sku, qty);
      await loadPickList();
      await loadStats();
    } catch (error) {
      console.error('Failed to pick items:', error);
    }
  };

  // ... rest of component
}
```

### Step 6: Create Protected Route Wrapper

Create `frontend/components/protected-route.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  if (!authService.isAuthenticated()) {
    return null;
  }

  return <>{children}</>;
}
```

Update `frontend/app/page.tsx`:

```typescript
import { ProtectedRoute } from '@/components/protected-route';
// ... rest of imports

export default function Home() {
  return (
    <ProtectedRoute>
      {/* Your existing home page content */}
    </ProtectedRoute>
  );
}
```

---

## 🧪 Testing the Integration

### Test 1: Login Flow
1. Start frontend: `cd frontend && pnpm dev`
2. Visit: http://localhost:3000/login
3. Login with: admin / admin123
4. Should redirect to main app

### Test 2: Pick List
1. Click "Sync Now" in admin page to import orders
2. Go to Pick List page
3. You should see real items from the external API
4. Try picking items - should update in real-time

### Test 3: Ready to Pack
1. Pick all items for an order
2. Order should automatically appear in "Ready to Pack"
3. Mark it as packed

### Test 4: Out of Stock
1. Mark an item as "Not in Stock"
2. View in Out of Stock page
3. Export CSV
4. Send email notification (check terminal for console output)

---

## 🎨 UI Enhancements (Optional)

### Add Loading States
```typescript
{loading ? (
  <div>Loading...</div>
) : (
  // Your content
)}
```

### Add Toast Notifications
```bash
pnpm add sonner
```

```typescript
import { toast } from 'sonner';

toast.success('Items picked successfully!');
toast.error('Failed to pick items');
```

### Add Error Boundaries
Handle API errors gracefully throughout the app.

---

## 📊 Current Status

**Backend:** ✅ 100% Complete (Running at http://127.0.0.1:8000/)
**Frontend:** 🟡 50% Complete (UI built, needs API integration)

**What's Done:**
- Complete backend with all features
- Frontend UI with all 4 pages
- All API endpoints working

**What's Needed:**
- Create API services (1-2 hours)
- Update components to use real APIs (2-3 hours)
- Add login page and auth flow (1 hour)
- Testing and bug fixes (2-3 hours)

**Total Time:** ~6-9 hours to fully integrate

---

## 🚀 Next Steps

1. **Today:** Create API services and connect Pick List page
2. **Tomorrow:** Connect remaining pages (Ready to Pack, Out of Stock, Admin)
3. **Day 3:** Testing, bug fixes, and polish
4. **Day 4:** Deployment preparation

---

## 📞 Need Help?

- Backend API Docs: http://127.0.0.1:8000/api/docs/
- Django Admin: http://127.0.0.1:8000/admin/
- See `IMPLEMENTATION_STATUS.md` for detailed project info
- See `backend/SETUP.md` for backend details

**Ready to integrate? Start with Step 2 above!** 🎉
