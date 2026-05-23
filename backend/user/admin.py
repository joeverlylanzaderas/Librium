# user/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserProfile
from config.admin_site import librium_admin

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False

class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('email', 'username', 'full_name', 'role', 'is_active')
    ordering = ('-date_joined',)
    fieldsets = (
        (None,             {'fields': ('email', 'password')}),
        ('Personal info',  {'fields': ('username', 'full_name')}),
        ('Role',           {'fields': ('role', 'is_active', 'is_staff', 'is_superuser')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'full_name', 'role', 'password1', 'password2'),
        }),
    )

librium_admin.register(User, UserAdmin)