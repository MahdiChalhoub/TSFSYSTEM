"""
Supplier Gate — Scoped API Views

Every endpoint resolves data from the authenticated user's supplier portal context.
NO generic ERP endpoints — all data scoped via request.portal_contact.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.iam.guards import require_supplier_portal_access


class SupplierMeView(APIView):
    """GET /api/supplier-gate/me/ — Supplier profile overview."""
    permission_classes = [IsAuthenticated]

    @require_supplier_portal_access
    def get(self, request):
        contact = request.portal_contact
        access = request.portal_access

        return Response({
            'user': {
                'id': request.user.id,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
            },
            'contact': {
                'id': contact.id,
                'name': contact.name,
                'email': contact.email,
                'phone': getattr(contact, 'phone', ''),
                'type': contact.type,
            },
            'access': {
                'id': access.id,
                'portal_type': access.portal_type,
                'status': access.status,
                'relationship_role': access.relationship_role,
                'last_portal_login': access.last_portal_login,
            },
        })


class SupplierProductsView(APIView):
    """GET /api/supplier-gate/me/products/ — Products this supplier provides."""
    permission_classes = [IsAuthenticated]

    @require_supplier_portal_access
    def get(self, request):
        contact = request.portal_contact

        try:
            from apps.inventory.models import Product
            products = Product.objects.filter(
                organization=contact.organization,
                supplier_id=contact.id,
            ).values('id', 'name', 'sku', 'price', 'stock_quantity')[:100]
            return Response({'products': list(products)})
        except Exception:
            return Response({'products': [], 'note': 'Inventory module not available'})


class SupplierInvoicesView(APIView):
    """GET /api/supplier-gate/me/invoices/ — Purchase invoices from this supplier."""
    permission_classes = [IsAuthenticated]

    @require_supplier_portal_access
    def get(self, request):
        contact = request.portal_contact

        try:
            from apps.purchases.models import PurchaseInvoice
            invoices = PurchaseInvoice.objects.filter(
                organization=contact.organization,
                supplier_id=contact.id,
            ).order_by('-created_at').values(
                'id', 'invoice_number', 'status', 'total_amount',
                'created_at', 'payment_status',
            )[:50]
            return Response({'invoices': list(invoices)})
        except Exception:
            return Response({'invoices': [], 'note': 'Purchases module not available'})


class SupplierBalanceView(APIView):
    """GET /api/supplier-gate/me/balance/ — Supplier's account balance."""
    permission_classes = [IsAuthenticated]

    @require_supplier_portal_access
    def get(self, request):
        contact = request.portal_contact

        try:
            from apps.finance.models import LedgerEntry
            entries = LedgerEntry.objects.filter(
                organization=contact.organization,
                contact_id=contact.id,
            ).order_by('-date').values(
                'id', 'date', 'description', 'debit', 'credit',
            )[:100]
            return Response({'entries': list(entries)})
        except Exception:
            return Response({'entries': [], 'note': 'Finance module not available'})


class SupplierContextsView(APIView):
    """GET /api/supplier-gate/me/contexts/ — List all supplier contexts."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.iam.services.portal_access import get_all_active_accesses

        accesses = get_all_active_accesses(request.user, portal_type='SUPPLIER')
        current_id = request.headers.get('X-Portal-Contact-Id')

        return Response({
            'contexts': [
                {
                    'access_id': a.id,
                    'contact_id': a.contact_id,
                    'contact_name': a.contact.name if a.contact else None,
                    'is_primary': a.is_primary,
                    'is_current': str(a.contact_id) == current_id if current_id else a.is_primary,
                }
                for a in accesses
            ]
        })
