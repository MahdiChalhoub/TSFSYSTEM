"""
CRM Module URL Configuration
Routes for contact management and client pricing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.crm.views import (
    ContactViewSet, PriceGroupViewSet, ClientPriceRuleViewSet, 
    ContactTagViewSet, ContactPersonViewSet,
    ComplianceRuleViewSet, ComplianceEventViewSet,
    RelationshipAssignmentViewSet, FollowUpPolicyViewSet,
    ScheduledActivityViewSet, InteractionLogViewSet,
    SupplierProductPolicyViewSet
)

router = DefaultRouter()
router.register(r'contacts', ContactViewSet)
router.register(r'contact-tags', ContactTagViewSet)
router.register(r'contact-persons', ContactPersonViewSet)
router.register(r'price-groups', PriceGroupViewSet)
router.register(r'price-rules', ClientPriceRuleViewSet)
router.register(r'compliance-rules', ComplianceRuleViewSet)
router.register(r'compliance-events', ComplianceEventViewSet)
router.register(r'relationship-assignments', RelationshipAssignmentViewSet)
router.register(r'followup-policies', FollowUpPolicyViewSet)
router.register(r'activities', ScheduledActivityViewSet)
router.register(r'interactions', InteractionLogViewSet)
router.register(r'supplier-product-policies', SupplierProductPolicyViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
