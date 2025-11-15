# RBAC Implementation Progress

## ✅ Phase 1 & 2: Backend Complete

### Permission Classes Added ✅
- `IsSuperadmin` - Only superadmin access
- `IsAdminOrSuperadmin` - Admin or superadmin access
- `IsStaffOrAbove` - Staff, admin, or superadmin access

### Updated Permissions ✅
- `api_configuration_view` → `IsSuperadmin` (was IsAdmin)
- `email_sms_settings_view` → `IsSuperadmin` (was IsAdmin)
- `test_email_view` → `IsSuperadmin` (was IsAdmin)
- `test_sms_view` → `IsSuperadmin` (was IsAdmin)
- `UserViewSet` → `IsAdminOrSuperadmin` (was IsAdmin)

### New Endpoints Created ✅

#### Password Management:
1. **POST /api/auth/change-password** ✅
   - Permission: `IsAuthenticated` (all users)
   - Body: `{current_password, new_password}`
   - Changes own password

2. **POST /api/users/{id}/reset-password** ✅
   - Permission: `IsAdminOrSuperadmin`
   - Body: `{new_password}`
   - Resets any user's password (admin feature)

#### Order State Management:
3. **POST /api/orders/{id}/revert-to-picking** ✅
   - Permission: `IsAdminOrSuperadmin`
   - Reverts order from ready-to-pack/packed → picking
   - Resets all items to unpicked state

4. **POST /api/orders/{id}/change-state** ✅
   - Permission: `IsAdminOrSuperadmin`
   - Body: `{state: "open"|"ready_to_pack"|"packed"}`
   - Changes order to any valid state

### URL Routes Added ✅
All new endpoints have been registered in urls.py

---

## 📋 Phase 3-7: Frontend Implementation (Next)

### Phase 3: Update Frontend Services
- [ ] Add `changePassword()` to auth.service.ts
- [ ] Add `resetUserPassword()` to admin.service.ts
- [ ] Add `revertToPicking()` to orders.service.ts
- [ ] Add `changeOrderState()` to orders.service.ts
- [ ] Add user CRUD methods to admin.service.ts

### Phase 4: Admin Page Redesign
- [ ] Check user role and show/hide sections
- [ ] Superadmin: Show all settings
- [ ] Admin: Hide API/Email/SMS settings, show user management
- [ ] Staff: Only show user info + change password

### Phase 5: Ready to Pack Updates
- [ ] Admin/Superadmin: Add "Revert to Picking" button
- [ ] Staff: Hide revert button (view only)
- [ ] Add confirmation dialog

### Phase 6: Packed Orders Updates  
- [ ] Admin/Superadmin: Add action dropdown (Revert to Ready/Picking)
- [ ] Staff: Hide action buttons (read-only)
- [ ] Add confirmation dialogs

### Phase 7: Testing
- [ ] Test superadmin access
- [ ] Test admin access
- [ ] Test staff access
- [ ] Test all order state changes
- [ ] Test user management

---

## 🔐 API Endpoints Summary

### Authentication (5 total):
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- GET /api/auth/me
- **POST /api/auth/change-password** ← NEW

### Users (6 total):
- GET /api/users (list)
- POST /api/users (create)
- GET /api/users/{id} (retrieve)
- PUT /api/users/{id} (update)
- DELETE /api/users/{id} (delete)
- **POST /api/users/{id}/reset-password** ← NEW

### Orders (8 total):
- GET /api/picklist
- POST /api/pick
- POST /api/not-in-stock
- GET /api/orders/ready-to-pack
- GET /api/orders/packed
- POST /api/orders/{id}/mark-packed
- **POST /api/orders/{id}/revert-to-picking** ← NEW
- **POST /api/orders/{id}/change-state** ← NEW

### Admin Settings (6 total - Superadmin only):
- GET/PUT /api/admin/settings
- GET/PUT /api/admin/email-sms-settings
- POST /api/admin/test-email
- POST /api/admin/test-sms
- POST /api/admin/sync
- GET /api/admin/sync-status

---

## Next Step: Frontend Services Implementation

Starting with auth.service.ts to add changePassword() method...
