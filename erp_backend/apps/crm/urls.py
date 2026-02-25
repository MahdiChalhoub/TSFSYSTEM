"""
CRM Module URL Configuration
Routes for contact management and client pricing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.crm.views import ContactViewSet, PriceGroupViewSet, ClientPriceRuleViewSet

router = DefaultRouter()
router.register(r'contacts', ContactViewSet)
router.register(r'price-groups', PriceGroupViewSet)
router.register(r'price-rules', ClientPriceRuleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
