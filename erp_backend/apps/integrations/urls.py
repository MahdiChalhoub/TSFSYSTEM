"""
Integrations App — URL Configuration
Auto-discovered by erp/urls.py and mounted at /api/integrations/
"""
from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import WebhookSubscriptionViewSet

router = SimpleRouter()
router.register(r'webhooks', WebhookSubscriptionViewSet, basename='webhook-subscription')

urlpatterns = [
    path('', include(router.urls)),
]
