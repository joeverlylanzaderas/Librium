from rest_framework import permissions

class IsAdminOrLibrarian(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['admin', 'librarian']
    
    def has_object_permission(self, request, view, obj):
        return request.user.is_authenticated and request.user.role in ['admin', 'librarian']


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return obj.id == request.user.id