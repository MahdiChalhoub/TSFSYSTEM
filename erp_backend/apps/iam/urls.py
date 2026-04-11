"""
IAM Module — URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.iam.views import (
    ContactPortalAccessViewSet,
    PortalApprovalRequestViewSet,
    IAMUserViewSet,
)

router = DefaultRouter()
router.register(r'portal-access', ContactPortalAccessViewSet, basename='portal-access')
router.register(r'approvals', PortalApprovalRequestViewSet, basename='approvals')

urlpatterns = [
    path('', include(router.urls)),
    # Transfer / user management helpers
    path('users/create-from-contact/', IAMUserViewSet.as_view({'post': 'create_from_contact'})),
    path('users/promote-to-employee/', IAMUserViewSet.as_view({'post': 'promote_to_employee'})),
    path('users/create-contact-from-employee/', IAMUserViewSet.as_view({'post': 'create_contact_from_employee'})),
    path('users/create-contact-from-user/', IAMUserViewSet.as_view({'post': 'create_contact_from_user'})),
    path('users/link-to-contact/', IAMUserViewSet.as_view({'post': 'link_to_contact'})),
    path('users/portal-summary/', IAMUserViewSet.as_view({'get': 'portal_summary'})),
]
