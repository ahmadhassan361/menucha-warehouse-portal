# Role-Based Access Control (RBAC) Implementation Plan

## Overview
Implement 3-tier role system with specific permissions for each role.

---

## 🎭 Role Definitions:

### 1. **Superadmin** (Full Access)
- All admin features
- Email settings configuration
- API settings configuration
- SMS settings configuration
- User management (CRUD)
- Order state management (revert/change)

### 2. **Admin** (Management Access)
- User management (CRUD)
- Order state management (revert/change)
- All tabs accessible
- **Cannot** modify Email/API/SMS settings

### 3. **Staff** (Limited Access)
- View orders (Pick List, Ready to Pack, Packed Orders)
- Mark orders as packed
- Change own password
- View own user info
- **Cannot** manage users
- **Cannot** change order states
- **Cannot** access settings

---

## 📋 Implementation Steps:

### **Phase 1: Backend - User Model & Roles** ✅ (Already exists)
- [x] User model has role field (superadmin/admin/staff/picker/packer)
- [ ] Update role choices if needed
- [ ] Create test users for each role

### **Phase 2: Backend - New API Endpoints**

#### 2.1 User Management Endpoints (Admin/Superadmin only)
- [ ] `POST /api/users` - Create user (admin/superadmin)
- [ ] `GET /api/users` - List users (admin/superadmin)
- [ ] `PUT /api/users/{id}` - Update user (admin/superadmin)
- [ ] `DELETE /api/users/{id}` - Delete user (admin/superadmin)
- [ ] `POST /api/users/{id}/reset-password` - Reset password (admin/superadmin)

#### 2.2 Password Change Endpoint (All users)
- [ ] `POST /api/auth/change-password` - Change own password

#### 2.3 Order State Management Endpoints (Admin/Superadmin only)
- [ ] `POST /api/orders/{id}/revert-to-picking` - Revert ready-to-pack → picking
- [ ] `POST /api/orders/{id}/change-state` - Change order state (packed → ready-to-pack or picking)

### **Phase 3: Backend - Permission Classes**
- [ ] `IsSuperadmin` - Only superadmin can access
- [ ] `IsAdminOrSuperadmin` - Admin or superadmin can access
- [ ] `IsStaffOrAbove` - Staff, admin, or superadmin can access

### **Phase 4: Backend - Update Existing Permissions**
- [ ] Update settings endpoints to require `IsSuperadmin`
- [ ] Update user management to require `IsAdminOrSuperadmin`

### **Phase 5: Frontend - Admin Page Redesign**

#### 5.1 Superadmin View
- [ ] Show Email Settings section
- [ ] Show API Settings section
- [ ] Show SMS Settings section
- [ ] Show User Management section
- [ ] Show Change Password section

#### 5.2 Admin View
- [ ] Hide Email/API/SMS Settings
- [ ] Show User Management section
- [ ] Show Change Password section

#### 5.3 Staff View
- [ ] Hide all settings
- [ ] Hide user management
- [ ] Show only:
  - User info (username, email, role)
  - Change Password form

### **Phase 6: Frontend - Ready To Pack Page Updates**
- [ ] Admin/Superadmin: Add "Revert to Picking" button on each order
- [ ] Add confirmation dialog for revert action
- [ ] Staff: Hide revert button (view + pack only)

### **Phase 7: Frontend - Packed Orders Page Updates**
- [ ] Admin/Superadmin: Add action dropdown per order:
  - "Revert to Ready to Pack"
  - "Revert to Picking"
- [ ] Add confirmation dialog for state changes
- [ ] Staff: Show orders as read-only (no action buttons)

### **Phase 8: Frontend - Services Updates**
- [ ] Add `changePassword()` to auth service
- [ ] Add `revertToPicking()` to orders service
- [ ] Add `changeOrderState()` to orders service
- [ ] Add user CRUD methods to admin service

### **Phase 9: Testing**
- [ ] Test superadmin access (all features)
- [ ] Test admin access (no settings, can manage users/orders)
- [ ] Test staff access (limited, read-only)
- [ ] Test order state changes
- [ ] Test user management

---

## 🔐 Permission Matrix:

| Feature | Superadmin | Admin | Staff |
|---------|-----------|-------|-------|
| **Admin Tab - Email Settings** | ✅ | ❌ | ❌ |
| **Admin Tab - API Settings** | ✅ | ❌ | ❌ |
| **Admin Tab - SMS Settings** | ✅ | ❌ | ❌ |
| **Admin Tab - User Management** | ✅ | ✅ | ❌ |
| **Admin Tab - Change Password** | ✅ | ✅ | ✅ |
| **Ready to Pack - View Orders** | ✅ | ✅ | ✅ |
| **Ready to Pack - Mark as Packed** | ✅ | ✅ | ✅ |
| **Ready to Pack - Revert to Picking** | ✅ | ✅ | ❌ |
| **Packed Orders - View Orders** | ✅ | ✅ | ✅ |
| **Packed Orders - Search/Filter** | ✅ | ✅ | ✅ |
| **Packed Orders - Change State** | ✅ | ✅ | ❌ |

---

## 🎯 Order State Transitions:

```
Picking (open)
    ↓ (all items picked)
Ready to Pack
    ↓ (mark as packed)
Packed
```

**New Admin/Superadmin Actions:**

From **Ready to Pack**:
- → Picking (revert all items, mark as not picked)

From **Packed**:
- → Ready to Pack (change status)
- → Picking (full revert)

---

## 📝 API Endpoints Summary:

### New Endpoints to Create:
1. `POST /api/auth/change-password` - Change own password
2. `POST /api/users/{id}/reset-password` - Reset user password (admin)
3. `POST /api/orders/{id}/revert-to-picking` - Revert order to picking
4. `POST /api/orders/{id}/change-state` - Change order state

### Existing Endpoints to Update:
1. `GET/PUT /api/admin/settings` - Add superadmin-only permission
2. `GET/PUT /api/admin/email-sms-settings` - Add superadmin-only permission
3. User ViewSet - Already exists, just update permissions

---

## 🚀 Implementation Order:

**Step 1:** Backend permissions (2-3 endpoints)
**Step 2:** Backend order state management (2 endpoints)
**Step 3:** Backend password change (1 endpoint)
**Step 4:** Frontend Admin page redesign
**Step 5:** Frontend Ready to Pack updates
**Step 6:** Frontend Packed Orders updates
**Step 7:** Testing & refinement

---

## ⏱️ Estimated Time:
- Backend: ~2-3 hours
- Frontend: ~2-3 hours
- Testing: ~1 hour
- **Total: ~5-7 hours**

---

Ready to implement step by step! 🚀
