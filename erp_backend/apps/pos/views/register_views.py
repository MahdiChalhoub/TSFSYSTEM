"""
POS Register management views.
Handles register CRUD, session open/close, PIN authentication, and lobby data.
"""
from .base import (
    viewsets, status, Response, action, get_current_tenant_id,
    Organization, User, Warehouse, timezone
)
from django.db.models import Sum, Count, Q
from decimal import Decimal

from apps.pos.models import POSRegister, RegisterSession, Order, CashierAddressBook
from apps.pos.models.register_models import SessionAccountReconciliation



from .register_lobby import RegisterLobbyMixin
from .register_session import RegisterSessionMixin
from .register_order import RegisterOrderMixin
from .register_address_book import RegisterAddressBookMixin

class POSRegisterViewSet(RegisterLobbyMixin, RegisterSessionMixin, RegisterOrderMixin, RegisterAddressBookMixin, viewsets.ModelViewSet):

    """Manages POS registers and sessions."""

    @action(detail=False, methods=['get', 'patch'], url_path='pos-settings')
    def pos_settings(self, request):
        """Read or update the POSSettings for this organisation.
        GET → returns all settings fields.
        PATCH → updates provided fields only.
        """
        from apps.pos.models.register_models import POSSettings
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)
        settings_obj, _ = POSSettings.objects.get_or_create(organization=organization)

        if request.method == 'GET':
            return Response({
                'restrict_unique_cash_account': settings_obj.restrict_unique_cash_account,
                'allow_negative_stock': settings_obj.allow_negative_stock,
                'require_driver_pos_code': settings_obj.require_driver_pos_code,
                'require_client_delivery_code': settings_obj.require_client_delivery_code,
                'sms_delivery_code_enabled': settings_obj.sms_delivery_code_enabled,
                'loyalty_point_value': float(settings_obj.loyalty_point_value),
                'loyalty_earn_rate': float(settings_obj.loyalty_earn_rate),
            })

        # PATCH — update only provided fields
        PATCHABLE = [
            'restrict_unique_cash_account', 'allow_negative_stock',
            'require_driver_pos_code', 'require_client_delivery_code',
        ]
        updated = []
        for field in PATCHABLE:
            if field in request.data:
                setattr(settings_obj, field, request.data[field])
                updated.append(field)
        if updated:
            settings_obj.save(update_fields=updated)
        return Response({'message': 'POS settings updated', 'updated_fields': updated})


