# Order Picking Web App - Complete Implementation Plan

## Project Overview
Building a complete Order Picking Web App with:
- **Backend**: Django + Django REST Framework + PostgreSQL
- **Frontend**: Next.js (TypeScript) - Already built with mock data
- **External API**: Capital C Commerce API (orders-api-response.json format)

---

## Phase 1: Backend Infrastructure Setup ✅

### 1.1 Django Dependencies & Configuration
- [ ] Install required packages (djangorestframework, corsheaders, celery, redis, etc.)
- [ ] Configure PostgreSQL database
- [ ] Set up Django REST Framework
- [ ] Configure CORS for Next.js frontend
- [ ] Set up environment variables (.env)
- [ ] Configure static/media files

### 1.2 Authentication System
- [ ] Extend Django User model with roles (Admin, Picker, Packer)
- [ ] Implement JWT authentication (djangorestframework-simplejwt)
- [ ] Create login/logout endpoints
- [ ] Add role-based permission classes
- [ ] Create user management endpoints (CRUD)

---

## Phase 2: Database Models ✅

### 2.1 Core Models
- [ ] **Product** model (SKU, title, category, subcategory, image_url, weight, price)
- [ ] **Order** model (external_order_id, number, customer_name, status, ready_to_pack, timestamps)
- [ ] **OrderItem** model (order, product, SKU, qty_ordered, qty_picked, qty_short)
- [ ] **PickEvent** model (audit log: order_item, qty, user, timestamp)
- [ ] **StockException** model (SKU, product_title, qty_short, order_numbers, timestamp)
- [ ] **APIConfiguration** model (api_base_url, api_key, sync_interval, status_mapping)
- [ ] **EmailSMSSettings** model (SMTP config, Twilio config)

### 2.2 Model Indexing & Optimization
- [ ] Add database indexes on frequently queried fields (SKU, order_id, status)
- [ ] Create model managers for common queries
- [ ] Add model methods for business logic

---

## Phase 3: API Endpoints (Django REST Framework) ✅

### 3.1 Authentication Endpoints
- [ ] `POST /api/auth/login` - Login with email/password
- [ ] `POST /api/auth/logout` - Logout
- [ ] `POST /api/auth/refresh` - Refresh JWT token
- [ ] `GET /api/auth/me` - Get current user info

### 3.2 Pick List Endpoints
- [ ] `GET /api/picklist` - Get aggregated pick list (grouped by category → SKU)
- [ ] `POST /api/pick` - Pick items (body: {sku, qty})
- [ ] `POST /api/not-in-stock` - Mark items not in stock
- [ ] `GET /api/picklist/stats` - Get summary statistics

### 3.3 Ready to Pack Endpoints
- [ ] `GET /api/orders/ready-to-pack` - List orders ready for packing
- [ ] `GET /api/orders/{id}` - Get order details
- [ ] `POST /api/orders/{id}/mark-packed` - Mark order as packed
- [ ] `GET /api/orders/{id}/packing-slip` - Generate packing slip (PDF)

### 3.4 Out of Stock Endpoints
- [ ] `GET /api/out-of-stock` - List stock exceptions (with filters)
- [ ] `GET /api/out-of-stock/export` - Export CSV
- [ ] `POST /api/out-of-stock/send` - Send via email/SMS

### 3.5 Admin Endpoints
- [ ] `POST /api/admin/sync` - Manual sync trigger
- [ ] `GET /api/admin/sync-status` - Get last sync info
- [ ] `GET/PUT /api/admin/settings` - API configuration
- [ ] `GET/PUT /api/admin/email-settings` - Email/SMS settings
- [ ] `GET /api/admin/users` - List users
- [ ] `POST /api/admin/users` - Create user
- [ ] `PUT /api/admin/users/{id}` - Update user
- [ ] `DELETE /api/admin/users/{id}` - Delete user

---

## Phase 4: Business Logic Implementation ✅

### 4.1 Order Import Service
- [ ] Create service to fetch orders from external API
- [ ] Parse nested JSON structure (category → subcategory → items → orders)
- [ ] Upsert Products (create/update based on SKU)
- [ ] Upsert Orders (avoid duplicates using external_order_id)
- [ ] Create OrderItems with proper relationships
- [ ] Handle API errors and rate limiting

### 4.2 FIFO Pick Allocation Logic
- [ ] Implement FIFO algorithm (allocate to oldest orders first)
- [ ] When picking at SKU level, distribute picked qty across order items
- [ ] Update qty_picked for each affected order item
- [ ] Create PickEvent audit logs
- [ ] Check if orders become "ready to pack" after each pick

### 4.3 Stock Exception Management
- [ ] Mark items as "not in stock" (update qty_short)
- [ ] Create StockException records
- [ ] Aggregate exceptions by SKU
- [ ] Track which orders are affected
- [ ] Check if orders become "ready to pack" when items are marked short

### 4.4 Order Readiness Logic
- [ ] After each pick/short action, check affected orders
- [ ] Order is ready when: `qty_picked + qty_short >= qty_ordered` for ALL items
- [ ] Set `ready_to_pack = True` and update status
- [ ] Trigger notifications if configured

---

## Phase 5: Background Jobs (Celery + Redis) ✅

### 5.1 Celery Setup
- [ ] Install and configure Celery
- [ ] Set up Redis as message broker
- [ ] Configure Celery beat for scheduled tasks
- [ ] Create celery.py and configure in Django

### 5.2 Periodic Tasks
- [ ] Create task: `sync_orders_from_api()` - runs every 5-10 min (configurable)
- [ ] Create task: `cleanup_old_pick_events()` - archive old logs
- [ ] Create task: `send_daily_summary()` - optional daily reports

### 5.3 Async Tasks
- [ ] Create task: `send_out_of_stock_email()`
- [ ] Create task: `send_out_of_stock_sms()`
- [ ] Create task: `generate_packing_slip_pdf()`

---

## Phase 6: Email & SMS Integration ✅

### 6.1 Email Service
- [ ] Configure Django email backend (SMTP)
- [ ] Create email templates for out-of-stock reports
- [ ] Create email service class
- [ ] Add test email functionality

### 6.2 SMS Service (Twilio)
- [ ] Install Twilio SDK
- [ ] Create SMS service class
- [ ] Format out-of-stock report for SMS
- [ ] Add test SMS functionality

---

## Phase 7: Frontend Integration ✅

### 7.1 API Client Setup
- [ ] Create axios instance with base URL
- [ ] Add JWT token interceptor
- [ ] Create API service functions for all endpoints
- [ ] Add error handling and retry logic

### 7.2 Authentication Flow
- [ ] Create login page
- [ ] Implement JWT token storage (localStorage/cookies)
- [ ] Add protected route wrapper
- [ ] Handle token refresh
- [ ] Add logout functionality

### 7.3 Connect Pick List Page
- [ ] Replace mock data with API calls
- [ ] Implement real-time sync functionality
- [ ] Connect pick actions to backend
- [ ] Connect "not in stock" action to backend
- [ ] Add loading states and error handling

### 7.4 Connect Ready to Pack Page
- [ ] Fetch orders from `/api/orders/ready-to-pack`
- [ ] Display order details
- [ ] Implement "Mark Packed" functionality
- [ ] Add packing slip generation

### 7.5 Connect Out of Stock Page
- [ ] Fetch stock exceptions from API
- [ ] Implement date range filtering
- [ ] Add CSV export functionality
- [ ] Connect email/SMS send actions

### 7.6 Connect Admin Page
- [ ] Fetch and update API settings
- [ ] Fetch and update email/SMS settings
- [ ] Implement user management (CRUD)
- [ ] Add manual sync trigger
- [ ] Display sync status

---

## Phase 8: Testing & Validation ✅

### 8.1 Backend Testing
- [ ] Write unit tests for models
- [ ] Write unit tests for FIFO allocation logic
- [ ] Write API endpoint tests
- [ ] Test order import from external API
- [ ] Test authentication and permissions
- [ ] Test Celery tasks

### 8.2 Integration Testing
- [ ] Test full pick workflow (API → pick → ready to pack)
- [ ] Test not-in-stock workflow
- [ ] Test email/SMS sending
- [ ] Test concurrent picking (race conditions)

### 8.3 Frontend Testing
- [ ] Test all API integrations
- [ ] Test authentication flow
- [ ] Test all user actions (pick, pack, mark stock)
- [ ] Test responsive design (mobile view)

---

## Phase 9: Deployment & Configuration ✅

### 9.1 Backend Deployment
- [ ] Create Dockerfile for Django backend
- [ ] Set up PostgreSQL database (production)
- [ ] Set up Redis instance
- [ ] Configure environment variables
- [ ] Set up Gunicorn/uWSGI
- [ ] Configure nginx for static files
- [ ] Set up SSL certificates

### 9.2 Celery Deployment
- [ ] Set up Celery worker service
- [ ] Set up Celery beat service
- [ ] Configure monitoring (Flower)

### 9.3 Frontend Deployment
- [ ] Build Next.js for production
- [ ] Configure API base URL for production
- [ ] Deploy to Vercel/Netlify or static hosting
- [ ] Configure environment variables

### 9.4 Initial Configuration
- [ ] Create admin user
- [ ] Configure external API credentials
- [ ] Test first order import
- [ ] Configure email/SMS settings
- [ ] Set up backup strategy

---

## Phase 10: Documentation & Handoff ✅

### 10.1 Technical Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Database schema documentation
- [ ] Deployment guide
- [ ] Environment variables reference

### 10.2 User Documentation
- [ ] Admin user guide (configuration)
- [ ] Picker user guide
- [ ] Packer user guide
- [ ] Troubleshooting guide

---

## Technology Stack Summary

### Backend
- **Framework**: Django 5.2.6 + Django REST Framework
- **Database**: PostgreSQL (production) / SQLite (development)
- **Task Queue**: Celery + Redis
- **Authentication**: JWT (djangorestframework-simplejwt)
- **API Documentation**: drf-spectacular (OpenAPI/Swagger)

### Frontend (Already Built)
- **Framework**: Next.js (TypeScript)
- **UI Library**: shadcn/ui + Tailwind CSS
- **State Management**: React hooks
- **HTTP Client**: axios (to be integrated)

### External Services
- **Email**: SMTP (configurable)
- **SMS**: Twilio
- **External API**: Capital C Commerce API

### DevOps
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx
- **Application Server**: Gunicorn
- **Monitoring**: Celery Flower (task monitoring)

---

## Estimated Timeline

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| Phase 1: Backend Infrastructure | 1 day | High |
| Phase 2: Database Models | 1 day | High |
| Phase 3: API Endpoints | 2-3 days | High |
| Phase 4: Business Logic | 2-3 days | High |
| Phase 5: Background Jobs | 1-2 days | High |
| Phase 6: Email/SMS | 1 day | Medium |
| Phase 7: Frontend Integration | 2-3 days | High |
| Phase 8: Testing | 2-3 days | High |
| Phase 9: Deployment | 1-2 days | High |
| Phase 10: Documentation | 1 day | Medium |

**Total: ~15-20 working days**

---

## Next Steps

1. ✅ Review this plan
2. Start with Phase 1: Backend Infrastructure Setup
3. Work sequentially through each phase
4. Test thoroughly after each phase
5. Deploy to staging environment before production

---

## Notes

- The frontend UI is already built with mock data
- External API format is understood from `orders-api-respone.json`
- Focus on building robust backend with FIFO logic
- Ensure proper error handling and logging throughout
- Keep security best practices in mind (API keys, authentication)
