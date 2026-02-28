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



class RegisterLobbyMixin:

    @action(detail=False, methods=['get'], url_path='lobby')
    def lobby(self, request):
        """
        Returns the full lobby data: sites → registers → sessions.
        This is the entry point for the POS Lobby UI.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)

        from apps.inventory.models import Warehouse
        sites = Warehouse.objects.filter(organization=organization, location_type='BRANCH', is_active=True)

        data = []
        for site in sites:
            registers = POSRegister.objects.filter(
                organization=organization, branch=site, is_active=True
            ).prefetch_related('authorized_users', 'allowed_accounts', 'sessions')

            register_data = []
            for reg in registers:
                current_session = reg.sessions.filter(status='OPEN').first()
                register_data.append({
                    'id': reg.id,
                    'name': reg.name,
                    'isOpen': current_session is not None,
                    'currentSession': {
                        'id': current_session.id,
                        'cashierId': current_session.cashier_id,
                        'cashierName': f"{current_session.cashier.first_name} {current_session.cashier.last_name}".strip() if current_session.cashier else '',
                        'openedAt': str(current_session.opened_at),
                        'openingBalance': float(current_session.opening_balance),
                    } if current_session else None,
                    'cashAccountId': reg.cash_account_id,
                    'cashAccountName': reg.cash_account.name if reg.cash_account else None,
                    'warehouseId': reg.warehouse_id,
                    'warehouseName': reg.warehouse.name if reg.warehouse else None,
                    'allowedAccounts': [
                        {'id': acc.id, 'name': acc.name, 'type': acc.type}
                        for acc in reg.allowed_accounts.all()
                    ],
                    'authorizedUsers': [
                        {
                            'id': u.id,
                            'name': f"{u.first_name} {u.last_name}".strip() or u.username,
                            'username': u.username,
                            'hasPin': bool(u.pos_pin),
                        }
                        for u in reg.authorized_users.all()
                    ],
                    'openingMode': reg.opening_mode.lower(),
                    'cashierCanSeeSoftware': reg.cashier_can_see_software,
                    'paymentMethods': reg.payment_methods or [],
                })

            data.append({
                'id': site.id,
                'name': site.name,
                'code': site.code,
                'address': site.address or '',
                'registers': register_data,
            })

        return Response(data)


    # ── CRUD for registers ──

    @action(detail=False, methods=['get'])
    def list_registers(self, request):
        """List all registers, optionally filtered by site."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        site_id = request.query_params.get('site_id')
        qs = POSRegister.objects.filter(organization_id=org_id)
        if site_id:
            qs = qs.filter(branch_id=site_id)

        return Response([{
            'id': r.id,
            'name': r.name,
            'siteId': r.branch_id,
            'siteName': r.branch.name if r.branch else '',
            'warehouseId': r.warehouse_id,
            'cashAccountId': r.cash_account_id,
            'isActive': r.is_active,
            'isOpen': r.is_open,
        } for r in qs.select_related('branch')])


    @action(detail=False, methods=['post'], url_path='create-register')
    def create_register(self, request):
        """Create a new POS register."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)

        from apps.inventory.models import Warehouse
        name = request.data.get('name')
        site_id = request.data.get('site_id')
        warehouse_id = request.data.get('warehouse_id')
        cash_account_id = request.data.get('cash_account_id')
        allowed_account_ids = request.data.get('allowed_account_ids', [])
        authorized_user_ids = request.data.get('authorized_user_ids', [])

        if not name or not site_id:
            return Response({"error": "name and site_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            branch = Warehouse.objects.get(id=site_id, organization=organization)
        except Warehouse.DoesNotExist:
            return Response({"error": "Branch/site not found"}, status=status.HTTP_404_NOT_FOUND)

        register = POSRegister.objects.create(
            organization=organization,
            name=name,
            branch=branch,
            warehouse_id=warehouse_id,
            cash_account_id=cash_account_id,
            opening_mode=request.data.get('opening_mode', 'STANDARD').upper(),
            cashier_can_see_software=request.data.get('cashier_can_see_software', False),
            payment_methods=request.data.get('payment_methods', []),
        )

        if allowed_account_ids:
            register.allowed_accounts.set(allowed_account_ids)
        if authorized_user_ids:
            register.authorized_users.set(authorized_user_ids)

        return Response({
            'message': f'Register "{name}" created at {branch.name}',
            'id': register.id,
        }, status=status.HTTP_201_CREATED)


    @action(detail=False, methods=['post'], url_path='update-register')
    def update_register(self, request):
        """Update an existing POS register."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        register_id = request.data.get('id')
        try:
            register = POSRegister.objects.get(id=register_id, organization_id=org_id)
        except POSRegister.DoesNotExist:
            return Response({"error": "Register not found"}, status=status.HTTP_404_NOT_FOUND)

        if 'name' in request.data:
            register.name = request.data['name']
        if 'warehouse_id' in request.data:
            register.warehouse_id = request.data['warehouse_id']
        if 'cash_account_id' in request.data:
            register.cash_account_id = request.data['cash_account_id']
        if 'is_active' in request.data:
            register.is_active = request.data['is_active']
        if 'opening_mode' in request.data:
            register.opening_mode = request.data['opening_mode'].upper()
        if 'cashier_can_see_software' in request.data:
            register.cashier_can_see_software = request.data['cashier_can_see_software']
        if 'payment_methods' in request.data:
            register.payment_methods = request.data['payment_methods']

        register.save()

        if 'allowed_account_ids' in request.data:
            register.allowed_accounts.set(request.data['allowed_account_ids'])
        if 'authorized_user_ids' in request.data:
            register.authorized_users.set(request.data['authorized_user_ids'])

        return Response({'message': f'Register "{register.name}" updated', 'id': register.id})


    @action(detail=False, methods=['post'], url_path='verify-pin')
    def verify_pin(self, request):
        """
        Verify a cashier's PIN code.
        Expects: { register_id, pin, user_id? }
        If user_id is provided, validates only that user's PIN.
        Otherwise checks all authorized users (backwards compat).
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        register_id = request.data.get('register_id')
        pin = request.data.get('pin', '')
        user_id = request.data.get('user_id')  # optional: validate a specific user

        if not register_id or not pin:
            return Response({"error": "register_id and pin are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            register = POSRegister.objects.get(id=register_id, organization_id=org_id)
        except POSRegister.DoesNotExist:
            return Response({"error": "Register not found"}, status=status.HTTP_404_NOT_FOUND)

        # If a specific user is requested, validate only them
        if user_id:
            try:
                user = register.authorized_users.get(id=user_id)
            except Exception:
                return Response({'valid': False, 'error': 'User not authorized for this register'}, status=status.HTTP_401_UNAUTHORIZED)
            if user.check_pos_pin(pin):
                return Response({
                    'valid': True,
                    'user': {
                        'id': user.id,
                        'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                        'username': user.username,
                    }
                })
            return Response({'valid': False, 'error': 'Incorrect PIN'}, status=status.HTTP_401_UNAUTHORIZED)

        # Fallback: check all authorized users (original behaviour)
        for user in register.authorized_users.all():
            if user.check_pos_pin(pin):
                return Response({
                    'valid': True,
                    'user': {
                        'id': user.id,
                        'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                        'username': user.username,
                    }
                })

        return Response({'valid': False, 'error': 'Invalid PIN'}, status=status.HTTP_401_UNAUTHORIZED)


    @action(detail=False, methods=['post'], url_path='set-pin')
    def set_pin(self, request):
        """
        Set a POS PIN for a user.
        Expects: { user_id, pin }
        Only admins or the user themselves can set.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.data.get('user_id')
        pin = request.data.get('pin', '')

        if not pin or len(pin) < 4 or len(pin) > 6:
            return Response({"error": "PIN must be 4-6 digits"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id, organization_id=org_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Ensure PIN is unique within the organization
        for other_user in User.objects.filter(organization_id=org_id).exclude(id=user_id):
            if other_user.pos_pin and other_user.check_pos_pin(pin):
                return Response({"error": "This PIN is already used by another user"}, status=status.HTTP_409_CONFLICT)

        user.set_pos_pin(pin)
        user.save(update_fields=['pos_pin'])

        return Response({
            'message': f'POS PIN set for {user.first_name or user.username}',
            'user_id': user.id
        })


    @action(detail=False, methods=['post'], url_path='verify-manager')
    def verify_manager(self, request):
        """
        Verify a manager's PIN code for overrides (Clear Cart, Price Override, etc).
        Managers are defined as users with is_staff=True or explicit permission.
        Expects: { pin }
        Returns: { valid: True, user: ... }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        pin = request.data.get('pin', '')
        if not pin:
            return Response({"error": "PIN is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Find any active staff user in this org with a matching PIN
        managers = User.objects.filter(organization_id=org_id, is_active=True, is_staff=True).exclude(pos_pin__isnull=True).exclude(pos_pin='')
        
        for manager in managers:
            if manager.check_pos_pin(pin):
                return Response({
                    'valid': True,
                    'user': {
                        'id': manager.id,
                        'name': f"{manager.first_name} {manager.last_name}".strip() or manager.username,
                        'username': manager.username,
                    }
                })

        return Response({'valid': False, 'error': 'Invalid Manager PIN'}, status=status.HTTP_401_UNAUTHORIZED)


    @action(detail=False, methods=['post'], url_path='set-override-pin')
    def set_override_pin(self, request):
        """
        Set a manager override PIN for a user.
        Expects: { user_id, pin }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.data.get('user_id')
        pin = request.data.get('pin', '')

        if not pin or len(pin) < 4 or len(pin) > 6:
            return Response({"error": "PIN must be 4-6 digits"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id, organization_id=org_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        user.set_override_pin(pin)
        user.save(update_fields=['override_pin'])

        return Response({
            'message': f'Override PIN set for {user.first_name or user.username}',
            'user_id': user.id
        })


    @action(detail=False, methods=['post'], url_path='verify-override')
    def verify_override(self, request):
        """
        Verify a manager override PIN.
        Expects: { pin }
        Checks against all users in the org who have an override_pin set.
        Returns the manager's name if valid.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        pin = request.data.get('pin', '')
        if not pin or len(pin) < 4:
            return Response({"valid": False, "error": "PIN must be at least 4 digits"}, status=status.HTTP_400_BAD_REQUEST)

        # Check against all users with override PINs in this org
        managers = User.objects.filter(organization_id=org_id).exclude(override_pin__isnull=True).exclude(override_pin='')
        for user in managers:
            if user.check_override_pin(pin):
                return Response({
                    'valid': True,
                    'manager_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'manager_id': user.id,
                })

        return Response({'valid': False, 'error': 'Invalid manager PIN'}, status=status.HTTP_401_UNAUTHORIZED)


    @action(detail=False, methods=['patch'], url_path='toggle-driver')
    def toggle_driver(self, request):
        """Toggle is_driver flag on a user. Expects: { user_id, is_driver: bool }"""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.data.get('user_id')
        is_driver = request.data.get('is_driver', False)

        try:
            user = User.objects.get(id=user_id, organization_id=org_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        user.is_driver = bool(is_driver)
        user.save(update_fields=['is_driver'])
        return Response({
            'message': f"{user.first_name or user.username} {'tagged' if is_driver else 'untagged'} as driver",
            'user_id': user.id,
            'is_driver': user.is_driver,
        })

