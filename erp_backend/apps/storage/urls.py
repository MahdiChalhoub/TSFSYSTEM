"""
Storage Module — urls.py
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'files', views.StoredFileViewSet, basename='stored-file')

urlpatterns = [
    path('', include(router.urls)),
    # Provider config — single resource (no pk in URL)
    path('provider/', views.StorageProviderViewSet.as_view({
        'get': 'list',
        'put': 'update',
    })),
    path('provider/test/', views.StorageProviderViewSet.as_view({
        'post': 'test_connection',
    })),
    # Chunked / resumable upload
    path('upload/init/', views.chunked_upload_init),
    path('upload/active/', views.active_uploads),
    path('upload/<uuid:session_id>/chunk/', views.chunked_upload_chunk),
    path('upload/<uuid:session_id>/complete/', views.chunked_upload_complete),
    path('upload/<uuid:session_id>/status/', views.chunked_upload_status),
    path('upload/<uuid:session_id>/abort/', views.chunked_upload_abort),
]

