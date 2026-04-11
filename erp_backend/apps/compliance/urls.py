"""
Compliance URL Configuration
=============================
Registers all compliance ViewSets under /api/compliance/
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.compliance.views.regulation_views import (
    PriceRegulationViewSet,
    RegulationRuleViewSet,
    RegulationAuditLogViewSet,
)

router = DefaultRouter()
router.register(r'regulations', PriceRegulationViewSet, basename='price-regulation')
router.register(r'rules', RegulationRuleViewSet, basename='regulation-rule')
router.register(r'audit-log', RegulationAuditLogViewSet, basename='regulation-audit-log')

app_name = 'compliance'
urlpatterns = [
    path('', include(router.urls)),
]
