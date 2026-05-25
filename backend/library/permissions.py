from rest_framework import permissions

class IsAdminOrLibrarian(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['admin', 'librarian']
    
    def has_object_permission(self, request, view, obj):
        return request.user.is_authenticated and request.user.role in ['admin', 'librarian']


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if getattr(request.user, 'role', None) == 'admin':
            return True
        
        # Check standard fields across your models (member or user)
        if hasattr(obj, 'member'):
            return obj.member == request.user
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return obj.id == request.user.id