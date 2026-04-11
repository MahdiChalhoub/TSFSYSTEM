from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, get_current_tenant_id,
    Organization
)
from kernel.lifecycle.viewsets import LifecycleViewSetMixin
from apps.finance.models import (
    DeferredExpense, DirectExpense, Asset, AmortizationSchedule,
    TransactionSequence, FinancialEvent, JournalEntry, JournalEntryLine
)
from apps.finance.serializers import (
    DeferredExpenseSerializer, DirectExpenseSerializer, AssetSerializer,
    AmortizationScheduleSerializer
)
from apps.finance.services import DeferredExpenseService, AssetService

class DeferredExpenseViewSet(TenantModelViewSet):
    queryset = DeferredExpense.objects.all()
    serializer_class = DeferredExpenseSerializer

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            expense = DeferredExpenseService.create_deferred_expense(
                organization=organization,
                data=request.data,
                user=request.user,
                scope=request.data.get('scope', 'OFFICIAL')
            )
            return Response(DeferredExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def recognize(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            period_date = request.data.get('period_date')
            expense = DeferredExpenseService.recognize_monthly(organization, pk, period_date, user=request.user)
            return Response(DeferredExpenseSerializer(expense).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class DirectExpenseViewSet(LifecycleViewSetMixin, TenantModelViewSet):
    queryset = DirectExpense.objects.all()
    serializer_class = DirectExpenseSerializer
    lifecycle_transaction_type = 'DIRECT_EXPENSE'

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        status_filter = self.request.query_params.get('status')
        if category:
            qs = qs.filter(category=category)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            data = request.data.copy()
            # Auto-generate reference
            ref = TransactionSequence.next_value(organization, 'EXPENSE')
            expense = DirectExpense.objects.create(
                organization=organization,
                name=data.get('name'),
                description=data.get('description', ''),
                category=data.get('category', 'OTHER'),
                amount=data.get('amount'),
                date=data.get('date'),
                reference=ref,
                source_account_id=data.get('source_account_id'),
                expense_coa_id=data.get('expense_coa_id'),
                scope=data.get('scope', 'OFFICIAL'),
            )
            return Response(DirectExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def update(self, request, *args, **kwargs):
        expense = self.get_object()
        if expense.status != 'DRAFT':
            return Response({"error": "Only DRAFT expenses can be edited."}, status=400)
        allowed = {'name', 'description', 'category', 'amount', 'date',
                   'source_account_id', 'expense_coa_id'}
        update_data = {k: v for k, v in request.data.items() if k in allowed}
        for key, value in update_data.items():
            setattr(expense, key, value)
        expense.save()
        return Response(DirectExpenseSerializer(expense).data)

    def destroy(self, request, *args, **kwargs):
        expense = self.get_object()
        if expense.status != 'DRAFT':
            return Response({"error": "Only DRAFT expenses can be deleted."}, status=400)
        expense.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='post')
    def post_expense(self, request, pk=None):
        """Standardize post action for DirectExpense."""
        expense = self.get_object()
        if expense.status != 'DRAFT':
            return Response({"error": "Only DRAFT expenses can be posted."}, status=400)
        
        # Call original posting logic but update status via LifecycleService
        # Refactoring to move the heavy lifting to a service would be better, 
        # but for now I'll just call LifecycleService.post after the JE logic.
        # ... (Actually I'll just call the service if it existed, but here it's in the viewset)
        # I'll keep the logic here but wrap it in LifecycleService.post logic.
        
        try:
            from kernel.lifecycle.service import LifecycleService
            with transaction.atomic():
                # (Existing posting logic - I'll keep it for now as I don't want to break the module)
                # 1. Create financial event
                event = FinancialEvent.objects.create(
                    organization=expense.organization,
                    event_type='EXPENSE',
                    amount=expense.amount,
                    date=expense.date,
                    reference=expense.reference,
                    notes=f"Direct Expense: {expense.name}",
                    financial_account=expense.source_account,
                    scope=expense.scope,
                    status='COMPLETED',
                )

                # 2. Create journal entry
                je = JournalEntry.objects.create(
                    organization=expense.organization,
                    transaction_date=expense.date,
                    description=f"Direct Expense: {expense.name}",
                    reference=expense.reference,
                    scope=expense.scope,
                    status='POSTED',
                    created_by=request.user if request.user.is_authenticated else None,
                    posted_by=request.user if request.user.is_authenticated else None,
                )
                
                if expense.expense_coa:
                    JournalEntryLine.objects.create(
                        organization=expense.organization,
                        journal_entry=je,
                        account=expense.expense_coa,
                        debit=expense.amount,
                        credit=0,
                        description=expense.name,
                    )
                if expense.source_account and expense.source_account.ledger_account:
                    JournalEntryLine.objects.create(
                        organization=expense.organization,
                        journal_entry=je,
                        account=expense.source_account.ledger_account,
                        debit=0,
                        credit=expense.amount,
                        description=expense.name,
                    )

                expense.financial_event = event
                expense.journal_entry = je
                expense.save()
                
                # Signal engine to move to POSTED
                LifecycleService.post(expense, request.user)

            return Response(DirectExpenseSerializer(expense).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class AssetViewSet(TenantModelViewSet):
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            asset = AssetService.acquire_asset(
                organization=organization,
                data=request.data,
                user=request.user,
                scope=request.data.get('scope', 'OFFICIAL')
            )
            return Response(AssetSerializer(asset).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        asset = self.get_object()
        lines = asset.amortization_lines.all().order_by('period_date')
        return Response(AmortizationScheduleSerializer(lines, many=True).data)

    @action(detail=True, methods=['post'], url_path='depreciate/(?P<schedule_id>[^/.]+)')
    def depreciate(self, request, pk=None, schedule_id=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            line = AssetService.post_depreciation(organization, schedule_id, user=request.user)
            return Response(AmortizationScheduleSerializer(line).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)
