"""
CRM Module Views
ViewSets for customer/supplier contact management.
"""
from django.db import transaction
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from erp.models import Organization
from erp.services import ConfigurationService

from apps.crm.models import Contact
from apps.crm.serializers import ContactSerializer
from apps.finance.models import ChartOfAccount
from apps.finance.services import LedgerService
from erp.permissions import CRMReadOnlyOrManage


class ContactViewSet(TenantModelViewSet):
    permission_classes = [permissions.IsAuthenticated, CRMReadOnlyOrManage]
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    def get_queryset(self):
        # 🛡️ AUDITOR CALIBRATION: Direct ID lookups should check ALL scopes
        # to prevent 404s on historical/internal records when accessed via direct URL.
        if self.action in ['retrieve', 'detail_summary', 'loyalty_analytics', 'supplier_scorecard']:
            return Contact.original_objects.filter(organization_id=get_current_tenant_id())
            
        qs = super().get_queryset()
        # Filter by contact type (e.g. type=CUSTOMER from POS client search)
        contact_type = self.request.query_params.get('type')
        if contact_type:
            qs = qs.filter(type=contact_type.upper())
        # Full-text search on name / phone / address
        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(address__icontains=search) |
                Q(company_name__icontains=search)
            )
        # Optional result count limit
        limit = self.request.query_params.get('limit')
        if limit and limit.isdigit():
            qs = qs[:int(limit)]
        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        data = request.data.copy()

        with transaction.atomic():
            rules = ConfigurationService.get_posting_rules(organization)
            contact_type = data.get('type')
            
            parent_account_id = None
            if contact_type == 'CUSTOMER':
                parent_account_id = rules.get('sales', {}).get('receivable')
            else:
                parent_account_id = rules.get('purchases', {}).get('payable')
            
            if not parent_account_id:
                fallback_code = '1110' if contact_type == 'CUSTOMER' else '2101'
                parent = ChartOfAccount.objects.filter(organization=organization, code=fallback_code).first()
                if parent: parent_account_id = parent.id
            
            if parent_account_id:
                parent = ChartOfAccount.objects.get(id=parent_account_id)
                linked_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"{data.get('name')} ({'AR' if contact_type == 'CUSTOMER' else 'AP'})",
                    type=parent.type,
                    sub_type='RECEIVABLE' if contact_type == 'CUSTOMER' else 'PAYABLE',
                    parent_id=parent_account_id
                )
                data['linked_account_id'] = linked_acc.id

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            # ── Auto-Task: NEW_CLIENT / NEW_SUPPLIER ──
            try:
                contact_name = data.get('name', '')
                if contact_type == 'CUSTOMER':
                    from apps.workspace.signals import trigger_crm_event
                    trigger_crm_event(
                        organization, 'NEW_CLIENT',
                        reference=contact_name,
                        client_id=serializer.instance.id,
                    )
                else:
                    from apps.workspace.signals import trigger_purchasing_event
                    trigger_purchasing_event(
                        organization, 'NEW_SUPPLIER',
                        reference=contact_name,
                    )
            except Exception:
                pass

            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='summary')
    def detail_summary(self, request, pk=None):
        """Full contact summary: info + orders + payments + balance."""
        import traceback
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)

        try:
            contact = self.get_object()

            # Orders (sales or purchases depending on type)
            from apps.pos.models import Order
            from django.db.models import Sum, Count, Q

            order_type = 'SALE' if contact.type == 'CUSTOMER' else 'PURCHASE'
            orders = Order.objects.filter(
                organization_id=organization_id,
                contact=contact,
                type=order_type
            ).order_by('-created_at')

            order_stats = orders.aggregate(
                total_count=Count('id'),
                total_amount=Sum('total_amount'),
                completed=Count('id', filter=Q(status__in=['COMPLETED', 'INVOICED'])),
                draft=Count('id', filter=Q(status='DRAFT')),
            )

            recent_orders = orders[:10].values(
                'id', 'ref_code', 'status', 'total_amount', 'tax_amount',
                'payment_method', 'created_at', 'invoice_number'
            )

            # Payments
            from apps.finance.payment_models import Payment
            payment_type = 'CUSTOMER_RECEIPT' if contact.type == 'CUSTOMER' else 'SUPPLIER_PAYMENT'
            payments = Payment.objects.filter(
                organization_id=organization_id,
                contact=contact,
                type=payment_type
            ).order_by('-payment_date')

            payment_stats = payments.aggregate(
                total_paid=Sum('amount'),
                payment_count=Count('id'),
            )

            recent_payments = payments[:10].values(
                'id', 'reference', 'amount', 'payment_date', 'method', 'status', 'description'
            )

            # Balance
            if contact.type == 'CUSTOMER':
                from apps.finance.payment_models import CustomerBalance
                bal_obj = CustomerBalance.objects.filter(
                    organization_id=organization_id, contact=contact
                ).first()
            else:
                from apps.finance.payment_models import SupplierBalance
                bal_obj = SupplierBalance.objects.filter(
                    organization_id=organization_id, contact=contact
                ).first()

            balance_data = {
                'current_balance': float(bal_obj.current_balance) if bal_obj else 0,
                'last_payment_date': str(bal_obj.last_payment_date) if bal_obj and bal_obj.last_payment_date else None,
            }

            # Journal entries via linked COA sub-account
            recent_journal = []
            if contact.linked_account:
                from apps.finance.models import JournalEntryLine
                journal_lines = JournalEntryLine.objects.filter(
                    organization_id=organization_id,
                    account_id=contact.linked_account
                ).select_related('journal_entry', 'account').order_by('-journal_entry__transaction_date')[:10]

                recent_journal = [{
                    'id': jl.journal_entry.id,
                    'date': str(jl.journal_entry.transaction_date.date()) if jl.journal_entry.transaction_date else None,
                    'reference': jl.journal_entry.reference,
                    'description': jl.description,
                    'account': jl.account.name if jl.account else None,
                    'debit': float(jl.debit),
                    'credit': float(jl.credit),
                } for jl in journal_lines]

            return Response({
                'contact': ContactSerializer(contact).data,
                'orders': {
                    'stats': {
                        'total_count': order_stats['total_count'] or 0,
                        'total_amount': float(order_stats['total_amount'] or 0),
                        'completed': order_stats['completed'] or 0,
                        'draft': order_stats['draft'] or 0,
                    },
                    'recent': list(recent_orders),
                },
                'payments': {
                    'stats': {
                        'total_paid': float(payment_stats['total_paid'] or 0),
                        'payment_count': payment_stats['payment_count'] or 0,
                    },
                    'recent': list(recent_payments),
                },
                'balance': balance_data,
                'journal_entries': recent_journal,
                'analytics': self._build_analytics(contact, orders, order_stats),
                'pricing_rules': self._get_pricing_rules(contact, organization_id),
            })
        except Exception as e:
            return Response({
                'error': str(e),
                'detail': traceback.format_exc()
            }, status=500)

    def _build_analytics(self, contact, orders, order_stats):
        """Build purchase/sales analytics for the contact."""
        from django.db.models import Avg, F
        from django.utils import timezone
        import datetime

        total_count = order_stats['total_count'] or 0
        total_amount = float(order_stats['total_amount'] or 0)

        analytics = {
            'avg_order_value': round(total_amount / total_count, 2) if total_count > 0 else 0,
            'total_orders': total_count,
            'total_revenue': total_amount,
            'top_products': [],
            'monthly_frequency': 0,
        }

        # Monthly frequency (orders per month over last 12 months)
        twelve_months_ago = timezone.now() - datetime.timedelta(days=365)
        recent_count = orders.filter(created_at__gte=twelve_months_ago).count()
        analytics['monthly_frequency'] = round(recent_count / 12, 1)

        # Top products by revenue
        try:
            from apps.pos.models import OrderLine
            top_products = OrderLine.objects.filter(
                order__in=orders
            ).values(
                'product_name'
            ).annotate(
                total_qty=Sum('quantity'),
                total_revenue=Sum(F('quantity') * F('unit_price'))
            ).order_by('-total_revenue')[:5]
            analytics['top_products'] = list(top_products)
        except Exception:
            pass

        return analytics

    def _get_pricing_rules(self, contact, organization_id):
        """Get all pricing rules applicable to this contact."""
        try:
            from apps.crm.models import ClientPriceRule, PriceGroupMember
            from apps.crm.serializers import ClientPriceRuleSerializer

            # Direct rules
            direct = ClientPriceRule.objects.filter(
                contact_id=contact.id,
                organization_id=organization_id,
                is_active=True
            )

            # Group-based rules
            group_ids = PriceGroupMember.objects.filter(
                contact_id=contact.id,
                organization_id=organization_id
            ).values_list('price_group_id', flat=True)

            group_rules = ClientPriceRule.objects.filter(
                price_group_id__in=group_ids,
                organization_id=organization_id,
                is_active=True
            )

            from itertools import chain
            all_rules = list(chain(direct, group_rules))
            return ClientPriceRuleSerializer(all_rules, many=True).data
        except Exception:
            return []

    # ── Loyalty Program Endpoints ──────────────────────────────

    @action(detail=True, methods=['get'], url_path='loyalty')
    def loyalty_analytics(self, request, pk=None):
        """Get customer loyalty analytics (points, tier, lifetime value)."""
        from apps.crm.loyalty_service import LoyaltyService
        contact = self.get_object()
        return Response(LoyaltyService.get_customer_analytics(contact))

    @action(detail=True, methods=['post'], url_path='earn-points')
    def earn_points(self, request, pk=None):
        """Award loyalty points. Body: { "order_total": 150.00 }"""
        from apps.crm.loyalty_service import LoyaltyService
        from decimal import Decimal
        contact = self.get_object()
        order_total = Decimal(str(request.data.get('order_total', '0')))
        if order_total <= 0:
            return Response({"error": "order_total must be positive"}, status=400)
        result = LoyaltyService.earn_points(contact, order_total)
        return Response(result)

    @action(detail=True, methods=['post'], url_path='burn-points')
    def burn_points(self, request, pk=None):
        """Redeem loyalty points. Body: { "points": 500 }"""
        from apps.crm.loyalty_service import LoyaltyService
        contact = self.get_object()
        points = int(request.data.get('points', 0))
        if points <= 0:
            return Response({"error": "points must be positive"}, status=400)
        result = LoyaltyService.burn_points(contact, points)
        if 'error' in result:
            return Response(result, status=400)
        return Response(result)

    # ── Supplier Scorecard Endpoints ───────────────────────────

    @action(detail=True, methods=['get'], url_path='scorecard')
    def supplier_scorecard(self, request, pk=None):
        """Get supplier performance scorecard."""
        from apps.crm.loyalty_service import LoyaltyService
        contact = self.get_object()
        return Response(LoyaltyService.get_supplier_scorecard(contact))

    @action(detail=True, methods=['post'], url_path='rate')
    def rate_supplier(self, request, pk=None):
        """Rate a supplier. Body: { "quality": 4, "delivery": 5, "pricing": 3, "service": 4 }"""
        from apps.crm.loyalty_service import LoyaltyService
        contact = self.get_object()
        result = LoyaltyService.rate_supplier(
            contact,
            quality=request.data.get('quality'),
            delivery=request.data.get('delivery'),
            pricing=request.data.get('pricing'),
            service=request.data.get('service'),
        )
        return Response(result)

    @action(detail=True, methods=['post'], url_path='record-delivery')
    def record_delivery(self, request, pk=None):
        """Record a delivery for supplier performance. Body: { "on_time": true, "lead_time_days": 5 }"""
        from apps.crm.loyalty_service import LoyaltyService
        contact = self.get_object()
        on_time = request.data.get('on_time', True)
        lead_time = request.data.get('lead_time_days')
        LoyaltyService.record_delivery(contact, on_time=on_time, lead_time_days=lead_time)
        return Response({"message": "Delivery recorded"})
