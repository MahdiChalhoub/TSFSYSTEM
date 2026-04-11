"""
Supplier Gate — URL Configuration

Isolated namespace: /api/supplier-gate/
"""
from django.urls import path
from apps.iam.views_supplier_gate import supplier_register
from apps.iam.views_supplier_gate_api import (
    SupplierMeView,
    SupplierProductsView,
    SupplierInvoicesView,
    SupplierBalanceView,
    SupplierContextsView,
)

urlpatterns = [
    # Public
    path('register/', supplier_register, name='supplier-register'),

    # Authenticated + guarded
    path('me/', SupplierMeView.as_view(), name='supplier-me'),
    path('me/products/', SupplierProductsView.as_view(), name='supplier-products'),
    path('me/invoices/', SupplierInvoicesView.as_view(), name='supplier-invoices'),
    path('me/balance/', SupplierBalanceView.as_view(), name='supplier-balance'),
    path('me/contexts/', SupplierContextsView.as_view(), name='supplier-contexts'),
]
