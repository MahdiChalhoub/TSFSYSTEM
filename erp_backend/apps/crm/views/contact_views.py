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

from apps.crm.models import Contact, ContactTag, ContactPerson
from apps.crm.serializers import ContactSerializer, ContactTagSerializer, ContactPersonSerializer
from apps.finance.models import ChartOfAccount
from apps.finance.services import LedgerService
from erp.permissions import HasPermission


class ContactTagViewSet(TenantModelViewSet):
    """CRUD for user-defined contact categories (tags)."""
    permission_classes = [permissions.IsAuthenticated]
    queryset = ContactTag.objects.all()
    serializer_class = ContactTagSerializer


class ContactPersonViewSet(TenantModelViewSet):
    """CRUD for people within a business contact (Contact Book)."""
    permission_classes = [permissions.IsAuthenticated]
    queryset = ContactPerson.objects.all()
    serializer_class = ContactPersonSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        contact_id = self.request.query_params.get('contact')
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        return qs


class ContactViewSet(TenantModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    # Granular RBAC — maps DRF actions to seeded permission codes
    required_permissions = {
        'list':           'crm.view_contact',
        'retrieve':       'crm.view_contact',
        'create':         'crm.create_contact',
        'update':         'crm.edit_contact',
        'partial_update': 'crm.edit_contact',
        'destroy':        'crm.delete_contact',
    }

    def get_queryset(self):
        # 🛡️ AUDITOR CALIBRATION: Direct ID lookups should check ALL scopes
        if self.action in ['retrieve', 'detail_summary', 'loyalty_analytics', 'supplier_scorecard']:
            return Contact.original_objects.filter(organization_id=get_current_tenant_id())

        qs = super().get_queryset()
        contact_type = self.request.query_params.get('type')
        if contact_type:
            qs = qs.filter(type=contact_type.upper())
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type.upper())
        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(address__icontains=search) |
                Q(company_name__icontains=search)
            )
        limit = self.request.query_params.get('limit')
        if limit and limit.isdigit():
            qs = qs[:int(limit)]
        return qs

    def _resolve_coa_parent(self, rules, contact_type, organization):
        """
        Resolve the parent COA account for auto-linking using Contact.COA_MAPPING.
        Returns (parent_account, sub_type) or (None, None) if no COA link needed.
        """
        mapping = Contact.COA_MAPPING.get(contact_type)
        if mapping is None:
            return None, None  # LEAD, CONTACT — no COA

        rule_cat, rule_key, fallback_cat, fallback_key, sub_type = mapping
        parent_account_id = (
            rules.get(rule_cat, {}).get(rule_key) or
            rules.get(fallback_cat, {}).get(fallback_key)
        )

        if not parent_account_id:
            return None, sub_type  # Signal: mapping exists but rule not configured

        parent = ChartOfAccount.objects.filter(id=parent_account_id, organization=organization).first()
        return parent, sub_type

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        data = request.data.copy()
        contact_type = data.get('type', 'CUSTOMER')

        with transaction.atomic():
            rules = ConfigurationService.get_posting_rules(organization)

            if contact_type == 'BOTH':
                # ── Special: BOTH creates TWO sub-accounts (AR + AP) ──
                ar_parent, _ = self._resolve_coa_parent(rules, 'CUSTOMER', organization)
                ap_parent, _ = self._resolve_coa_parent(rules, 'SUPPLIER', organization)

                if not ar_parent or not ap_parent:
                    return Response(
                        {"error": "Cannot create BOTH contact: Need both Customer Root (Receivable) and "
                                  "Supplier Root (Payable) configured in posting rules."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                ar_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"{data.get('name')} (AR)",
                    type=ar_parent.type,
                    sub_type='RECEIVABLE',
                    parent_id=ar_parent.id
                )
                ap_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"{data.get('name')} (AP)",
                    type=ap_parent.type,
                    sub_type='PAYABLE',
                    parent_id=ap_parent.id
                )
                # Store AR as primary linked account; AP stored in notes for now
                data['linked_account_id'] = ar_acc.id
                # TODO: Add linked_account_ap_id field for dual-account contacts

            else:
                parent, sub_type = self._resolve_coa_parent(rules, contact_type, organization)

                if sub_type and not parent:
                    # Mapping exists but rule not configured
                    type_label = dict(Contact.TYPES).get(contact_type, contact_type)
                    return Response(
                        {"error": f"Cannot create {type_label}: No parent COA account configured. "
                                  f"Go to Finance → Settings → Posting Rules and configure the "
                                  f"Partner Automation section."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if parent:
                    label = 'AR' if sub_type == 'RECEIVABLE' else 'AP'
                    linked_acc = LedgerService.create_linked_account(
                        organization=organization,
                        name=f"{data.get('name')} ({label})",
                        type=parent.type,
                        sub_type=sub_type,
                        parent_id=parent.id
                    )
                    data['linked_account_id'] = linked_acc.id
                # else: LEAD/CONTACT — no account created

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            # ── Auto-Task: NEW_CLIENT / NEW_SUPPLIER ──
            try:
                contact_name = data.get('name', '')
                if contact_type in ('CUSTOMER', 'DEBTOR'):
                    from apps.workspace.signals import trigger_crm_event
                    trigger_crm_event(
                        organization, 'NEW_CLIENT',
                        reference=contact_name,
                        client_id=serializer.instance.id,
                    )
                elif contact_type in ('SUPPLIER', 'SERVICE', 'CREDITOR'):
                    from apps.workspace.signals import trigger_purchasing_event
                    trigger_purchasing_event(
                        organization, 'NEW_SUPPLIER',
                        reference=contact_name,
                    )
            except Exception:
                pass

            return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ── Contact Book (people within a business) ──

    @action(detail=True, methods=['get', 'post'], url_path='people')
    def people_list(self, request, pk=None):
        """List or add people to a business contact's contact book."""
        contact = self.get_object()

        if request.method == 'GET':
            people = ContactPerson.objects.filter(
                contact=contact,
                organization_id=get_current_tenant_id(),
                is_active=True
            )
            return Response(ContactPersonSerializer(people, many=True).data)

        # POST — add a person
        data = request.data.copy()
        data['contact'] = contact.id
        data['organization'] = get_current_tenant_id()

        # If setting as primary, unset existing primary
        if data.get('is_primary'):
            ContactPerson.objects.filter(
                contact=contact,
                organization_id=get_current_tenant_id(),
                is_primary=True
            ).update(is_primary=False)

        serializer = ContactPersonSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
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

            order_type = 'SALE' if contact.type in ('CUSTOMER', 'DEBTOR') else 'PURCHASE'
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
            payment_type = 'CUSTOMER_RECEIPT' if contact.type in ('CUSTOMER', 'DEBTOR') else 'SUPPLIER_PAYMENT'
            payments = Payment.objects.filter(
                tenant_id=organization_id,
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
            if contact.type in ('CUSTOMER', 'DEBTOR'):
                from apps.finance.payment_models import CustomerBalance
                bal_obj = CustomerBalance.objects.filter(
                    tenant_id=organization_id, contact=contact
                ).first()
            else:
                from apps.finance.payment_models import SupplierBalance
                bal_obj = SupplierBalance.objects.filter(
                    tenant_id=organization_id, contact=contact
                ).first()

            balance_data = {
                'current_balance': float(bal_obj.current_balance) if bal_obj else 0,
                'last_payment_date': str(bal_obj.last_payment_date) if bal_obj and bal_obj.last_payment_date else None,
            }

            # Journal entries via linked COA sub-account
            recent_journal = []
            if contact.linked_account_id:
                from apps.finance.models import JournalEntryLine
                journal_lines = JournalEntryLine.objects.filter(
                    organization_id=organization_id,
                    account_id=contact.linked_account_id
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

            # Contact book (people within business)
            people = []
            if contact.entity_type == 'BUSINESS':
                people = ContactPersonSerializer(
                    contact.people.filter(is_active=True), many=True
                ).data

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
                'people': people,
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
        from django.db.models import Sum, F
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

        twelve_months_ago = timezone.now() - datetime.timedelta(days=365)
        recent_count = orders.filter(created_at__gte=twelve_months_ago).count()
        analytics['monthly_frequency'] = round(recent_count / 12, 1)

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

            direct = ClientPriceRule.objects.filter(
                contact_id=contact.id,
                organization_id=organization_id,
                is_active=True
            )
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
        LedgerService.record_delivery(contact, on_time=on_time, lead_time_days=lead_time)
        return Response({"message": "Delivery recorded"})
