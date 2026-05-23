from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.admin.views.decorators import staff_member_required
from config.admin_dashboard import admin_dashboard_view
from config.admin_site import librium_admin

urlpatterns = [
    # ── Custom dashboard  ──
    path('admin/', librium_admin.urls),

    # ── Auth ───────────────────────────────────────────────
    path('api/auth/', include('djoser.urls')),
    path('api/auth/', include('djoser.urls.jwt')),

    # ── User management ────────────────────────────────────
    path('api/users/', include('user.urls')),

    # ── Library ────────────────────────────────────────────
    path('api/library/', include('library.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)