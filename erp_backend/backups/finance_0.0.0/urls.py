# Finance Module URLs (Stub)

from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# ViewSets will be added here when the module is fully implemented

urlpatterns = [
    path('', include(router.urls)),
]
