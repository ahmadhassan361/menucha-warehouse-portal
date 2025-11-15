from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    Permission class to allow only Admin users
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class IsPicker(permissions.BasePermission):
    """
    Permission class to allow Staff users (or above)
    Staff can pick and pack orders
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['staff', 'admin', 'superadmin']
        )


class IsPacker(permissions.BasePermission):
    """
    Permission class to allow Staff users (or above)
    Staff can pick and pack orders
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['staff', 'admin', 'superadmin']
        )


class IsPickerOrPacker(permissions.BasePermission):
    """
    Permission class to allow Staff users (or above)
    Staff can pick and pack orders
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['staff', 'admin', 'superadmin']
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission class to allow Admin full access, others read-only
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class IsAdminOrPicker(permissions.BasePermission):
    """
    Permission class to allow Staff, Admin or Superadmin users
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['staff', 'admin', 'superadmin']
        )


class IsAdminOrPacker(permissions.BasePermission):
    """
    Permission class to allow Staff, Admin or Superadmin users
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['staff', 'admin', 'superadmin']
        )


class IsSuperadmin(permissions.BasePermission):
    """
    Permission class to allow only Superadmin users
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'superadmin'


class IsAdminOrSuperadmin(permissions.BasePermission):
    """
    Permission class to allow Admin or Superadmin users
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['admin', 'superadmin']
        )


class IsStaffOrAbove(permissions.BasePermission):
    """
    Permission class to allow Staff, Admin, or Superadmin users
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['staff', 'admin', 'superadmin']
        )
