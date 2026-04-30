"""
ChartOfAccountViewSet mixin — COA setup, status, statement, trial-balance,
and migrate/finalize endpoints. Inherited by `ChartOfAccountViewSet`.
"""
from .base import (
    status, Response, action,
    get_current_tenant_id, Organization,
)
from apps.finance.serializers import ChartOfAccountSerializer
from apps.finance.services import LedgerService


class COASetupMixin:
    """@action methods for COA list/status, account statement, trial balance,
    legacy migrate (mappings list), and finance-readiness finalize."""

    @action(detail=False, methods=['get'])
    def coa(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response([], status=status.HTTP_200_OK)

        organization = Organization.objects.get(id=organization_id)

        # --- STRICT SCOPE ISOLATION ---
        # Authorized scope comes from the X-Scope-Access header, forwarded by
        # the Next.js proxy from the httpOnly `scope_access` cookie set at login.
        # The legacy ContextVar (get_authorized_scope) was never wired to a
        # middleware, so it always returned 'official' and silently caged every
        # INTERNAL request — that's why the OFFICIAL/INTERNAL toggle had no
        # effect on balances.
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'   # safe default: no header → caged to OFFICIAL
        ).lower()
        requested = (request.query_params.get('scope') or 'OFFICIAL').upper()
        if authorized == 'official' and requested == 'INTERNAL':
            requested = 'OFFICIAL'
        scope = requested

        include_inactive = request.query_params.get('include_inactive') == 'true'
        site_id = request.query_params.get('site_id') or None

        accounts = LedgerService.get_chart_of_accounts(organization, scope, include_inactive, site_id=site_id)

        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "subType": acc.sub_type,
                "isActive": acc.is_active,
                "parentId": acc.parent_id,
                "syscohadaCode": acc.syscohada_code,
                "syscohadaClass": acc.syscohada_class,
                "isInternal": acc.is_internal,
                "temp_balance": float(acc.temp_balance),
                "rollup_balance": float(acc.rollup_balance),
                # ── Fields needed by migration page ──
                "template_origin": acc.template_origin,
                "allow_posting": acc.allow_posting,
                "is_system_only": acc.is_system_only,
                "system_role": acc.system_role,
                "balance": float(acc.balance),
                "balance_official": float(acc.balance_official),
            })
        return Response(data)

    @action(detail=False, methods=['get'])
    def coa_status(self, request):
        """Return current COA state with import_case detection.

        import_case values:
          EMPTY       — no active accounts at all → direct import
          UNTOUCHED   — accounts exist but zero transactions, zero balances,
                        and no custom/extra sub-accounts beyond the template
                        → safe to delete & replace without migration
          NEEDS_MIGRATION — accounts have transactions, balances, or custom
                        sub-accounts → full migration required
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.finance.models import ChartOfAccount, JournalEntry, JournalEntryLine
        from django.db.models import Count, Q
        from decimal import Decimal

        org_accounts = ChartOfAccount.objects.filter(organization_id=organization_id, is_active=True)
        account_count = org_accounts.count()
        journal_count = JournalEntry.objects.filter(organization_id=organization_id).count()

        # Get the dominant template (most active accounts)
        template_stats = (
            org_accounts.values('template_origin')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        templates = {r['template_origin']: r['count'] for r in template_stats if r['template_origin']}
        current_template = max(templates, key=templates.get) if templates else None

        # ── Detect import_case ──────────────────────────────────────────
        if account_count == 0:
            import_case = 'EMPTY'
        else:
            # Check for any journal entry lines referencing org accounts
            has_journal_lines = JournalEntryLine.objects.filter(
                organization_id=organization_id
            ).exists()

            # Check for any non-zero balances
            has_balances = org_accounts.filter(
                Q(balance__gt=Decimal('0')) | Q(balance__lt=Decimal('0')) |
                Q(balance_official__gt=Decimal('0')) | Q(balance_official__lt=Decimal('0'))
            ).exists()

            # Check for custom/extra accounts (accounts not from the template)
            has_custom_accounts = org_accounts.filter(
                Q(template_origin__isnull=True) | Q(template_origin='')
            ).exists()

            if not has_journal_lines and not has_balances and not has_custom_accounts:
                import_case = 'UNTOUCHED'
            else:
                import_case = 'NEEDS_MIGRATION'

        # Per-account balances for migration display
        account_balances = []
        for acc in org_accounts.order_by('code'):
            account_balances.append({
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "balance": float(acc.balance) if acc.balance else 0,
                "template_origin": acc.template_origin,
            })

        return Response({
            "current_template": current_template,
            "templates": templates,
            "account_count": account_count,
            "journal_entry_count": journal_count,
            "has_data": journal_count > 0,
            "needs_migration": import_case == 'NEEDS_MIGRATION',
            "import_case": import_case,
            "accounts": account_balances,
        })

    @action(detail=False, methods=['post'])
    def migrate(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        mappings = request.data.get('mappings', [])
        description = request.data.get('description', "COA Migration")
        target_template_key = request.data.get('targetTemplateKey')
        target_template_accounts = request.data.get('targetTemplateAccounts', [])

        if not mappings:
            return Response({"error": "Mappings are required"}, status=status.HTTP_400_BAD_REQUEST)
        if not target_template_key:
            return Response({"error": "Target template key is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = LedgerService.migrate_coa(
                organization, mappings, description,
                target_template_key=target_template_key,
                target_template_accounts=target_template_accounts,
            )
            return Response({
                "message": "Migration completed successfully",
                "renamed": result.get('renamed', 0),
                "deleted": result.get('deleted', 0),
                "created": result.get('created', 0),
            })
        except Exception as e:
            import traceback, logging
            logging.getLogger(__name__).error("Migration failed: %s\n%s", e, traceback.format_exc())
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def finalize_setup(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)

        try:
            from django.core.exceptions import ValidationError
            LedgerService.validate_finance_readiness(organization)
            return Response({"message": "Finance module activated successfully"})
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # --- STRICT SCOPE ISOLATION ---
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'   # safe default: no header → caged to OFFICIAL
        ).lower()
        requested = (request.query_params.get('scope') or 'OFFICIAL').upper()
        if authorized == 'official' and requested == 'INTERNAL':
            requested = 'OFFICIAL'
        scope = requested

        site_id = request.query_params.get('site_id') or None
        result = LedgerService.get_account_statement(organization, pk, start_date, end_date, scope, site_id=site_id)

        from apps.finance.serializers import JournalEntryLineSerializer
        account_data = ChartOfAccountSerializer(result['account']).data
        lines_data = JournalEntryLineSerializer(result['lines'], many=True).data

        return Response({
            "account": account_data,
            "opening_balance": float(result['opening_balance']),
            "lines": lines_data
        })

    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        # Accept ALL of: as_of (single point), end_date (alias), start_date
        # (period lower bound — also accepted as `fy_start_date` for
        # clarity from the TB caller). Frontend sends ISO strings.
        as_of = request.query_params.get('as_of') or request.query_params.get('end_date')
        start_date = (
            request.query_params.get('fy_start_date')
            or request.query_params.get('start_date')
            or None
        )

        # --- STRICT SCOPE ISOLATION ---
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'   # safe default: no header → caged to OFFICIAL
        ).lower()
        requested = (request.query_params.get('scope') or 'OFFICIAL').upper()
        if authorized == 'official' and requested == 'INTERNAL':
            requested = 'OFFICIAL'
        scope = requested

        site_id = request.query_params.get('site_id') or None
        accounts = LedgerService.get_trial_balance(
            organization, as_of, scope, site_id=site_id, start_date=start_date,
        )

        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                # Leaf (direct) figures
                "temp_balance": float(acc.temp_balance),
                "temp_opening": float(getattr(acc, 'temp_opening', 0) or 0),
                "temp_movement": float(getattr(acc, 'temp_movement', 0) or 0),
                # Rolled-up through descendants
                "rollup_balance": float(acc.rollup_balance),
                "rollup_opening": float(getattr(acc, 'rollup_opening', 0) or 0),
                "rollup_movement": float(getattr(acc, 'rollup_movement', 0) or 0),
                "parent_id": acc.parent_id,
            })
        return Response(data)
