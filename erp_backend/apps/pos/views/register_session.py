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



class RegisterSessionMixin:

    @action(detail=False, methods=['post'], url_path='open-session')
    def open_session(self, request):
        """
        Open a new register session (start shift).
        Standard mode: { register_id, cashier_id, opening_balance, notes? }
        Advanced mode: { register_id, cashier_id, opening_mode: 'advanced',
                         account_reconciliations: [{ account_id, software_amount, statement_amount }],
                         cash_counted, address_book_balance?, notes? }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)

        register_id = request.data.get('register_id')
        cashier_id = request.data.get('cashier_id')
        opening_mode = request.data.get('opening_mode', 'standard')
        notes = request.data.get('notes', '')
        force_close = request.data.get('force_close', False)          # manager force-close flag
        override_pin = request.data.get('override_pin', '')           # manager override PIN

        try:
            register = POSRegister.objects.get(id=register_id, organization=organization)
        except POSRegister.DoesNotExist:
            return Response({"error": "Register not found"}, status=status.HTTP_404_NOT_FOUND)

        # ── GUARD 1: Fiscal year must be open ──
        from apps.finance.models import FiscalYear
        has_open_fy = FiscalYear.objects.filter(
            organization=organization,
            is_closed=False
        ).exists()
        if not has_open_fy:
            return Response({
                "error": "No open fiscal year",
                "error_code": "NO_FISCAL_YEAR",
                "message": "You must open a financial year before using the POS register. Go to Finance → Fiscal Years to open one."
            }, status=status.HTTP_403_FORBIDDEN)

        # ── GUARD 2: Register must have payment accounts configured ──
        # The JSON payment_methods list must have at least one entry with accountId
        reg_methods = register.payment_methods or []
        has_linked_method = any(m.get('accountId') for m in reg_methods)

        if not has_linked_method:
            return Response({
                "error": "No payment accounts configured",
                "error_code": "NO_PAYMENT_ACCOUNTS",
                "message": "This register has no payment methods linked to financial accounts. Configure payment methods in POS Settings → Registers before opening."
            }, status=status.HTTP_403_FORBIDDEN)

        # ── GUARD 3: Open session conflict ──
        existing_session = register.sessions.filter(status='OPEN').first()
        if existing_session:
            if force_close and override_pin:
                # Verify manager override PIN
                managers = User.objects.filter(organization_id=org_id).exclude(
                    override_pin__isnull=True).exclude(override_pin='')
                authorized_manager = None
                for mgr in managers:
                    if mgr.check_override_pin(override_pin):
                        authorized_manager = mgr
                        break
                if not authorized_manager:
                    return Response({
                        "error": "Invalid manager override PIN",
                        "error_code": "INVALID_OVERRIDE_PIN",
                    }, status=status.HTTP_401_UNAUTHORIZED)
                # Force-close the existing session
                from datetime import datetime, timezone as dt_tz
                existing_session.status = 'FORCE_CLOSED'
                existing_session.close_notes = f"Force closed by manager {authorized_manager.first_name or authorized_manager.username} to open new session"
                existing_session.closed_at = datetime.now(dt_tz.utc)
                existing_session.save(update_fields=['status', 'close_notes', 'closed_at'])
            else:
                # Return who has the register open so frontend can show the right message
                current_cashier = existing_session.cashier
                cashier_name = f"{current_cashier.first_name} {current_cashier.last_name}".strip() or current_cashier.username
                return Response({
                    "error": "Register is already open",
                    "error_code": "SESSION_OPEN",
                    "current_cashier": cashier_name,
                    "current_session_id": existing_session.id,
                    "message": f"This register is currently in use by {cashier_name}. Ask them to close their session first, or use a manager override PIN to force-close."
                }, status=status.HTTP_409_CONFLICT)

        try:
            cashier = User.objects.get(id=cashier_id, organization=organization)
        except User.DoesNotExist:
            return Response({"error": "Cashier not found"}, status=status.HTTP_404_NOT_FOUND)


        if opening_mode == 'advanced':
            # ── Advanced mode: full reconciliation ──
            account_recons = request.data.get('account_reconciliations', [])
            cash_counted = Decimal(str(request.data.get('cash_counted', 0)))
            address_book_bal = Decimal(str(request.data.get('address_book_balance', 0)))

            # Calculate calibration: electronic wallets are source of truth
            total_calibration = Decimal('0')
            recon_data = {}
            for ar in account_recons:
                sw = Decimal(str(ar.get('software_amount', 0)))
                st = Decimal(str(ar.get('statement_amount', 0)))
                diff = sw - st  # positive = over-recorded in software
                calibration = -diff  # move from/to cash to compensate
                recon_data[str(ar['account_id'])] = {
                    'software': float(sw),
                    'statement': float(st),
                    'diff': float(diff),
                    'calibration': float(calibration),
                }
                total_calibration += calibration

            # Cash expected = whatever software says + calibration adjustments
            cash_software = Decimal(str(request.data.get('cash_software', 0)))
            cash_expected = cash_software + total_calibration
            cash_diff = cash_counted - cash_expected

            session = RegisterSession.objects.create(
                organization=organization,
                register=register,
                cashier=cashier,
                opening_balance=cash_counted,
                opening_notes=notes,
                status='OPEN',
                reconciliation_data=recon_data,
                address_book_balance=address_book_bal,
                cash_counted=cash_counted,
                cash_expected=cash_expected,
                cash_difference=cash_diff,
            )

            # Create per-account reconciliation records
            from apps.finance.models import FinancialAccount
            for ar in account_recons:
                try:
                    account = FinancialAccount.objects.get(id=ar['account_id'], organization=organization)
                    sw = Decimal(str(ar.get('software_amount', 0)))
                    st = Decimal(str(ar.get('statement_amount', 0)))
                    diff = sw - st
                    SessionAccountReconciliation.objects.create(
                        organization=organization,
                        session=session,
                        account=account,
                        software_amount=sw,
                        statement_amount=st,
                        difference=diff,
                        calibrated_to_cash=-diff,
                        is_controlled=account.type != 'CASH',
                    )
                except FinancialAccount.DoesNotExist:
                    pass

        else:
            # ── Standard mode: simple opening balance ──
            opening_balance = Decimal(str(request.data.get('opening_balance', 0)))
            session = RegisterSession.objects.create(
                organization=organization,
                register=register,
                cashier=cashier,
                opening_balance=opening_balance,
                opening_notes=notes,
                status='OPEN'
            )

        return Response({
            'message': f'Register "{register.name}" opened by {cashier.first_name or cashier.username}',
            'session_id': session.id,
            'register_id': register.id,
            'register_name': register.name,
            'cashier_name': f"{cashier.first_name} {cashier.last_name}".strip(),
            'opened_at': str(session.opened_at),
            'opening_balance': float(session.opening_balance),
            'opening_mode': opening_mode,
            'warehouse_id': register.warehouse_id,
            'cash_account_id': register.cash_account_id,
            'allowed_accounts': [
                {'id': acc.id, 'name': acc.name, 'type': acc.type}
                for acc in register.allowed_accounts.all()
            ],
        }, status=status.HTTP_201_CREATED)


    @action(detail=False, methods=['post'], url_path='close-session')
    def close_session(self, request):
        """
        Close a register session (end shift).
        Expects: { session_id, closing_balance, notes? }
        Auto-calculates expected balance and difference.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)

        session_id = request.data.get('session_id')
        closing_balance = Decimal(str(request.data.get('closing_balance', 0)))
        notes = request.data.get('notes', '')

        try:
            session = RegisterSession.objects.select_related('register', 'cashier').get(
                id=session_id, organization=organization, status='OPEN'
            )
        except RegisterSession.DoesNotExist:
            return Response({"error": "Open session not found"}, status=status.HTTP_404_NOT_FOUND)

        # Calculate session totals from orders made during this session
        session_orders = Order.objects.filter(
            organization=organization,
            site=session.register.branch,
            user=session.cashier,
            type='SALE',
            status='COMPLETED',
            created_at__gte=session.opened_at,
        )

        totals = session_orders.aggregate(
            total_sales=Sum('total_amount'),
            total_count=Count('id'),
        )

        # ── Per-payment-method breakdown ──
        method_agg = session_orders.values('payment_method').annotate(
            subtotal=Sum('total_amount'),
            count=Count('id'),
        )

        payment_breakdown = []
        total_cash_in = Decimal('0')
        for row in method_agg:
            method = row['payment_method'] or 'UNKNOWN'
            subtotal = Decimal(str(row['subtotal'] or 0))
            payment_breakdown.append({
                'method': method,
                'label': method.replace('_', ' ').title(),
                'total': float(subtotal),
                'count': row['count'] or 0,
            })
            if method == 'CASH':
                total_cash_in = subtotal

        # ── Address Book Balance ──
        address_book_entries = CashierAddressBook.objects.filter(
            organization=organization,
            session=session,
            is_deleted=False
        )
        ab_in = address_book_entries.filter(direction='IN').aggregate(Sum('amount_in'))['amount_in__sum'] or Decimal('0')
        ab_out = address_book_entries.filter(direction='OUT').aggregate(Sum('amount_out'))['amount_out__sum'] or Decimal('0')
        address_book_net = ab_in - ab_out

        total_sales = totals['total_sales'] or Decimal('0')
        total_transactions = totals['total_count'] or 0
        expected = session.opening_balance + total_cash_in + address_book_net
        difference = closing_balance - expected

        # ── Auto-create Variance Entries (Phase 4) ──
        if difference != 0:
            variance_type = 'CASH_OVERAGE' if difference > 0 else 'CASH_SHORTAGE'
            variance_amount = abs(difference)
            
            variance_entry = CashierAddressBook.objects.create(
                organization=organization,
                session=session,
                cashier=session.cashier,
                entry_type=variance_type,
                description=f"Auto-generated {'overage' if difference > 0 else 'shortage'} from register close (Expected: {expected}, Actual: {closing_balance})",
                amount_in=variance_amount if variance_type == 'CASH_OVERAGE' else Decimal('0'),
                amount_out=variance_amount if variance_type == 'CASH_SHORTAGE' else Decimal('0'),
                status='APPROVED' if variance_type == 'CASH_OVERAGE' else 'PENDING',
            )
            # If overage, immediately execute to post to GL
            if variance_type == 'CASH_OVERAGE':
                try:
                    from apps.pos.services.address_book_executor import AddressBookExecutor
                    maker = request.user if not request.user.is_anonymous else session.cashier
                    AddressBookExecutor.execute(variance_entry, manager=maker)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to auto-execute cash overage entry: {e}", exc_info=True)

        # ── Trigger Daily Snapshot (Phase 5) ──
        try:
            from apps.pos.models.register_models import DailyAddressBookSnapshot
            from apps.pos.views.register_address_book import serialize_entry
            
            # Fetch fresh entries (including the new variance)
            snapshot_entries = CashierAddressBook.objects.filter(
                organization=organization, session=session, is_deleted=False
            ).select_related('cashier', 'approved_by').order_by('created_at')
            
            running = Decimal('0.00')
            entries_data = []
            for e in snapshot_entries:
                running += e.amount_in - e.amount_out
                entries_data.append(serialize_entry(e, running))
                
            today = timezone.now().date()
            sn_in = sum(e['amountIn'] for e in entries_data)
            sn_out = sum(e['amountOut'] for e in entries_data)
            
            snapshot, _ = DailyAddressBookSnapshot.objects.update_or_create(
                organization=organization,
                session=session,
                date=today,
                defaults={
                    'register': session.register,
                    'cashier': session.cashier,
                    'total_in': Decimal(str(sn_in)),
                    'total_out': Decimal(str(sn_out)),
                    'balance': Decimal(str(sn_in - sn_out)),
                    'pending_count': sum(1 for e in entries_data if e['status'] == 'PENDING'),
                    'approved_count': sum(1 for e in entries_data if e['status'] == 'APPROVED'),
                    'rejected_count': sum(1 for e in entries_data if e['status'] == 'REJECTED'),
                    'entries_json': entries_data,
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to create daily snapshot on register close: {e}", exc_info=True)

        # Update session
        session.status = 'CLOSED'
        session.closed_at = timezone.now()
        session.closed_by = request.user if not request.user.is_anonymous else session.cashier
        session.closing_balance = closing_balance
        session.expected_balance = expected
        session.difference = difference
        session.closing_notes = notes
        session.total_sales = total_sales
        session.total_transactions = total_transactions
        session.total_cash_in = total_cash_in
        session.save()

        # Duration
        duration_secs = int((session.closed_at - session.opened_at).total_seconds())
        hours = duration_secs // 3600
        minutes = (duration_secs % 3600) // 60
        duration_str = f"{hours}h {minutes}m"

        return Response({
            'message': f'Register "{session.register.name}" closed',
            'session_id': session.id,
            'report': {
                'registerName': session.register.name,
                'siteName': session.register.site.name if session.register.site_id else '',
                'cashierName': f"{session.cashier.first_name} {session.cashier.last_name}".strip() if session.cashier else '',
                'openedAt': session.opened_at.isoformat(),
                'closedAt': session.closed_at.isoformat(),
                'duration': duration_str,
                'openingBalance': float(session.opening_balance),
                'closingBalance': float(closing_balance),
                'expectedBalance': float(expected),
                'difference': float(difference),
                'totalSales': float(total_sales),
                'totalTransactions': total_transactions,
                'totalCashIn': float(total_cash_in),
                'paymentBreakdown': payment_breakdown,
            }
        })


    @action(detail=False, methods=['get'], url_path='session-status')
    def session_status(self, request):
        """
        Get the current status of all open sessions (for the status board).
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        open_sessions = RegisterSession.objects.filter(
            organization_id=org_id, status='OPEN'
        ).select_related('register', 'register__site', 'cashier')

        data = []
        for s in open_sessions:
            # Live sales count since session opened
            live_orders = Order.objects.filter(
                organization_id=org_id,
                site=s.register.site,
                user=s.cashier,
                type='SALE',
                status='COMPLETED',
                created_at__gte=s.opened_at,
            ).aggregate(count=Count('id'), total=Sum('total_amount'))

            data.append({
                'sessionId': s.id,
                'registerId': s.register.id,
                'registerName': s.register.name,
                'siteName': s.register.site.name,
                'cashierName': f"{s.cashier.first_name} {s.cashier.last_name}".strip() if s.cashier else '',
                'openedAt': str(s.opened_at),
                'openingBalance': float(s.opening_balance),
                'liveSalesCount': live_orders['count'] or 0,
                'liveSalesTotal': float(live_orders['total'] or 0),
                'duration': str(timezone.now() - s.opened_at),
            })

        return Response(data)


    @action(detail=False, methods=['get'], url_path='session-history')
    def session_history(self, request):
        """
        Paginated history of all closed register sessions for this org.
        Supports: ?register_id=, ?limit=, ?offset=, ?cashier_id=
        Returns each session with its payment breakdown.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        qs = RegisterSession.objects.filter(
            organization_id=org_id,
            status__in=['CLOSED', 'FORCE_CLOSED']
        ).select_related('register', 'register__site', 'cashier', 'closed_by').order_by('-opened_at')

        # Filters
        register_id = request.query_params.get('register_id')
        if register_id:
            qs = qs.filter(register_id=register_id)
        cashier_id = request.query_params.get('cashier_id')
        if cashier_id:
            qs = qs.filter(cashier_id=cashier_id)

        limit = int(request.query_params.get('limit', 30))
        offset = int(request.query_params.get('offset', 0))
        total = qs.count()
        sessions = list(qs[offset:offset + limit])

        data = []
        for s in sessions:
            # Per-method breakdown from orders during that session
            session_orders = Order.objects.filter(
                organization_id=org_id,
                site=s.register.site,
                user=s.cashier,
                type='SALE',
                status='COMPLETED',
                created_at__gte=s.opened_at,
                created_at__lte=s.closed_at or timezone.now(),
            )
            method_agg = session_orders.values('payment_method').annotate(
                subtotal=Sum('total_amount'),
                count=Count('id'),
            )
            payment_breakdown = [
                {
                    'method': row['payment_method'] or 'UNKNOWN',
                    'label': (row['payment_method'] or 'UNKNOWN').replace('_', ' ').title(),
                    'total': float(row['subtotal'] or 0),
                    'count': row['count'] or 0,
                }
                for row in method_agg
            ]

            duration_secs = 0
            if s.closed_at and s.opened_at:
                duration_secs = int((s.closed_at - s.opened_at).total_seconds())
            hours = duration_secs // 3600
            minutes = (duration_secs % 3600) // 60

            data.append({
                'sessionId': s.id,
                'registerName': s.register.name,
                'siteName': s.register.site.name if s.register.site_id else '',
                'cashierName': f"{s.cashier.first_name} {s.cashier.last_name}".strip() if s.cashier else '',
                'closedByName': f"{s.closed_by.first_name} {s.closed_by.last_name}".strip() if s.closed_by else '',
                'status': s.status,
                'openedAt': s.opened_at.isoformat() if s.opened_at else None,
                'closedAt': s.closed_at.isoformat() if s.closed_at else None,
                'duration': f"{hours}h {minutes}m",
                'openingBalance': float(s.opening_balance or 0),
                'closingBalance': float(s.closing_balance or 0),
                'expectedBalance': float(s.expected_balance or 0),
                'difference': float(s.difference or 0),
                'totalSales': float(s.total_sales or 0),
                'totalTransactions': s.total_transactions or 0,
                'totalCashIn': float(s.total_cash_in or 0),
                'paymentBreakdown': payment_breakdown,
                'closingNotes': s.closing_notes or '',
            })

        return Response({'count': total, 'results': data})

