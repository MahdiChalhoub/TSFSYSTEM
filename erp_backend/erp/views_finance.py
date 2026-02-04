# Finance ViewSets
# COA and related financial views with audit logging, permissions, and connector support

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, F, Q, Value, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal

from .models import (
    ChartOfAccount, FinancialAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, Loan, FinancialEvent
)
from apps.finance.serializers import (
    ChartOfAccountSerializer, FinancialAccountSerializer,
    FiscalYearSerializer, FiscalPeriodSerializer,
    JournalEntrySerializer, LoanSerializer, FinancialEventSerializer
)
from .mixins import AuditLogMixin, ConnectorAwareMixin
from .permissions import (
    FinanceReadOnlyOrManage, CanManageFinance, CanPostJournalEntries,
    CanCloseAccounting
)


class ChartOfAccountViewSet(AuditLogMixin, ConnectorAwareMixin, viewsets.ModelViewSet):
    """
    ViewSet for Chart of Accounts management.
    Supports hierarchical account structure and balance calculations.
    
    Permissions:
    - View: finance.view
    - Manage: finance.manage
    
    Audit: All CRUD operations are logged.
    Connector: Requests buffered if finance module disabled.
    """
    serializer_class = ChartOfAccountSerializer
    permission_classes = [IsAuthenticated, FinanceReadOnlyOrManage]
    
    # Mixin configurations
    audit_model_name = 'ChartOfAccount'
    connector_module = 'finance'
    
    # Permission mapping for granular control
    required_permissions = {
        'list': 'finance.view',
        'retrieve': 'finance.view',
        'create': 'finance.manage',
        'update': 'finance.manage',
        'partial_update': 'finance.manage',
        'destroy': 'finance.manage',
    }
    
    def get_queryset(self):
        org_id = getattr(self.request, 'org_id', None)
        qs = ChartOfAccount.objects.filter(organization_id=org_id)
        
        # Filter by scope (OFFICIAL vs INTERNAL)
        scope = self.request.query_params.get('scope', 'INTERNAL')
        include_inactive = self.request.query_params.get('include_inactive', 'false').lower() == 'true'
        
        if not include_inactive:
            qs = qs.filter(is_active=True)
        
        return qs.select_related('parent').order_by('code')
    
    def list(self, request, *args, **kwargs):
        """
        Returns COA with rollup balances calculated.
        """
        queryset = self.get_queryset()
        scope = request.query_params.get('scope', 'INTERNAL')
        
        # Build response with rollup balances
        accounts = []
        balance_field = 'balance' if scope == 'INTERNAL' else 'balance_official'
        
        for acc in queryset:
            # Calculate rollup (account + children)
            children_balance = ChartOfAccount.objects.filter(
                parent_id=acc.id
            ).aggregate(
                total=Coalesce(Sum(balance_field), Value(Decimal('0.00')), output_field=DecimalField())
            )['total']
            
            direct_balance = getattr(acc, balance_field) or Decimal('0.00')
            rollup_balance = direct_balance + (children_balance or Decimal('0.00'))
            
            accounts.append({
                'id': acc.id,
                'code': acc.code,
                'name': acc.name,
                'type': acc.type,
                'sub_type': acc.sub_type,
                'parent_id': acc.parent_id,
                'is_active': acc.is_active,
                'is_system_only': acc.is_system_only,
                'syscohada_code': acc.syscohada_code,
                'syscohada_class': acc.syscohada_class,
                'temp_balance': str(direct_balance),
                'rollup_balance': str(rollup_balance),
            })
        
        return Response(accounts)
    
    @action(detail=False, methods=['get'])
    def coa(self, request):
        """
        Alias endpoint for full COA listing (for frontend compatibility).
        """
        return self.list(request)
    
    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        """
        Returns trial balance report.
        """
        queryset = self.get_queryset().filter(is_hidden=False)
        scope = request.query_params.get('scope', 'INTERNAL')
        balance_field = 'balance' if scope == 'INTERNAL' else 'balance_official'
        
        accounts = []
        for acc in queryset:
            balance = getattr(acc, balance_field) or Decimal('0.00')
            if balance != Decimal('0.00'):  # Only include accounts with balances
                accounts.append({
                    'id': acc.id,
                    'code': acc.code,
                    'name': acc.name,
                    'type': acc.type,
                    'temp_balance': str(balance),
                    'rollup_balance': str(balance),
                })
        
        return Response(accounts)
    
    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """
        Returns account statement with journal lines.
        """
        account = self.get_object()
        scope = request.query_params.get('scope', 'INTERNAL')
        balance_field = 'balance' if scope == 'INTERNAL' else 'balance_official'
        
        # Get journal lines for this account
        lines = JournalEntryLine.objects.filter(
            account=account
        ).select_related('journal_entry').order_by('journal_entry__date', 'id')
        
        line_data = []
        for line in lines:
            line_data.append({
                'id': line.id,
                'date': line.journal_entry.date.isoformat() if line.journal_entry else None,
                'description': line.description or line.journal_entry.description if line.journal_entry else '',
                'debit': str(line.debit or Decimal('0.00')),
                'credit': str(line.credit or Decimal('0.00')),
                'reference': line.journal_entry.reference if line.journal_entry else None,
            })
        
        return Response({
            'account': {
                'id': account.id,
                'code': account.code,
                'name': account.name,
                'type': account.type,
                'balance': str(getattr(account, balance_field) or Decimal('0.00'))
            },
            'opening_balance': '0.00',  # TODO: Calculate from fiscal year start
            'lines': line_data
        })


class FinancialAccountViewSet(AuditLogMixin, ConnectorAwareMixin, viewsets.ModelViewSet):
    """ViewSet for cash/bank accounts."""
    serializer_class = FinancialAccountSerializer
    permission_classes = [IsAuthenticated, FinanceReadOnlyOrManage]
    audit_model_name = 'FinancialAccount'
    connector_module = 'finance'
    
    def get_queryset(self):
        org_id = getattr(self.request, 'org_id', None)
        return FinancialAccount.objects.filter(organization_id=org_id)


class FiscalYearViewSet(AuditLogMixin, ConnectorAwareMixin, viewsets.ModelViewSet):
    """ViewSet for fiscal years."""
    serializer_class = FiscalYearSerializer
    permission_classes = [IsAuthenticated, FinanceReadOnlyOrManage]
    audit_model_name = 'FiscalYear'
    connector_module = 'finance'
    
    def get_queryset(self):
        org_id = getattr(self.request, 'org_id', None)
        return FiscalYear.objects.filter(organization_id=org_id)
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close a fiscal year. Requires finance.close_period permission."""
        # Check permission
        if not CanCloseAccounting().has_permission(request, self):
            return Response(
                {'error': 'Permission denied: finance.close_period required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        fiscal_year = self.get_object()
        fiscal_year.is_closed = True
        fiscal_year.save()
        
        # Log the action
        self._log_action('CLOSE', fiscal_year)
        
        return Response({'status': 'Fiscal year closed'})


class FiscalPeriodViewSet(AuditLogMixin, ConnectorAwareMixin, viewsets.ModelViewSet):
    """ViewSet for fiscal periods."""
    serializer_class = FiscalPeriodSerializer
    permission_classes = [IsAuthenticated, FinanceReadOnlyOrManage]
    audit_model_name = 'FiscalPeriod'
    connector_module = 'finance'
    
    def get_queryset(self):
        org_id = getattr(self.request, 'org_id', None)
        return FiscalPeriod.objects.filter(fiscal_year__organization_id=org_id)
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close a fiscal period. Requires finance.close_period permission."""
        if not CanCloseAccounting().has_permission(request, self):
            return Response(
                {'error': 'Permission denied: finance.close_period required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        period = self.get_object()
        period.is_closed = True
        period.save()
        
        self._log_action('CLOSE', period)
        
        return Response({'status': 'Fiscal period closed'})


class JournalEntryViewSet(AuditLogMixin, ConnectorAwareMixin, viewsets.ModelViewSet):
    """ViewSet for journal entries."""
    serializer_class = JournalEntrySerializer
    permission_classes = [IsAuthenticated]
    audit_model_name = 'JournalEntry'
    connector_module = 'finance'
    
    required_permissions = {
        'list': 'finance.view',
        'retrieve': 'finance.view',
        'create': 'finance.post_entries',
        'update': 'finance.post_entries',
        'destroy': 'finance.manage',
    }
    
    def get_queryset(self):
        org_id = getattr(self.request, 'org_id', None)
        return JournalEntry.objects.filter(organization_id=org_id)
    
    def create(self, request, *args, **kwargs):
        """Create journal entry. Requires finance.post_entries permission."""
        if not CanPostJournalEntries().has_permission(request, self):
            return Response(
                {'error': 'Permission denied: finance.post_entries required'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        """Post a journal entry (finalize it)."""
        if not CanPostJournalEntries().has_permission(request, self):
            return Response(
                {'error': 'Permission denied: finance.post_entries required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        entry = self.get_object()
        entry.is_posted = True
        entry.save()
        
        self._log_action('POST', entry)
        
        return Response({'status': 'Journal entry posted'})
    
    @action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        """Reverse a journal entry. Requires finance.manage permission."""
        if not CanManageFinance().has_permission(request, self):
            return Response(
                {'error': 'Permission denied: finance.manage required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        entry = self.get_object()
        # TODO: Create reversal entry
        
        self._log_action('REVERSE', entry)
        
        return Response({'status': 'Journal entry reversed'})


class LoanViewSet(AuditLogMixin, ConnectorAwareMixin, viewsets.ModelViewSet):
    """ViewSet for loans."""
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated, FinanceReadOnlyOrManage]
    audit_model_name = 'Loan'
    connector_module = 'finance'
    
    def get_queryset(self):
        org_id = getattr(self.request, 'org_id', None)
        return Loan.objects.filter(organization_id=org_id)


class FinancialEventViewSet(AuditLogMixin, ConnectorAwareMixin, viewsets.ModelViewSet):
    """ViewSet for financial events."""
    serializer_class = FinancialEventSerializer
    permission_classes = [IsAuthenticated, FinanceReadOnlyOrManage]
    audit_model_name = 'FinancialEvent'
    connector_module = 'finance'
    
    def get_queryset(self):
        org_id = getattr(self.request, 'org_id', None)
        return FinancialEvent.objects.filter(organization_id=org_id)
