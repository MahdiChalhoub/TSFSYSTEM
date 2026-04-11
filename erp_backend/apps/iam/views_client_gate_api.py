"""
Client Gate — Scoped API Views

Every endpoint here resolves data from the authenticated user's portal context.
NO generic ERP endpoints — all data is scoped via `request.portal_contact`.

Every view uses @require_client_portal_access which:
1. Checks User.account_status == ACTIVE
2. Resolves active ContactPortalAccess
3. Injects request.portal_contact
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.iam.guards import require_client_portal_access
from apps.iam.services import audit


class ClientMeView(APIView):
    """GET /api/client-gate/me/ — Client profile overview."""
    permission_classes = [IsAuthenticated]

    @require_client_portal_access
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
                'can_access_ecommerce': access.can_access_ecommerce,
                'last_portal_login': access.last_portal_login,
            },
        })


class ClientOrdersView(APIView):
    """
    GET /api/client-gate/me/orders/ — Client's own orders.
    Scoped to portal_contact only.
    """
    permission_classes = [IsAuthenticated]

    @require_client_portal_access
    def get(self, request):
        contact = request.portal_contact

        # Resolve orders linked to this contact
        try:
            from apps.sales.models import SalesOrder
            orders = SalesOrder.objects.filter(
                organization=contact.organization,
                customer_id=contact.id,
            ).order_by('-created_at').values(
                'id', 'order_number', 'status', 'total_amount',
                'created_at', 'payment_status',
            )[:50]
            return Response({'orders': list(orders)})
        except Exception:
            # Module may not exist yet
            return Response({'orders': [], 'note': 'Sales module not available'})


class ClientStatementsView(APIView):
    """
    GET /api/client-gate/me/statements/ — Client's account statements.
    Scoped to portal_contact only.
    """
    permission_classes = [IsAuthenticated]

    @require_client_portal_access
    def get(self, request):
        contact = request.portal_contact

        try:
            from apps.finance.models import LedgerEntry
            entries = LedgerEntry.objects.filter(
                organization=contact.organization,
                contact_id=contact.id,
            ).order_by('-date').values(
                'id', 'date', 'description', 'debit', 'credit', 'balance',
            )[:100]
            return Response({'statements': list(entries)})
        except Exception:
            return Response({'statements': [], 'note': 'Finance module not available'})


class ClientPointsView(APIView):
    """
    GET /api/client-gate/me/points/ — Client's loyalty points/tier.
    """
    permission_classes = [IsAuthenticated]

    @require_client_portal_access
    def get(self, request):
        contact = request.portal_contact

        return Response({
            'contact_id': contact.id,
            'points_balance': getattr(contact, 'loyalty_points', 0),
            'tier': getattr(contact, 'tier', None),
            'tier_name': getattr(contact, 'tier_name', None),
        })


class ClientContextsView(APIView):
    """
    GET /api/client-gate/me/contexts/ — List all active client accesses.
    Used when a user represents multiple contacts and needs to switch context.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.iam.services.portal_access import get_all_active_accesses

        accesses = get_all_active_accesses(request.user, portal_type='CLIENT')
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
