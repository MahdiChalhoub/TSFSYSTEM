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
