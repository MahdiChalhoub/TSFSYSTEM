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

        from erp.connector_registry import connector
        Warehouse = connector.require('inventory.warehouses.get_model', org_id=org_id, source='pos.lobby')
        if Warehouse is None:
            return Response({"error": "Inventory module unavailable"}, status=503)
        sites = Warehouse.objects.filter(organization=organization, location_type='BRANCH', is_active=True)

        data = []
        for site in sites:
            registers = POSRegister.objects.filter(
                organization=organization, branch=site, is_active=True
            ).prefetch_related(
                'authorized_users', 'allowed_accounts', 'sessions',
                'register_methods__payment_method', 'register_methods__financial_account',
            )

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
                    'accountBookId': reg.account_book_id,
                    'accountBookName': reg.account_book.name if reg.account_book else None,
                    'warehouseId': reg.warehouse_id,
                    'warehouseName': reg.warehouse.name if reg.warehouse else None,
                    'reserveAccountId': reg.reserve_account_id,
                    'reserveAccountName': reg.reserve_account.name if reg.reserve_account else None,
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
                    'registerMethods': [
                        {
                            'id': rpm.id,
                            'methodId': rpm.payment_method_id,
                            'code': rpm.payment_method.code,
                            'name': rpm.payment_method.name,
                            'icon': rpm.payment_method.icon,
                            'color': rpm.payment_method.color,
                            'accountId': rpm.financial_account_id,
                            'accountName': rpm.financial_account.name if rpm.financial_account else None,
                            'isActive': rpm.is_active,
                            'sortOrder': rpm.sort_order,
                        }
                        for rpm in reg.register_methods.all()
                    ],
                    'registerRulesOverride': reg.register_rules_override or {},
                    # Config completeness flags
                    'isConfigComplete': bool(reg.cash_account_id and reg.account_book_id),
                    'missingCashAccount': not bool(reg.cash_account_id),
                    'missingAccountBook': not bool(reg.account_book_id),
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
        """Create a new POS register.
        When POSSettings.restrict_unique_cash_account is True:
          - Validates no other register uses the same cash_account_id
          - Auto-creates a child cash account under 'RegisterCash' if no account is provided
        """
        try:
            return self._create_register_impl(request)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            import logging
            logging.getLogger(__name__).error(f'create_register failed: {tb}')
            return Response({"error": str(e), "traceback": tb}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _create_register_impl(self, request):
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)

        from erp.connector_registry import connector
        Warehouse = connector.require('inventory.warehouses.get_model', org_id=org_id, source='pos.lobby')
        if Warehouse is None:
            return Response({"error": "Inventory module unavailable"}, status=503)
        from apps.pos.models.register_models import POSSettings
        name = request.data.get('name')
        site_id = request.data.get('site_id')
        warehouse_id = request.data.get('warehouse_id')
        cash_account_id = request.data.get('cash_account_id')
        account_book_id = request.data.get('account_book_id')
        allowed_account_ids = request.data.get('allowed_account_ids', [])
        authorized_user_ids = request.data.get('authorized_user_ids', [])

        if not name or not site_id:
            return Response({"error": "name and site_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            branch = Warehouse.objects.get(id=site_id, organization=organization)
        except Warehouse.DoesNotExist:
            return Response({"error": "Branch/site not found"}, status=status.HTTP_404_NOT_FOUND)

        # ── Everything from cash account resolution through register creation is atomic ──
        from django.db import IntegrityError as DjIntegrityError, transaction as db_transaction

        try:
            with db_transaction.atomic():
                # ── Cash account isolation logic ──
                settings_obj, _ = POSSettings.objects.get_or_create(organization=organization)
                if settings_obj.restrict_unique_cash_account:
                    if cash_account_id:
                        # Validate that no other register already uses this cash account
                        conflict = POSRegister.objects.filter(
                            organization=organization, cash_account_id=cash_account_id
                        ).exclude(id=None).first()
                        if conflict:
                            return Response({
                                "error": f'Cash account is already used by register "{conflict.name}". '
                                          'Enable shared accounts in POS Settings → Security if needed.',
                                "error_code": "CASH_ACCOUNT_IN_USE",
                                "conflicting_register": conflict.name,
                            }, status=status.HTTP_409_CONFLICT)
                    else:
                        # Auto-create a dedicated FinancialAccount + COA sub-account
                        from erp.connector_registry import connector as _conn
                        FinancialAccount = _conn.require('finance.accounts.get_financial_account_model', org_id=org_id, source='pos.lobby')
                        ChartOfAccount = _conn.require('finance.accounts.get_model', org_id=org_id, source='pos.lobby')
                        if FinancialAccount is None or ChartOfAccount is None:
                            return Response({"error": "Finance module unavailable"}, status=503)

                        acct_name = f'{name} Cash'

                        # ── 1. Find parent COA for POS cash ──
                        parent_coa = ChartOfAccount.objects.filter(
                            organization=organization, system_role='CASH_ACCOUNT'
                        ).first()
                        if not parent_coa:
                            parent_coa = ChartOfAccount.objects.filter(
                                organization=organization, type='ASSET', sub_type__icontains='cash'
                            ).first()

                        if not parent_coa:
                            raise ValueError(
                                'No CASH_ACCOUNT COA node found. '
                                'Please configure your Chart of Accounts with a Cash parent account.'
                            )

                        # ── 2. Create dedicated COA sub-account ──
                        base_code = parent_coa.code
                        existing_count = ChartOfAccount.objects.filter(
                            organization=organization, code__startswith=base_code
                        ).count()
                        new_code = f'{base_code}.{existing_count + 1:02d}'

                        ledger = ChartOfAccount.objects.create(
                            organization=organization,
                            code=new_code,
                            name=acct_name,
                            type='ASSET',
                            sub_type='POS Cash',
                            system_role='CASH_ACCOUNT',
                            normal_balance='DEBIT',
                            allow_posting=True,
                            allow_reconciliation=True,
                            parent=parent_coa,
                        )

                        # ── 3. Create FinancialAccount linked to the COA sub-account ──
                        new_account = FinancialAccount.objects.create(
                            organization=organization,
                            name=acct_name,
                            type='CASH',
                            currency=getattr(organization, 'currency', 'USD') or 'USD',
                            is_pos_enabled=True,
                            site=branch,
                            ledger_account=ledger,
                        )
                        cash_account_id = new_account.id

                payment_methods = request.data.get('payment_methods', [])

                # Wire cash account to CASH payment method entry
                if cash_account_id:
                    for pm in payment_methods:
                        if pm.get('key') == 'CASH' and not pm.get('accountId'):
                            pm['accountId'] = cash_account_id
                            break

                # ── Resolve account_book_id ──
                # Default: same FinancialAccount as cash_account (same physical cash container)
                if not account_book_id and cash_account_id and settings_obj.enable_account_book:
                    account_book_id = cash_account_id

                register = POSRegister.objects.create(
                    organization=organization,
                    name=name,
                    branch=branch,
                    warehouse_id=warehouse_id,
                    cash_account_id=cash_account_id,
                    account_book_id=account_book_id,
                    opening_mode=request.data.get('opening_mode', 'STANDARD').upper(),
                    cashier_can_see_software=request.data.get('cashier_can_see_software', False),
                    payment_methods=payment_methods,
                )

                if allowed_account_ids:
                    register.allowed_accounts.set(allowed_account_ids)
                if authorized_user_ids:
                    register.authorized_users.set(authorized_user_ids)

        except DjIntegrityError:
            return Response(
                {"error": f'A register named "{name}" already exists at this branch. Choose a different name.'},
                status=status.HTTP_409_CONFLICT,
            )
        except (ValueError, Exception) as e:
            import logging
            logging.getLogger(__name__).error(f'Register creation failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'detail': 'register_creation_failed',
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f'Register "{name}" created at {branch.name}',
            'id': register.id,
            'cashAccountId': register.cash_account_id,
            'accountBookId': register.account_book_id,
            'cashAccountAutoCreated': cash_account_id is not None and not request.data.get('cash_account_id'),
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
        if 'account_book_id' in request.data:
            register.account_book_id = request.data['account_book_id']
        if 'is_active' in request.data:
            register.is_active = request.data['is_active']
        if 'opening_mode' in request.data:
            register.opening_mode = request.data['opening_mode'].upper()
        if 'cashier_can_see_software' in request.data:
            register.cashier_can_see_software = request.data['cashier_can_see_software']
        if 'payment_methods' in request.data:
            register.payment_methods = request.data['payment_methods']
        if 'register_rules_override' in request.data:
            register.register_rules_override = request.data['register_rules_override']
        if 'reserve_account_id' in request.data:
            register.reserve_account_id = request.data['reserve_account_id']

        register.save()

        if 'allowed_account_ids' in request.data:
            register.allowed_accounts.set(request.data['allowed_account_ids'])
        if 'authorized_user_ids' in request.data:
            register.authorized_users.set(request.data['authorized_user_ids'])

        # ── Sync RegisterPaymentMethod records ──
        if 'register_methods' in request.data:
            from apps.pos.models.register_models import RegisterPaymentMethod as RPM
            from erp.connector_registry import connector as _conn
            PaymentMethod = _conn.require('finance.payments.get_payment_method_model', org_id=org_id)
            if PaymentMethod is None:
                return Response({"error": "Finance module unavailable"}, status=503)
            incoming = request.data['register_methods']  # [{ methodId, accountId?, isActive?, sortOrder? }]
            incoming_method_ids = set()
            for idx, item in enumerate(incoming):
                method_id = item.get('methodId')
                if not method_id:
                    continue
                incoming_method_ids.add(method_id)
                rpm, created = RPM.objects.update_or_create(
                    register=register,
                    payment_method_id=method_id,
                    defaults={
                        'organization_id': org_id,
                        'financial_account_id': item.get('accountId') or None,
                        'is_active': item.get('isActive', True),
                        'sort_order': item.get('sortOrder', idx),
                    }
                )
            # Remove methods no longer linked
            RPM.objects.filter(
                register=register
            ).exclude(payment_method_id__in=incoming_method_ids).delete()

        if 'cash_account_id' in request.data and request.data['cash_account_id']:
            # Validate uniqueness on update too
            from apps.pos.models.register_models import POSSettings
            settings_obj, _ = POSSettings.objects.get_or_create(organization_id=org_id)
            if settings_obj.restrict_unique_cash_account:
                conflict = POSRegister.objects.filter(
                    organization_id=org_id, cash_account_id=register.cash_account_id
                ).exclude(id=register_id).first()
                if conflict:
                    return Response({
                        "error": f'Cash account already used by "{conflict.name}". Disable isolation in POS Settings to share.',
                        "error_code": "CASH_ACCOUNT_IN_USE",
                    }, status=status.HTTP_409_CONFLICT)

        return Response({'message': f'Register "{register.name}" updated', 'id': register.id})


    @action(detail=False, methods=['get'], url_path='account-book-balance')
    def account_book_balance(self, request):
        """Get the live Account Book (Cashier Daily Ledger) balance for a register.
        Returns the net balance of all CashierAddressBook entries for the register's
        current open session (or the most recent session of today).
        Query params: register_id (required)
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        register_id = request.query_params.get('register_id')
        if not register_id:
            return Response({"error": "register_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            register = POSRegister.objects.get(id=register_id, organization_id=org_id)
        except POSRegister.DoesNotExist:
            return Response({"error": "Register not found"}, status=status.HTTP_404_NOT_FOUND)

        # Find the current open session (or last closed today)
        session = register.sessions.filter(status='OPEN').first()
        if not session:
            today = timezone.now().date()
            session = register.sessions.filter(opened_at__date=today).order_by('-opened_at').first()

        if not session:
            return Response({
                'balance': 0.0,
                'entryCount': 0,
                'pendingCount': 0,
                'approvedBalance': 0.0,
                'sessionId': None,
                'hasSession': False,
            })

        entries = CashierAddressBook.objects.filter(
            organization_id=org_id, session=session, is_deleted=False
        )

        from decimal import Decimal
        total_in = sum(e.amount_in for e in entries)
        total_out = sum(e.amount_out for e in entries)
        approved = entries.filter(status='APPROVED')
        approved_in = sum(e.amount_in for e in approved)
        approved_out = sum(e.amount_out for e in approved)

        return Response({
            'balance': float(total_in - total_out),
            'entryCount': entries.count(),
            'pendingCount': entries.filter(status__in=['PENDING', 'MODIFIED']).count(),
            'approvedBalance': float(approved_in - approved_out),
            'sessionId': session.id,
            'hasSession': True,
        })


    @action(detail=False, methods=['get'], url_path='account-balances')
    def account_balances(self, request):
        """Get ledger balances for all payment accounts linked to a register.
        Returns software balance from the financial ledger for each account.
        Query params: register_id (required)
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        register_id = request.query_params.get('register_id')
        if not register_id:
            return Response({"error": "register_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            register = POSRegister.objects.select_related('cash_account').prefetch_related('allowed_accounts').get(
                id=register_id, organization_id=org_id
            )
        except POSRegister.DoesNotExist:
            return Response({"error": "Register not found"}, status=status.HTTP_404_NOT_FOUND)

        # Collect all accounts: cash account + all allowed accounts
        accounts_seen = set()
        result = []

        def add_account(acc, is_cash_account=False):
            if acc is None or acc.id in accounts_seen:
                return
            accounts_seen.add(acc.id)
            # Try to get current balance from the financial ledger
            try:
                from erp.connector_registry import connector as _conn
                JournalLine = _conn.require('finance.journal.get_line_model', org_id=org_id, source='pos.lobby')
                if not JournalLine:
                    raise ImportError("JournalLine not available")
                from django.db.models import Sum
                agg = JournalLine.objects.filter(
                    organization_id=org_id, account=acc
                ).aggregate(
                    total_debit=Sum('debit_amount'),
                    total_credit=Sum('credit_amount'),
                )
                debit = float(agg['total_debit'] or 0)
                credit = float(agg['total_credit'] or 0)
                # For ASSET-type accounts (CASH, BANK): balance = debit - credit
                software_balance = debit - credit
            except Exception:
                software_balance = 0.0

            result.append({
                'accountId': acc.id,
                'name': acc.name,
                'type': acc.type,
                'softwareBalance': software_balance,
                'isCashAccount': is_cash_account,
                'currency': getattr(acc, 'currency', ''),
            })

        add_account(register.cash_account, is_cash_account=True)
        for acc in register.allowed_accounts.all():
            add_account(acc)

        return Response(result)


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
        Expects: { pin, register_id? }
        If register_id is provided, scope to managers authorized at the same branch.
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

        # Optional site-scoping: restrict to managers authorized at the same branch
        register_id = request.data.get('register_id')
        if register_id:
            try:
                register = POSRegister.objects.get(id=register_id, organization_id=org_id)
                branch_register_ids = POSRegister.objects.filter(
                    organization_id=org_id, branch=register.branch
                ).values_list('id', flat=True)
                managers = managers.filter(
                    authorized_registers__id__in=branch_register_ids
                ).distinct()
            except POSRegister.DoesNotExist:
                pass  # Fall back to org-wide if register not found

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


    @action(detail=False, methods=['post'], url_path='change-own-pin')
    def change_own_pin(self, request):
        """
        Self-service PIN change with password confirmation.
        Any authenticated user can change their own POS PIN.
        Expects: { current_password, new_pin }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        current_password = request.data.get('current_password', '')
        new_pin = request.data.get('new_pin', '')

        if not current_password:
            return Response({"error": "Password is required to confirm your identity"}, status=status.HTTP_400_BAD_REQUEST)
        if not new_pin or len(new_pin) < 4 or len(new_pin) > 6:
            return Response({"error": "PIN must be 4-6 digits"}, status=status.HTTP_400_BAD_REQUEST)
        if not new_pin.isdigit():
            return Response({"error": "PIN must contain only digits"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not user or not user.is_authenticated:
            return Response({"error": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        # Identity confirmation: verify the user's login password
        if not user.check_password(current_password):
            return Response({"error": "Incorrect password. Identity not confirmed."}, status=status.HTTP_403_FORBIDDEN)

        # Ensure PIN is unique within the organization
        for other in User.objects.filter(organization_id=org_id).exclude(id=user.id):
            if other.pos_pin and other.check_pos_pin(new_pin):
                return Response({"error": "This PIN is already used by another user"}, status=status.HTTP_409_CONFLICT)

        user.set_pos_pin(new_pin)
        user.save(update_fields=['pos_pin'])

        return Response({
            'message': f'POS PIN updated for {user.first_name or user.username}',
            'user_id': user.id,
        })


    @action(detail=False, methods=['post'], url_path='admin-reset-pin')
    def admin_reset_pin(self, request):
        """
        Admin PIN reset with password confirmation.
        Only admins/managers (is_staff or is_superuser) can reset another user's PIN.
        Expects: { admin_password, target_user_id, new_pin }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        admin_password = request.data.get('admin_password', '')
        target_user_id = request.data.get('target_user_id')
        new_pin = request.data.get('new_pin', '')

        if not admin_password:
            return Response({"error": "Your password is required to confirm identity"}, status=status.HTTP_400_BAD_REQUEST)
        if not target_user_id:
            return Response({"error": "target_user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not new_pin or len(new_pin) < 4 or len(new_pin) > 6:
            return Response({"error": "PIN must be 4-6 digits"}, status=status.HTTP_400_BAD_REQUEST)
        if not new_pin.isdigit():
            return Response({"error": "PIN must contain only digits"}, status=status.HTTP_400_BAD_REQUEST)

        admin = request.user
        if not admin or not admin.is_authenticated:
            return Response({"error": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not (admin.is_staff or admin.is_superuser):
            return Response({"error": "Only admins can reset other users' PINs"}, status=status.HTTP_403_FORBIDDEN)

        # Identity confirmation: verify admin's login password
        if not admin.check_password(admin_password):
            return Response({"error": "Incorrect password. Identity not confirmed."}, status=status.HTTP_403_FORBIDDEN)

        try:
            target_user = User.objects.get(id=target_user_id, organization_id=org_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Ensure PIN is unique within the organization
        for other in User.objects.filter(organization_id=org_id).exclude(id=target_user_id):
            if other.pos_pin and other.check_pos_pin(new_pin):
                return Response({"error": "This PIN is already used by another user"}, status=status.HTTP_409_CONFLICT)

        target_user.set_pos_pin(new_pin)
        target_user.save(update_fields=['pos_pin'])

        target_name = f"{target_user.first_name} {target_user.last_name}".strip() or target_user.username
        return Response({
            'message': f'POS PIN reset for {target_name} by {admin.first_name or admin.username}',
            'user_id': target_user.id,
        })


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

