"""
Client Gate — URL Configuration

Isolated namespace: /api/client-gate/
No overlap with /api/erp/ or /api/iam/
"""
from django.urls import path
from apps.iam.views_client_gate import client_register
from apps.iam.views_client_gate_api import (
    ClientMeView,
    ClientOrdersView,
    ClientStatementsView,
    ClientPointsView,
    ClientContextsView,
)

urlpatterns = [
    # Public
    path('register/', client_register, name='client-register'),

    # Authenticated + guarded
    path('me/', ClientMeView.as_view(), name='client-me'),
    path('me/orders/', ClientOrdersView.as_view(), name='client-orders'),
    path('me/statements/', ClientStatementsView.as_view(), name='client-statements'),
    path('me/points/', ClientPointsView.as_view(), name='client-points'),
    path('me/contexts/', ClientContextsView.as_view(), name='client-contexts'),
]
