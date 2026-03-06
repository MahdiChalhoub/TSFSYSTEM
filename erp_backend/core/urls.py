"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from erp.views import health_check
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from django.contrib.auth.decorators import login_required
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes, api_view

# Wrap the class-based views with a generic authentication requirement or use staff_member_required
from django.contrib.admin.views.decorators import staff_member_required

urlpatterns = [
    path('tsf-system-kernel-7788/', admin.site.urls),
    path('api/', include('erp.urls')),
    # Dual-mount: frontend erpFetch calls use 'erp/' prefix (e.g. erp/sites/, erp/users/)
    # so we expose kernel routes at /api/erp/ as well for namespaced access.
    path('api/erp/', include('erp.urls')),
    path('api/migration/', include('apps.migration.urls')),
    path('api/migration-v2/', include('apps.migration_v2.urls')),  # New migration system
    path('api/schema/', staff_member_required(SpectacularAPIView.as_view()), name='schema'),
    path('api/docs/', staff_member_required(SpectacularSwaggerView.as_view(url_name='schema')), name='swagger-ui'),
    path('api/redoc/', staff_member_required(SpectacularRedocView.as_view(url_name='schema')), name='redoc'),
    path('health/', health_check),
]

# Serve static and media files in all environments (nginx proxies to this)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
