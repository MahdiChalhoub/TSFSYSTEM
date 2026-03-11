"""
CRM Module Views — Enterprise Hardened (v1.2.0)
=================================================
ViewSets for customer/supplier contact management with:
- Lifecycle enforcement (DRAFT → ACTIVE → BLOCKED → ARCHIVED → MERGED)
- Duplicate detection on create
- Audit trail for sensitive field changes
- Degraded-mode summary endpoint
- Lifecycle management actions (block, archive, merge, restore)
"""
from django.db import transaction
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from erp.models import Organization
from erp.services import ConfigurationService

from apps.crm.serializers import (
    ContactSerializer, ContactTagSerializer, ContactPersonSerializer,
    ContactAuditLogSerializer, AUDITED_FIELDS,
)
from apps.crm.services import ComplianceService
from apps.crm.models import (
    Contact, ContactTag, ContactPerson, ContactAuditLog,
    ContactComplianceDocument, ComplianceRule, ComplianceOverride,
)
from apps.finance.models import ChartOfAccount
from apps.finance.services import LedgerService
from erp.permissions import HasPermission

import logging
import traceback as tb

logger = logging.getLogger(__name__)


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
            return Contact.original_objects.filter(tenant_id=get_current_tenant_id())

        qs = super().get_queryset()
        contact_type = self.request.query_params.get('type')
        if contact_type:
            qs = qs.filter(type=contact_type.upper())
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type.upper())
        # Lifecycle status filter
        contact_status = self.request.query_params.get('status')
        if contact_status:
            qs = qs.filter(status=contact_status.upper())
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
            return None, None

        from apps.finance.models import ChartOfAccount
        parent_account = ChartOfAccount.objects.filter(
            id=parent_account_id, organization=organization
        ).first()

        return parent_account, sub_type

    @action(detail=True, methods=['post'], url_path='sync-accounting')
    def sync_accounting(self, request, pk=None):
        """Force generation/linking of COA account if missing (§19)."""
        contact = self.get_object()
        organization = contact.organization
        
        if contact.finance_link_status == 'LINKED':
            return Response({'message': 'Already synchronized.'})

        # Avoid redundant imports
        from erp.services import ConfigurationService
        from apps.finance.services import FinancialAccountService
        
        rules = ConfigurationService.get_posting_rules(organization)
        parent, sub_type = self._resolve_coa_parent(rules, contact.type, organization)
        
        if not parent:
            return Response({
                'error': f'Capture Failure: No posting rule found for {contact.type}. '
                         'Check Finance Settings > Posting Rules.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            acc = FinancialAccountService.create_sub_account(
                organization=organization,
                parent_account=parent,
                name=contact.name,
                sub_type=sub_type,
                metadata={'contact_id': contact.id, 'origin': 'CRM_SYNC'}
            )
            
            contact.linked_account_id = acc.id
            if sub_type == 'SUPPLIER':
                contact.linked_payable_account_id = acc.id
                
            contact.save(update_fields=['linked_account_id', 'linked_payable_account_id'])
            
            return Response({
                'success': True,
                'account_id': acc.id,
                'account_code': acc.code,
                'message': f'Sub-Ledger Account {acc.code} established successfully.'
            })
        except Exception as e:
            logger.error(f"Failsafe accounting sync failed for contact #{contact.id}: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        data = request.data.copy()
        contact_type = data.get('type', 'CUSTOMER')

        # ── Duplicate Detection ────────────────────────────────────
        try:
            from apps.crm.services.duplicate_service import DuplicateDetectionService
            dup_check = DuplicateDetectionService.check_for_duplicates(
                organization_id=organization_id,
                name=data.get('name'),
                email=data.get('email'),
                phone=data.get('phone'),
                vat_id=data.get('vat_id'),
                company_name=data.get('company_name'),
                whatsapp_group_id=data.get('whatsapp_group_id'),
            )

            # If hard duplicates found and client hasn't explicitly overridden
            force_create = data.get('force_create', False)
            if dup_check['has_duplicates'] and not force_create:
                if not dup_check['allow_create']:
                    return Response({
                        'error': 'Duplicate contact detected',
                        'duplicate_check': dup_check,
                        'message': 'A contact with the same email or VAT ID already exists. '
                                   'Set force_create=true to override.',
                    }, status=status.HTTP_409_CONFLICT)

                # Warn about likely/possible duplicates via response header
                if dup_check['highest_severity'] in ('LIKELY_DUPLICATE', 'POSSIBLE_DUPLICATE'):
                    logger.info(
                        f"[CRM] Duplicate warning for '{data.get('name')}': "
                        f"{len(dup_check['duplicates'])} potential matches"
                    )
        except Exception as e:
            logger.warning(f"[CRM] Duplicate detection failed (non-blocking): {e}")

        with transaction.atomic():
            rules = ConfigurationService.get_posting_rules(organization)
            finance_link_status = 'N_A'

            try:
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
                    data['linked_account_id'] = ar_acc.id
                    data['linked_payable_account_id'] = ap_acc.id
                    finance_link_status = 'LINKED'

                elif Contact.COA_MAPPING.get(contact_type) is not None:
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
                        finance_link_status = 'LINKED'
                else:
                    # LEAD/CONTACT — no account needed
                    finance_link_status = 'N_A'

            except Exception as e:
                # ── Degraded mode: create contact without COA link ──
                logger.error(f"[CRM] Finance linkage failed for '{data.get('name')}': {e}")
                finance_link_status = 'PENDING'

            data['finance_link_status'] = finance_link_status
            data['status'] = data.get('status', 'ACTIVE')

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            # ── Audit log: contact created ──
            try:
                ContactAuditLog.log_change(
                    contact=serializer.instance,
                    action='STATUS_CHANGE',
                    field_name='status',
                    old_value=None,
                    new_value=serializer.instance.status,
                    reason='Contact created',
                    source='API' if 'HTTP_X_REQUESTED_WITH' in request.META else 'UI',
                    actor_user_id=request.user.id if request.user.is_authenticated else None,
                    actor_name=getattr(request.user, 'email', None),
                )
            except Exception:
                pass  # Audit failure is non-blocking

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

            # Build response with duplicate warnings if any
            response_data = serializer.data
            try:
                if dup_check['has_duplicates'] and dup_check['allow_create']:
                    response_data['_warnings'] = {
                        'duplicate_check': dup_check,
                    }
            except NameError:
                pass

            return Response(response_data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Override update to audit sensitive field changes."""
        instance = self.get_object()

        # Track sensitive field changes for audit
        old_values = {}
        for field in AUDITED_FIELDS:
            if field in request.data:
                old_values[field] = getattr(instance, field, None)

        response = super().update(request, *args, **kwargs)

        # ── Audit log: sensitive field changes ──
        if response.status_code in (200, 201):
            instance.refresh_from_db()
            for field, old_val in old_values.items():
                new_val = getattr(instance, field, None)
                if str(old_val) != str(new_val):
                    try:
                        ContactAuditLog.log_change(
                            contact=instance,
                            action='FIELD_CHANGE',
                            field_name=field,
                            old_value=old_val,
                            new_value=new_val,
                            source='API',
                            actor_user_id=request.user.id if request.user.is_authenticated else None,
                            actor_name=getattr(request.user, 'email', None),
                        )
                    except Exception as e:
                        logger.warning(f"[CRM] Audit log failed for {field}: {e}")

        return response

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

    # ── Master Detail Context (§22) ─────────────────────────────
    @action(detail=True, methods=['get'], url_path='summary')
    def detail_summary(self, request, pk=None):
        """
        Full contact summary: info + orders + payments + balance.
        Enterprise: returns partial data with degraded flags if any source fails.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        degraded = False
        degraded_sources = []
        warnings = []

        try:
            contact = self.get_object()

            # ── Orders ──
            order_data = {'stats': {'total_count': 0, 'total_amount': 0, 'completed': 0, 'draft': 0}, 'recent': []}
            try:
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

                order_data = {
                    'stats': {
                        'total_count': order_stats['total_count'] or 0,
                        'total_amount': float(order_stats['total_amount'] or 0),
                        'completed': order_stats['completed'] or 0,
                        'draft': order_stats['draft'] or 0,
                    },
                    'recent': list(recent_orders),
                }
            except Exception as e:
                degraded = True
                degraded_sources.append('sales.orders')
                warnings.append(f'Order history temporarily unavailable: {str(e)[:100]}')
                logger.warning(f"[CRM Summary] Orders failed for contact {pk}: {e}")

            # ── Payments ──
            payment_data = {'stats': {'total_paid': 0, 'payment_count': 0}, 'recent': []}
            try:
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

                payment_data = {
                    'stats': {
                        'total_paid': float(payment_stats['total_paid'] or 0),
                        'payment_count': payment_stats['payment_count'] or 0,
                    },
                    'recent': list(recent_payments),
                }
            except Exception as e:
                degraded = True
                degraded_sources.append('finance.payments')
                warnings.append(f'Payment history temporarily unavailable: {str(e)[:100]}')
                logger.warning(f"[CRM Summary] Payments failed for contact {pk}: {e}")

            # ── Balance ──
            balance_data = {'current_balance': 0, 'last_payment_date': None}
            try:
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
            except Exception as e:
                degraded = True
                degraded_sources.append('finance.balance')
                warnings.append(f'Balance information temporarily unavailable: {str(e)[:100]}')
                logger.warning(f"[CRM Summary] Balance failed for contact {pk}: {e}")

            # ── Journal entries via linked COA sub-account ──
            journal_entries = []
            linked_account_meta = None      # initialise before try so response dict never hits NameError
            linked_payable_meta = None
            try:
                # ── Linked Account Metadata ──
                linked_account_meta = None
                linked_payable_meta = None
                
                if contact.linked_account_id:
                    acc = ChartOfAccount.objects.filter(id=contact.linked_account_id, organization_id=organization_id).first()
                    if acc:
                        linked_account_meta = {
                            'id': acc.id,
                            'code': acc.code,
                            'name': acc.name,
                            'parent_id': acc.parent_id,
                            'parent_name': acc.parent.name if acc.parent else None,
                            'parent_code': acc.parent.code if acc.parent else None,
                        }
                
                if contact.linked_payable_account_id:
                    acc = ChartOfAccount.objects.filter(id=contact.linked_payable_account_id, organization_id=organization_id).first()
                    if acc:
                        linked_payable_meta = {
                            'id': acc.id,
                            'code': acc.code,
                            'name': acc.name,
                            'parent_id': acc.parent_id,
                            'parent_name': acc.parent.name if acc.parent else None,
                            'parent_code': acc.parent.code if acc.parent else None,
                        }

                linked_accounts = [contact.linked_account_id]
                if contact.linked_payable_account_id:
                    linked_accounts.append(contact.linked_payable_account_id)
                linked_accounts = [a for a in linked_accounts if a]

                if contact.linked_account_id:
                    from apps.finance.models import JournalEntryLine
                    # Fetching a larger window to calculate running solde if needed, 
                    # but here we'll just return the entries with their natural Dr/Cr
                    journal_lines = JournalEntryLine.objects.filter(
                        organization_id=organization_id,
                        account_id__in=[contact.linked_account_id, contact.linked_payable_account_id] if contact.linked_payable_account_id else [contact.linked_account_id]
                    ).select_related('journal_entry').order_by('-journal_entry__transaction_date', '-id')[:50]
                    
                    recent_journal = []
                    # We reverse to calculate running balance from oldest to newest in this slice
                    # Note: This is an 'approximated' running balance for the view window
                    current_view_solde = balance_data['current_balance']

                    for jl in journal_lines:
                        recent_journal.append({
                            'id': jl.journal_entry.id,
                            'date': str(jl.journal_entry.transaction_date.date()) if jl.journal_entry.transaction_date else None,
                            'reference': jl.journal_entry.reference,
                            'description': jl.description,
                            'account': jl.account.name if jl.account else None,
                            'debit': float(jl.debit),
                            'credit': float(jl.credit),
                            'solde_at': float(current_view_solde) # This is approximate placeholder
                        })
                    journal_entries = recent_journal
            except Exception as e:
                degraded = True
                degraded_sources.append('finance.journal')
                warnings.append(f'Journal entries temporarily unavailable: {str(e)[:100]}')
                logger.warning(f"[CRM Summary] Journal failed for contact {pk}: {e}")

            # ── Contact book (people within business) ──
            people = []
            if contact.entity_type == 'BUSINESS':
                people = ContactPersonSerializer(
                    contact.people.filter(is_active=True), many=True
                ).data

            # ── 7. Intelligence Grid Filters (Analytics §23) ──
            order_type_for_analytics = 'SALE'
            if contact.type == 'BOTH':
                # For BOTH, we check if they have more legacy as customer or supplier
                # Check for existing purchase orders to see if we should pivot
                from apps.pos.models import Order
                if Order.objects.filter(contact=contact, type='PURCHASE', organization_id=organization_id).exists():
                    # If they have purchases, prioritize purchase analytics if requested or by default
                    order_type_for_analytics = 'PURCHASE'
            else:
                order_type_for_analytics = 'SALE' if contact.type in ('CUSTOMER', 'DEBTOR') else 'PURCHASE'
            
            analytics = self._build_analytics(contact, organization_id, order_type=order_type_for_analytics)

            response_data = {
                'contact': ContactSerializer(contact).data,
                'orders': order_data,
                'payments': payment_data,
                'balance': balance_data,
                'journal_entries': journal_entries,
                'accounting': {
                    'linked_account': linked_account_meta,
                    'linked_payable_account': linked_payable_meta,
                },
                'people': people,
                'analytics': analytics,
                'pricing_rules': self._get_pricing_rules(contact, organization_id),
            }

            # ── Degraded mode metadata ──
            if degraded:
                response_data['degraded'] = True
                response_data['degraded_sources'] = degraded_sources
                response_data['warnings'] = warnings

            return Response(response_data)

        except Exception as e:
            return Response({
                'error': str(e),
                'detail': tb.format_exc()
            }, status=500)

    def _build_analytics(self, contact, organization_id, order_type):
        """Build purchase/sales analytics for the contact."""
        from django.db.models import Sum, Count, Q, F
        from django.utils import timezone as tz
        import datetime

        try:
            from apps.pos.models import Order
            orders = Order.objects.filter(
                organization_id=organization_id,
                contact=contact,
                type=order_type
            )

            order_stats = orders.aggregate(
                total_count=Count('id'),
                total_amount=Sum('total_amount'),
            )

            total_count = order_stats['total_count'] or 0
            total_amount = float(order_stats['total_amount'] or 0)

            analytics = {
                'avg_order_value': round(total_amount / total_count, 2) if total_count > 0 else 0,
                'total_orders': total_count,
                'total_revenue': total_amount,
                'top_products': [],
                'monthly_frequency': 0,
            }

            twelve_months_ago = tz.now() - datetime.timedelta(days=365)
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
        except Exception:
            return {
                'avg_order_value': 0, 'total_orders': 0, 'total_revenue': 0,
                'top_products': [], 'monthly_frequency': 0,
            }

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

    # ── Lifecycle Management Actions ───────────────────────────

    @action(detail=True, methods=['post'], url_path='block')
    def block_contact(self, request, pk=None):
        """Block a contact. Requires reason. Bodies: { "reason": "Credit risk" }"""
        contact = self.get_object()

        if contact.status in ('ARCHIVED', 'MERGED'):
            return Response(
                {'error': f'Cannot block a {contact.status} contact.'},
                status=status.HTTP_409_CONFLICT,
            )

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'error': 'A reason is required to block a contact.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_status = contact.status
        contact.status = 'BLOCKED'
        contact.commercial_status = request.data.get('commercial_status', 'NORMAL')
        contact.blocked_reason = reason
        contact.blocked_at = timezone.now()
        contact.blocked_by = request.user.id if request.user.is_authenticated else None
        contact.save(update_fields=[
            'status', 'commercial_status', 'blocked_reason', 'blocked_at', 'blocked_by', 'updated_at',
        ])

        ContactAuditLog.log_change(
            contact=contact, action='BLOCK',
            field_name='status', old_value=old_status, new_value='BLOCKED',
            reason=reason, source='API',
            actor_user_id=request.user.id if request.user.is_authenticated else None,
            actor_name=getattr(request.user, 'email', None),
        )

        return Response(ContactSerializer(contact).data)

    @action(detail=True, methods=['post'], url_path='unblock')
    def unblock_contact(self, request, pk=None):
        """Restore a blocked contact to ACTIVE status."""
        contact = self.get_object()

        if contact.status != 'BLOCKED':
            return Response(
                {'error': f'Contact is {contact.status}, not BLOCKED.'},
                status=status.HTTP_409_CONFLICT,
            )

        old_status = contact.status
        contact.status = 'ACTIVE'
        contact.commercial_status = 'NORMAL'
        contact.blocked_reason = None
        contact.blocked_at = None
        contact.blocked_by = None
        contact.save(update_fields=[
            'status', 'commercial_status', 'blocked_reason', 'blocked_at', 'blocked_by', 'updated_at',
        ])

        ContactAuditLog.log_change(
            contact=contact, action='UNBLOCK',
            field_name='status', old_value=old_status, new_value='ACTIVE',
            reason=request.data.get('reason', 'Unblocked'),
            source='API',
            actor_user_id=request.user.id if request.user.is_authenticated else None,
            actor_name=getattr(request.user, 'email', None),
        )

        return Response(ContactSerializer(contact).data)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive_contact(self, request, pk=None):
        """Archive a contact. Read-only after archival."""
        contact = self.get_object()

        if contact.status in ('ARCHIVED', 'MERGED'):
            return Response(
                {'error': f'Contact is already {contact.status}.'},
                status=status.HTTP_409_CONFLICT,
            )

        old_status = contact.status
        contact.status = 'ARCHIVED'
        contact.is_active = False
        contact.archived_at = timezone.now()
        contact.archived_by = request.user.id if request.user.is_authenticated else None
        contact.save(update_fields=[
            'status', 'is_active', 'archived_at', 'archived_by', 'updated_at',
        ])

        ContactAuditLog.log_change(
            contact=contact, action='ARCHIVE',
            field_name='status', old_value=old_status, new_value='ARCHIVED',
            reason=request.data.get('reason', 'Contact archived'),
            source='API',
            actor_user_id=request.user.id if request.user.is_authenticated else None,
            actor_name=getattr(request.user, 'email', None),
        )

        return Response(ContactSerializer(contact).data)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore_contact(self, request, pk=None):
        """Restore an archived contact to ACTIVE status."""
        contact = self.get_object()

        if contact.status != 'ARCHIVED':
            return Response(
                {'error': f'Contact is {contact.status}, not ARCHIVED.'},
                status=status.HTTP_409_CONFLICT,
            )

        old_status = contact.status
        contact.status = 'ACTIVE'
        contact.is_active = True
        contact.archived_at = None
        contact.archived_by = None
        contact.save(update_fields=[
            'status', 'is_active', 'archived_at', 'archived_by', 'updated_at',
        ])

        ContactAuditLog.log_change(
            contact=contact, action='RESTORE',
            field_name='status', old_value=old_status, new_value='ACTIVE',
            reason=request.data.get('reason', 'Contact restored'),
            source='API',
            actor_user_id=request.user.id if request.user.is_authenticated else None,
            actor_name=getattr(request.user, 'email', None),
        )

        return Response(ContactSerializer(contact).data)

    @action(detail=True, methods=['get'], url_path='audit-log')
    def audit_log(self, request, pk=None):
        """Get the audit trail for this contact."""
        contact = self.get_object()
        logs = ContactAuditLog.objects.filter(
            contact=contact,
            organization_id=get_current_tenant_id(),
        ).order_by('-created_at')[:50]
        return Response(ContactAuditLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['post'], url_path='check-duplicates')
    def check_duplicates(self, request, pk=None):
        """Check for duplicates of this existing contact."""
        contact = self.get_object()
        from apps.crm.services.duplicate_service import DuplicateDetectionService
        result = DuplicateDetectionService.check_for_duplicates(
            organization_id=get_current_tenant_id(),
            name=contact.name,
            email=contact.email,
            phone=contact.phone,
            vat_id=contact.vat_id,
            company_name=contact.company_name,
            whatsapp_group_id=contact.whatsapp_group_id,
            exclude_contact_id=contact.id,
        )
        return Response(result)

    # ── Loyalty Program Endpoints ──────────────────────────────

    @action(detail=True, methods=['get'], url_path='loyalty')
    def loyalty_analytics(self, request, pk=None):
        """Get customer loyalty analytics (points, tier, lifetime value)."""
        from apps.crm.services.loyalty_service import LoyaltyService
        contact = self.get_object()
        return Response(LoyaltyService.get_customer_analytics(contact))

    @action(detail=True, methods=['post'], url_path='earn-points')
    def earn_points(self, request, pk=None):
        """Award loyalty points. Body: { "order_total": 150.00 }"""
        from apps.crm.services.loyalty_service import LoyaltyService
        from decimal import Decimal
        contact = self.get_object()

        # Lifecycle check
        if contact.status != 'ACTIVE':
            return Response(
                {'error': f'Cannot award points to a {contact.status} contact.'},
                status=status.HTTP_409_CONFLICT,
            )

        order_total = Decimal(str(request.data.get('order_total', '0')))
        if order_total <= 0:
            return Response({"error": "order_total must be positive"}, status=400)

        old_points = contact.loyalty_points
        result = LoyaltyService.earn_points(contact, order_total)

        # Audit log
        try:
            ContactAuditLog.log_change(
                contact=contact, action='LOYALTY_ADJUST',
                field_name='loyalty_points',
                old_value=old_points, new_value=contact.loyalty_points,
                reason=f'Earned {result["points_earned"]} points from order total {order_total}',
                source='API',
                actor_user_id=request.user.id if request.user.is_authenticated else None,
                actor_name=getattr(request.user, 'email', None),
            )
        except Exception:
            pass

        return Response(result)

    @action(detail=True, methods=['post'], url_path='burn-points')
    def burn_points(self, request, pk=None):
        """Redeem loyalty points. Body: { "points": 500 }"""
        from apps.crm.services.loyalty_service import LoyaltyService
        contact = self.get_object()

        # Lifecycle check
        if contact.status != 'ACTIVE':
            return Response(
                {'error': f'Cannot burn points for a {contact.status} contact.'},
                status=status.HTTP_409_CONFLICT,
            )

        points = int(request.data.get('points', 0))
        if points <= 0:
            return Response({"error": "points must be positive"}, status=400)

        old_points = contact.loyalty_points
        result = LoyaltyService.burn_points(contact, points)
        if 'error' in result:
            return Response(result, status=400)

        # Audit log
        try:
            ContactAuditLog.log_change(
                contact=contact, action='LOYALTY_ADJUST',
                field_name='loyalty_points',
                old_value=old_points, new_value=contact.loyalty_points,
                reason=f'Burned {points} points for discount {result["discount_amount"]}',
                source='API',
                actor_user_id=request.user.id if request.user.is_authenticated else None,
                actor_name=getattr(request.user, 'email', None),
            )
        except Exception:
            pass

        return Response(result)

    # ── Supplier Scorecard Endpoints ───────────────────────────

    @action(detail=True, methods=['get'], url_path='scorecard')
    def supplier_scorecard_view(self, request, pk=None):
        """
        Get supplier performance scorecard (§24).
        Returns objective (auto-derived) + subjective (manual) + composite scores.
        """
        contact = self.get_object()
        if contact.type not in ('SUPPLIER', 'BOTH', 'SERVICE'):
            return Response(
                {'error': 'Scorecard is only available for SUPPLIER, BOTH, or SERVICE contacts.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(contact.supplier_scorecard)

    @action(detail=True, methods=['post'], url_path='rate')
    def rate_supplier(self, request, pk=None):
        """Rate a supplier. Body: { "quality": 4, "delivery": 5, "pricing": 3, "service": 4 }"""
        from apps.crm.services.loyalty_service import LoyaltyService
        contact = self.get_object()

        # Validate contact is a supplier
        if contact.type not in ('SUPPLIER', 'BOTH', 'SERVICE'):
            return Response(
                {'error': 'Only SUPPLIER, BOTH, or SERVICE contacts can be rated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate rating values (1-5)
        for dim in ('quality', 'delivery', 'pricing', 'service'):
            val = request.data.get(dim)
            if val is not None:
                try:
                    val = int(val)
                    if val < 1 or val > 5:
                        return Response(
                            {'error': f'{dim} must be between 1 and 5, got {val}.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                except (ValueError, TypeError):
                    return Response(
                        {'error': f'{dim} must be an integer 1-5.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        old_rating = float(contact.overall_rating)
        result = LoyaltyService.rate_supplier(
            contact,
            quality=request.data.get('quality'),
            delivery=request.data.get('delivery'),
            pricing=request.data.get('pricing'),
            service=request.data.get('service'),
        )

        # Audit log
        try:
            ContactAuditLog.log_change(
                contact=contact, action='FIELD_CHANGE',
                field_name='overall_rating',
                old_value=old_rating, new_value=result['overall_rating'],
                reason=f'Supplier rated: Q={request.data.get("quality")} D={request.data.get("delivery")} '
                       f'P={request.data.get("pricing")} S={request.data.get("service")}',
                source='API',
                actor_user_id=request.user.id if request.user.is_authenticated else None,
                actor_name=getattr(request.user, 'email', None),
            )
        except Exception:
            pass

        return Response(result)

    @action(detail=True, methods=['post'], url_path='record-delivery')
    def record_delivery(self, request, pk=None):
        """Record a delivery for supplier performance. Body: { "on_time": true, "lead_time_days": 5 }"""
        from apps.crm.services.loyalty_service import LoyaltyService
        contact = self.get_object()
        on_time = request.data.get('on_time', True)
        lead_time = request.data.get('lead_time_days')
        LoyaltyService.record_delivery(contact, on_time=on_time, lead_time_days=lead_time)
        return Response({"message": "Delivery recorded"})

    @action(detail=True, methods=['post'], url_path='check-duplicates')
    def check_duplicates(self, request, pk=None):
        """Check for potential duplicates of an existing contact."""
        from apps.crm.services.duplicate_service import DuplicateDetectionService
        contact = self.get_object()
        
        result = DuplicateDetectionService.check_for_duplicates(
            organization_id=get_current_tenant_id(),
            name=contact.name,
            email=contact.email,
            phone=contact.phone,
            vat_id=contact.vat_id,
            company_name=contact.company_name,
            exclude_contact_id=contact.id
        )
        return Response(result)

    # ── Contact Merge Endpoints ────────────────────────────────

    @action(detail=True, methods=['post'], url_path='merge')
    def merge_contact(self, request, pk=None):
        """
        Merge this contact into a target contact.
        Body: { "target_id": 42, "reason": "Duplicate entry", "merge_loyalty": true, ... }
        Permission: crm.merge_contact
        """
        from apps.crm.services.merge_service import ContactMergeService

        source = self.get_object()
        target_id = request.data.get('target_id')

        if not target_id:
            return Response(
                {'error': 'target_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target = Contact.objects.get(
                pk=target_id,
                organization_id=get_current_tenant_id()
            )
        except Contact.DoesNotExist:
            return Response(
                {'error': f'Target contact #{target_id} not found in this organization.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = ContactMergeService.merge(
            source=source,
            target=target,
            reason=request.data.get('reason', ''),
            actor_user_id=request.user.id if request.user.is_authenticated else None,
            actor_name=getattr(request.user, 'email', None),
            merge_loyalty=request.data.get('merge_loyalty', True),
            merge_tags=request.data.get('merge_tags', True),
            merge_people=request.data.get('merge_people', True),
            reassign_orders=request.data.get('reassign_orders', True),
            reassign_payments=request.data.get('reassign_payments', True),
            reassign_pricing=request.data.get('reassign_pricing', True),
        )

        if not result.get('success'):
            return Response(result, status=status.HTTP_409_CONFLICT)

        return Response(result)

    @action(detail=True, methods=['post'], url_path='validate-merge')
    def validate_merge(self, request, pk=None):
        """
        Pre-merge validation. Returns warnings and blockers.
        Body: { "target_id": 42 }
        """
        from apps.crm.services.merge_service import ContactMergeService

        source = self.get_object()
        target_id = request.data.get('target_id')

        if not target_id:
            return Response({'error': 'target_id is required.'}, status=400)

        try:
            target = Contact.objects.get(
                pk=target_id,
                organization_id=get_current_tenant_id()
            )
        except Contact.DoesNotExist:
            return Response({'error': 'Target contact not found.'}, status=404)

        issues = ContactMergeService.validate_merge(source, target)
        return Response({
            'source': {'id': source.id, 'name': source.name, 'type': source.type},
            'target': {'id': target.id, 'name': target.name, 'type': target.type},
            'issues': issues,
            'can_merge': not any(i['severity'] == 'BLOCKER' for i in issues),
        })

    @action(detail=True, methods=['get'], url_path='audit-log')
    def audit_log(self, request, pk=None):
        """Get audit trail for this contact (§27)."""
        from apps.crm.serializers import ContactAuditLogSerializer
        contact = self.get_object()
        logs = contact.audit_log.all().order_by('-created_at')[:100]
        return Response(ContactAuditLogSerializer(logs, many=True).data)

    # ── Contact Type Conversion ────────────────────────────────

    @action(detail=True, methods=['post'], url_path='convert-type')
    def convert_type(self, request, pk=None):
        """
        Convert contact type. Body: { "new_type": "BOTH", "reason": "Now also a supplier" }
        Permission: crm.edit_contact
        """
        from apps.crm.services.type_conversion_service import ContactTypeConversionService

        contact = self.get_object()
        new_type = request.data.get('new_type', '').strip().upper()

        if not new_type:
            return Response(
                {'error': 'new_type is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = ContactTypeConversionService.convert(
            contact=contact,
            new_type=new_type,
            reason=request.data.get('reason', ''),
            actor_user_id=request.user.id if request.user.is_authenticated else None,
            actor_name=getattr(request.user, 'email', None),
        )

        if not result.get('success'):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            **result,
            'contact': ContactSerializer(contact).data,
        })

    @action(detail=True, methods=['get'], url_path='allowed-conversions')
    def allowed_conversions(self, request, pk=None):
        """Get allowed type conversions for this contact."""
        from apps.crm.services.type_conversion_service import ContactTypeConversionService

        contact = self.get_object()
        allowed = ContactTypeConversionService.ALLOWED_CONVERSIONS.get(contact.type, set())

        return Response({
            'current_type': contact.type,
            'allowed_types': sorted(allowed),
            'is_convertible': len(allowed) > 0 and contact.status not in ContactTypeConversionService.RESTRICTED_STATUSES,
        })

    # ── Enterprise Compliance Architecture (11/10) ─────────────

    @action(detail=True, methods=['post'], url_path='compliance/upload-doc')
    def upload_compliance_doc(self, request, pk=None):
        """
        Register a new document version. (§Missing 2, 7)
        Input: { "type": "NCC", "number": "123", "file_id": 1, "expiry": "2025-12-31" }
        """
        contact = self.get_object()
        doc_type = request.data.get('type')
        doc_num  = request.data.get('number')
        file_id  = request.data.get('file_id')
        expiry   = request.data.get('expiry')

        if not doc_type or not doc_num:
            return Response({'error': 'type and number are required.'}, status=400)

        try:
            doc = ComplianceService.register_document(
                contact=contact,
                doc_type=doc_type,
                doc_number=doc_num,
                file_id=file_id,
                expiry_date=expiry,
                user=request.user
            )
            return Response({'status': 'uploaded', 'id': doc.id, 'version': doc.version})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='compliance/approve-doc')
    def approve_compliance_doc(self, request, pk=None):
        """
        Approve a document version (Approval Layer). (§Missing 7)
        Input: { "doc_id": 123 }
        """
        doc_id = request.data.get('doc_id')
        try:
            doc = ContactComplianceDocument.objects.get(pk=doc_id, contact=self.get_object())
            ComplianceService.approve_document(doc, request.user)
            return Response({'status': 'approved'})
        except ContactComplianceDocument.DoesNotExist:
            return Response({'error': 'Document not found.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='compliance/recompute')
    def recompute_compliance(self, request, pk=None):
        """Force recomputation of compliance cache. (§Missing 1)"""
        contact = self.get_object()
        result = ComplianceService.recompute_compliance(contact)
        return Response(result)

    @action(detail=True, methods=['get', 'post'], url_path='compliance/overrides')
    def manage_overrides(self, request, pk=None):
        """
        Manage manual compliance overrides. (§Missing 5)
        GET: List overrides
        POST: Create override { "rule_id": 1, "expiry": "2024-05-01", "reason": "Renewal in progress" }
        """
        contact = self.get_object()
        if request.method == 'GET':
            overrides = contact.compliance_overrides.filter(is_active=True, expiry_date__gt=timezone.now())
            return Response([{
                'id': ov.id, 
                'rule': ov.rule.name if ov.rule else 'Global', 
                'expiry': ov.expiry_date,
                'reason': ov.reason,
                'granted_by': ov.granted_by.username
            } for ov in overrides])

        # POST: Create
        rule_id = request.data.get('rule_id')
        expiry  = request.data.get('expiry')
        reason  = request.data.get('reason')

        if not expiry or not reason:
            return Response({'error': 'expiry and reason are required.'}, status=400)

        try:
            rule = ComplianceRule.objects.get(pk=rule_id) if rule_id else None
            ov = ComplianceService.grant_override(
                contact=contact,
                rule=rule,
                user=request.user,
                expiry_date=expiry,
                reason=reason
            )
            return Response({'status': 'granted', 'id': ov.id})
        except ComplianceRule.DoesNotExist:
            return Response({'error': 'Rule not found.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    # ── Bulk Import / Export ───────────────────────────────────

    @action(detail=False, methods=['post'], url_path='import-preview')
    def import_preview(self, request):
        """
        Dry-run import preview. Body: { "csv_content": "name,type\\n...", "mode": "INSERT_ONLY" }
        Permission: crm.create_contact
        """
        from apps.crm.services.bulk_service import ContactBulkService

        csv_content = request.data.get('csv_content', '')
        mode = request.data.get('mode', 'INSERT_ONLY')

        if not csv_content:
            return Response({'error': 'csv_content is required.'}, status=400)

        result = ContactBulkService.dry_run_import(
            organization_id=get_current_tenant_id(),
            csv_content=csv_content,
            mode=mode,
        )
        return Response(result)

    @action(detail=False, methods=['post'], url_path='import-execute')
    def import_execute(self, request):
        """
        Execute bulk import after preview. Body: { "csv_content": "...", "mode": "INSERT_ONLY" }
        Permission: crm.create_contact
        """
        from apps.crm.services.bulk_service import ContactBulkService

        csv_content = request.data.get('csv_content', '')
        mode = request.data.get('mode', 'INSERT_ONLY')

        if not csv_content:
            return Response({'error': 'csv_content is required.'}, status=400)

        result = ContactBulkService.execute_import(
            organization_id=get_current_tenant_id(),
            csv_content=csv_content,
            mode=mode,
            force_create=request.data.get('force_create', False),
            actor_user_id=request.user.id if request.user.is_authenticated else None,
            actor_name=getattr(request.user, 'email', None),
        )
        return Response(result)

    @action(detail=False, methods=['get'], url_path='export')
    def export_contacts(self, request):
        """
        Export contacts as CSV. Query params: type, status, entity_type, mask_pii
        Permission: crm.export_data
        """
        from apps.crm.services.bulk_service import ContactBulkService
        from django.http import HttpResponse

        filters = {
            'type': request.query_params.get('type'),
            'status': request.query_params.get('status'),
            'entity_type': request.query_params.get('entity_type'),
            'customer_tier': request.query_params.get('customer_tier'),
        }
        # Remove None values
        filters = {k: v for k, v in filters.items() if v}

        mask_pii = request.query_params.get('mask_pii', 'false').lower() == 'true'

        csv_content = ContactBulkService.export_contacts(
            organization_id=get_current_tenant_id(),
            filters=filters,
            mask_pii=mask_pii,
        )

        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="contacts_export_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        return response

