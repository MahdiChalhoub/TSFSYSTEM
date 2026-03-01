"""
Migration Module API Views.
Provides endpoints for uploading SQL dumps, running migrations, checking status, and rollback.
"""
import os
import threading
import logging
import re

from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.migration.models import MigrationJob, MigrationMapping
from apps.migration.serializers import (
    MigrationJobSerializer, MigrationJobDetailSerializer,
    MigrationUploadSerializer, MigrationDirectDBSerializer,
    MigrationMappingSerializer, MigrationPreviewSerializer,
    MigrationLinkSerializer,
)
from apps.migration.services import MigrationService, MigrationRollbackService
from apps.migration.parsers import SQLDumpParser

from rest_framework import permissions
from erp.permissions import IsOrgAdmin
from django.db import transaction

logger = logging.getLogger(__name__)

# Directory where uploaded SQL files are stored
MIGRATION_UPLOAD_DIR = os.path.join(
    getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media')),
    'migration_uploads'
)



class MigrationReviewMixin:

    @action(detail=True, methods=['get'], url_path='all-records')
    def all_records(self, request, pk=None):
        """Returns ALL migrated records (paginated) for a specific entity type.
        Each row has enriched source_raw + target_state with ledger info."""
        job = self.get_object()
        entity_type = request.query_params.get('entity_type', 'TRANSACTION')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))

        total_qs = MigrationMapping.objects.filter(job=job, entity_type=entity_type)
        total_count = total_qs.count()
        offset = (page - 1) * page_size
        mappings = list(total_qs.order_by('id')[offset:offset + page_size])

        records = []
        for m in mappings:
            target_data = self._load_target_enriched(entity_type, m.target_id)
            records.append({
                'mapping_id': m.id,
                'source_id': m.source_id,
                'target_id': m.target_id,
                'source_raw': m.extra_data or {},
                'target_state': target_data,
            })

        return Response({
            'entity_type': entity_type,
            'job_id': job.id,
            'total': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_count + page_size - 1) // page_size,
            'records': records,
        })

    @action(detail=True, methods=['get'], url_path='audit-summary')
    def audit_summary(self, request, pk=None):
        """Returns aggregate diagnostic info for a given entity type.
        Automatically resolves all maps (posting rules, account maps) so the
        client never has to manually choose a mapping target."""
        job = self.get_object()
        entity_type = request.query_params.get('entity_type', 'TRANSACTION')
        
        mapping_ids = list(MigrationMapping.objects.filter(
            job=job, entity_type=entity_type
        ).values_list('target_id', flat=True))
        
        # Load organization + posting rules
        from erp.models import Organization
        from erp.services import ConfigurationService
        organization = Organization.objects.get(id=job.organization_id)
        rules = ConfigurationService.get_posting_rules(organization)
        
        summary = {
            'entity_type': entity_type,
            'total': len(mapping_ids),
            'diagnostics': {},
            'actions_available': [],
            'resolved_map': {},  # Shows the auto-resolved map to the user
        }
        
        # Helper: resolve COA name from ID
        def coa_label(coa_id):
            if not coa_id:
                return None
            from apps.finance.models.coa_models import ChartOfAccount
            try:
                c = ChartOfAccount.objects.get(id=coa_id)
                return {'id': c.id, 'code': c.code, 'name': c.name, 'type': c.type}
            except ChartOfAccount.DoesNotExist:
                return {'id': coa_id, 'code': '?', 'name': 'NOT FOUND', 'type': '?'}
        
        try:
            if entity_type == 'CONTACT':
                from apps.crm.models import Contact
                contacts = Contact.objects.filter(id__in=mapping_ids)
                customers = contacts.filter(type='CUSTOMER')
                suppliers = contacts.filter(type='SUPPLIER')
                both = contacts.filter(type='BOTH')
                
                linked = contacts.filter(linked_account_id__isnull=False).count()
                unlinked = contacts.filter(linked_account_id__isnull=True).count()
                
                # Resolve the auto-map from posting rules
                customer_root_id = rules.get('automation', {}).get('customerRoot') or \
                                   rules.get('sales', {}).get('receivable')
                supplier_root_id = rules.get('automation', {}).get('supplierRoot') or \
                                   rules.get('purchases', {}).get('payable')
                
                summary['resolved_map'] = {
                    'customer_root': coa_label(customer_root_id),
                    'supplier_root': coa_label(supplier_root_id),
                    'source': 'posting_rules.automation.customerRoot / supplierRoot',
                }
                
                summary['diagnostics'] = {
                    'customers': customers.count(),
                    'suppliers': suppliers.count(),
                    'both': both.count(),
                    'linked_to_ledger': linked,
                    'not_linked': unlinked,
                    'link_rate': round((linked / max(len(mapping_ids), 1)) * 100, 1),
                }
                
                unlinked_customers = customers.filter(linked_account_id__isnull=True).count()
                unlinked_suppliers = suppliers.filter(linked_account_id__isnull=True).count()
                unlinked_both = both.filter(linked_account_id__isnull=True).count()
                
                summary['actions_available'] = []
                if unlinked_customers > 0:
                    summary['actions_available'].append({
                        'key': 'link_customers', 
                        'label': f'Auto-link {unlinked_customers} Customers → {coa_label(customer_root_id)["code"] if customer_root_id else "?"} {coa_label(customer_root_id)["name"] if customer_root_id else "NOT SET"}',
                        'count': unlinked_customers,
                        'auto_resolved': True,
                    })
                if unlinked_suppliers > 0:
                    summary['actions_available'].append({
                        'key': 'link_suppliers', 
                        'label': f'Auto-link {unlinked_suppliers} Suppliers → {coa_label(supplier_root_id)["code"] if supplier_root_id else "?"} {coa_label(supplier_root_id)["name"] if supplier_root_id else "NOT SET"}',
                        'count': unlinked_suppliers,
                        'auto_resolved': True,
                    })
                if unlinked_both > 0:
                    summary['actions_available'].append({
                        'key': 'link_both',
                        'label': f'Auto-link {unlinked_both} "Both" → {coa_label(customer_root_id)["code"] if customer_root_id else "?"}',
                        'count': unlinked_both,
                        'auto_resolved': True,
                    })
                
            elif entity_type == 'TRANSACTION':
                from apps.pos.models import Order
                orders = Order.objects.filter(id__in=mapping_ids)
                draft = orders.filter(status='DRAFT').count()
                completed = orders.filter(status='COMPLETED').count()
                
                # Show the posting rules map for transactions
                summary['resolved_map'] = {
                    'receivable': coa_label(rules.get('sales', {}).get('receivable')),
                    'revenue': coa_label(rules.get('sales', {}).get('revenue')),
                    'cogs': coa_label(rules.get('sales', {}).get('cogs')),
                    'inventory': coa_label(rules.get('sales', {}).get('inventory')),
                    'payable': coa_label(rules.get('purchases', {}).get('payable')),
                    'source': 'posting_rules.sales / posting_rules.purchases',
                }
                
                # Check journal entries by reference pattern
                from apps.finance.models.ledger_models import JournalEntry
                mig_je_count = JournalEntry.objects.filter(
                    organization=organization,
                    reference__startswith=f'MIG-AT-{job.id}-'
                ).count()
                
                summary['diagnostics'] = {
                    'draft': draft,
                    'completed': completed,
                    'migration_journal_entries': mig_je_count,
                    'uses_suspense_accounts': mig_je_count > 0,
                }
                summary['actions_available'] = [
                    {'key': 'approve_drafts', 'label': f'Approve {draft} Draft Transactions', 'count': draft, 'auto_resolved': True},
                ]
                
            elif entity_type == 'ACCOUNT':
                from apps.finance.models import FinancialAccount
                accounts = FinancialAccount.objects.filter(id__in=mapping_ids)
                linked = accounts.filter(ledger_account_id__isnull=False).count()
                unlinked = accounts.filter(ledger_account_id__isnull=True).count()
                
                # Show which accounts are auto-mapped
                mapped_accounts = []
                for fa in accounts.filter(ledger_account_id__isnull=False)[:5]:
                    mapped_accounts.append({
                        'account': fa.name,
                        'coa': coa_label(fa.ledger_account_id),
                    })
                
                summary['resolved_map'] = {
                    'auto_mapped_samples': mapped_accounts,
                    'source': 'migration _migrate_accounts() auto-match by name/code',
                }
                
                summary['diagnostics'] = {
                    'linked_to_coa': linked,
                    'not_linked': unlinked,
                    'link_rate': round((linked / max(len(mapping_ids), 1)) * 100, 1),
                }
                summary['actions_available'] = [
                    {'key': 'open_mapping', 'label': 'Open COA Mapping Tool', 'count': unlinked},
                ]
                
            elif entity_type == 'EXPENSE':
                from apps.finance.models import DirectExpense
                expenses = DirectExpense.objects.filter(id__in=mapping_ids)
                draft = expenses.filter(status='DRAFT').count()
                posted = expenses.filter(status='POSTED').count()
                
                summary['diagnostics'] = {
                    'draft': draft,
                    'posted': posted,
                }
                summary['actions_available'] = [
                    {'key': 'approve_drafts', 'label': f'Post {draft} Draft Expenses', 'count': draft, 'auto_resolved': True},
                ]
                
            elif entity_type == 'PRODUCT':
                from apps.inventory.models import Product
                products = Product.objects.filter(id__in=mapping_ids)
                draft = products.filter(status='DRAFT').count()
                active = products.filter(status='ACTIVE').count()
                
                summary['diagnostics'] = {
                    'draft': draft,
                    'active': active,
                }
                summary['actions_available'] = [
                    {'key': 'approve_drafts', 'label': f'Activate {draft} Draft Products', 'count': draft, 'auto_resolved': True},
                ]
        except Exception as e:
            import traceback
            summary['diagnostics']['error'] = str(e)
            summary['diagnostics']['trace'] = traceback.format_exc()

        return Response(summary)

    @action(detail=True, methods=['post'], url_path='bulk-link-ledger')
    def bulk_link_ledger(self, request, pk=None):
        """Bulk link contacts to COA sub-ledger accounts using posting rules.
        
        Uses LedgerService.create_linked_account() which creates proper 
        ChartOfAccount children under the parent (e.g., 1110-0001 for customers).
        Auto-reads posting rules — no manual COA selection needed.
        """
        job = self.get_object()
        contact_type = request.data.get('contact_type', 'CUSTOMER')  # CUSTOMER | SUPPLIER | BOTH
        
        from apps.crm.models import Contact
        from apps.finance.models.coa_models import ChartOfAccount
        from apps.finance.services import LedgerService
        from erp.services import ConfigurationService
        from erp.models import Organization
        
        org_id = job.organization_id
        organization = Organization.objects.get(id=org_id)
        rules = ConfigurationService.get_posting_rules(organization)
        
        # Resolve the COA parent from posting rules (exactly like ContactViewSet.create)
        if contact_type == 'CUSTOMER':
            parent_account_id = rules.get('automation', {}).get('customerRoot') or \
                                rules.get('sales', {}).get('receivable')
        elif contact_type == 'SUPPLIER':
            parent_account_id = rules.get('automation', {}).get('supplierRoot') or \
                                rules.get('purchases', {}).get('payable')
        else:
            # For BOTH, we link to customer root
            parent_account_id = rules.get('automation', {}).get('customerRoot') or \
                                rules.get('sales', {}).get('receivable')
        
        if not parent_account_id:
            # Fallback to well-known codes
            fallback_code = '1110' if contact_type == 'CUSTOMER' else '2101'
            parent = ChartOfAccount.objects.filter(organization=organization, code=fallback_code).first()
            if parent:
                parent_account_id = parent.id
        
        if not parent_account_id:
            return Response({'error': 'Cannot determine COA parent. Configure posting rules first.'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        try:
            parent_coa = ChartOfAccount.objects.get(id=parent_account_id)
        except ChartOfAccount.DoesNotExist:
            return Response({'error': f'COA parent account {parent_account_id} not found'}, status=404)
        
        mapping_ids = list(MigrationMapping.objects.filter(
            job=job, entity_type='CONTACT'
        ).values_list('target_id', flat=True))
        
        contacts = Contact.objects.filter(
            id__in=mapping_ids,
            type=contact_type,
            linked_account_id__isnull=True,
        )
        
        linked_count = 0
        errors = []
        sub_type = 'RECEIVABLE' if contact_type == 'CUSTOMER' else 'PAYABLE'
        suffix = 'AR' if contact_type == 'CUSTOMER' else 'AP'
        
        with transaction.atomic():
            for contact in contacts:
                try:
                    # Use LedgerService — creates COA child with parent_id + sequential code
                    linked_acc = LedgerService.create_linked_account(
                        organization=organization,
                        name=f"{contact.name} ({suffix})",
                        type=parent_coa.type,
                        sub_type=sub_type,
                        parent_id=parent_account_id
                    )
                    contact.linked_account_id = linked_acc.id
                    contact.save(update_fields=['linked_account_id'])
                    linked_count += 1
                except Exception as e:
                    errors.append(f"{contact.name}: {str(e)}")
        
        return Response({
            'linked': linked_count,
            'contact_type': contact_type,
            'coa_parent': parent_coa.name,
            'coa_parent_code': parent_coa.code,
            'errors': errors[:20],
        })

    @action(detail=True, methods=['post'], url_path='repost-journals')
    def repost_journals(self, request, pk=None):
        """Re-posts journal entries for migrated transactions using the correct posting rules.
        Removes suspense accounts (5700/6000) and creates proper Double-Entry ledgers.
        """
        job = self.get_object()
        org_id = job.organization_id
        
        from erp.models import Organization
        from apps.finance.models.ledger_models import JournalEntry, JournalEntryLine
        from apps.pos.models import Order
        from apps.finance.services import LedgerService
        
        organization = Organization.objects.get(id=org_id)
        
        # Get all migrated transactions
        mapping_ids = list(MigrationMapping.objects.filter(
            job=job, entity_type='TRANSACTION'
        ).values_list('target_id', flat=True))
        
        # Find all SALE journal entries linked to these transactions that use suspense accounts
        suspense_jes = JournalEntry.objects.filter(
            organization=organization,
            reference_type='SALE',
            reference_id__in=mapping_ids,
            lines__account__code__in=['5700', '6000']
        ).distinct()
        
        count = suspense_jes.count()
        if count == 0:
            return Response({'message': 'No suspense journal entries found to re-post.', 'count': 0})
            
        success_count = 0
        errors = []
        
        # We process asynchronously if there are many, but for now we do a chunk
        # If there are thousands, this might time out, but we limit to a safe chunk or do it all.
        jes_to_process = list(suspense_jes[:500])
        
        with transaction.atomic():
            for je in jes_to_process:
                try:
                    order = Order.objects.filter(id=je.reference_id).first()
                    if not order:
                        continue
                        
                    # Delete old JE (which cascades to lines)
                    je.delete()
                    
                    # Re-post using proper business logic
                    LedgerService.record_sale(order)
                    success_count += 1
                except Exception as e:
                    errors.append(f"JE {je.id} (Order {je.reference_id}): {str(e)}")
        
        return Response({
            'reposted': success_count,
            'total_found': count,
            'remaining': count - success_count,
            'errors': errors[:20]
        })


    def _load_target_enriched(self, entity_type, target_id):
        """Load enriched target data for audit view."""
        try:
            if entity_type == 'TRANSACTION':
                from apps.pos.models import Order
                obj = Order.objects.select_related('contact').get(id=target_id)
                data = {
                    'id': obj.id,
                    'ref': getattr(obj, 'ref', '') or getattr(obj, 'reference', ''),
                    'date': str(obj.created_at) if hasattr(obj, 'created_at') else '',
                    'type': getattr(obj, 'type', 'SALE'),
                    'status': obj.status,
                    'total_ht': float(getattr(obj, 'total_ht', 0) or 0),
                    'total_tax': float(getattr(obj, 'total_tax', 0) or 0),
                    'total_ttc': float(getattr(obj, 'final_total', 0) or getattr(obj, 'total', 0) or 0),
                    'payment_method': getattr(obj, 'payment_method', ''),
                    'contact_name': obj.contact.name if obj.contact else 'Walk-In',
                    'contact_id': obj.contact_id,
                }
                # Check journal entries
                from apps.finance.models.ledger_models import JournalEntry
                jes = JournalEntry.objects.filter(reference_type='SALE', reference_id=obj.id)
                data['journal_entries'] = list(jes.values('id', 'description', 'total_debit', 'total_credit', 'status'))
                data['has_journal'] = jes.exists()
                return data

            elif entity_type == 'CONTACT':
                from apps.crm.models import Contact
                obj = Contact.objects.get(id=target_id)
                data = {
                    'id': obj.id,
                    'name': obj.name,
                    'type': obj.type,
                    'phone': getattr(obj, 'phone', ''),
                    'email': getattr(obj, 'email', ''),
                    'company_name': getattr(obj, 'company_name', ''),
                    'linked_account_id': obj.linked_account_id,
                    'has_ledger_link': bool(obj.linked_account_id),
                }
                if obj.linked_account_id:
                    # linked_account_id points to ChartOfAccount (created by LedgerService.create_linked_account)
                    from apps.finance.models.coa_models import ChartOfAccount
                    try:
                        coa = ChartOfAccount.objects.get(id=obj.linked_account_id)
                        data['coa_child_code'] = coa.code
                        data['coa_child_name'] = coa.name
                        data['coa_child_type'] = coa.type
                        if coa.parent_id:
                            try:
                                parent = ChartOfAccount.objects.get(id=coa.parent_id)
                                data['coa_parent_code'] = parent.code
                                data['coa_parent_name'] = parent.name
                            except:
                                pass
                    except:
                        pass
                return data

            elif entity_type == 'ACCOUNT':
                from apps.finance.models import FinancialAccount
                obj = FinancialAccount.objects.get(id=target_id)
                data = {
                    'id': obj.id,
                    'name': obj.name,
                    'type': getattr(obj, 'type', ''),
                    'currency': getattr(obj, 'currency', ''),
                    'balance': float(getattr(obj, 'balance', 0) or 0),
                    'ledger_account_id': obj.ledger_account_id,
                    'is_linked_to_coa': bool(obj.ledger_account_id),
                }
                if obj.ledger_account_id:
                    from apps.finance.models.coa_models import ChartOfAccount
                    try:
                        coa = ChartOfAccount.objects.get(id=obj.ledger_account_id)
                        data['coa_name'] = coa.name
                        data['coa_code'] = coa.code
                    except:
                        pass
                return data

            elif entity_type == 'UNIT':
                from apps.inventory.models import Unit
                obj = Unit.objects.get(id=target_id)
                return {
                    'id': obj.id,
                    'name': getattr(obj, 'name', ''),
                    'code': getattr(obj, 'code', ''),
                    'base_unit': getattr(obj, 'base_unit', ''),
                    'allow_decimal': getattr(obj, 'allow_decimal', False),
                }

            elif entity_type == 'CATEGORY':
                from apps.inventory.models import Category
                obj = Category.objects.get(id=target_id)
                return {
                    'id': obj.id,
                    'name': obj.name,
                    'description': getattr(obj, 'description', ''),
                    'parent_id': getattr(obj, 'parent_id', None),
                    'parent_name': obj.parent.name if getattr(obj, 'parent', None) else None,
                }

            elif entity_type == 'BRAND':
                from apps.inventory.models import Brand
                obj = Brand.objects.get(id=target_id)
                return {
                    'id': obj.id,
                    'name': obj.name,
                    'description': getattr(obj, 'description', ''),
                }

            elif entity_type == 'USER':
                from erp.models import User
                obj = User.objects.get(id=target_id)
                return {
                    'id': obj.id,
                    'username': obj.username,
                    'first_name': obj.first_name,
                    'last_name': obj.last_name,
                    'email': obj.email,
                    'is_active': obj.is_active,
                    'registration_status': getattr(obj, 'registration_status', ''),
                }

            elif entity_type == 'PAYMENT':
                from apps.finance.payment_models import Payment
                obj = Payment.objects.get(id=target_id)
                return {
                    'id': obj.id,
                    'amount': float(getattr(obj, 'amount', 0) or 0),
                    'payment_date': str(getattr(obj, 'payment_date', '')),
                    'status': getattr(obj, 'status', ''),
                    'payment_method': getattr(obj, 'payment_method', ''),
                    'contact_id': getattr(obj, 'contact_id', None),
                }

            elif entity_type == 'PRODUCT':
                from apps.inventory.models import Product
                obj = Product.objects.get(id=target_id)
                return {
                    'id': obj.id,
                    'name': obj.name,
                    'sku': getattr(obj, 'sku', ''),
                    'barcode': getattr(obj, 'barcode', ''),
                    'status': getattr(obj, 'status', ''),
                    'selling_price': float(getattr(obj, 'selling_price', 0) or 0),
                    'purchase_price': float(getattr(obj, 'purchase_price', 0) or 0),
                    'product_type': getattr(obj, 'product_type', ''),
                }

            elif entity_type == 'EXPENSE':
                from apps.finance.models import DirectExpense
                obj = DirectExpense.objects.get(id=target_id)
                data = {
                    'id': obj.id,
                    'reference': getattr(obj, 'reference', ''),
                    'amount': float(getattr(obj, 'amount', 0) or 0),
                    'status': getattr(obj, 'status', ''),
                    'date': str(getattr(obj, 'date', '')),
                    'payment_method': getattr(obj, 'payment_method', ''),
                }
                from apps.finance.models.ledger_models import JournalEntry
                jes = JournalEntry.objects.filter(reference_type='EXPENSE', reference_id=obj.id)
                data['journal_entries'] = list(jes.values('id', 'description', 'total_debit', 'total_credit', 'status'))
                data['has_journal'] = jes.exists()
                return data

            else:
                # Generic fallback — try to get useful data
                return {'id': target_id, 'entity_type': entity_type}
        except Exception as e:
            return {'error': f'Failed to load record {target_id}: {str(e)}'}

    @action(detail=True, methods=['get'], url_path='samples')
    def samples(self, request, pk=None):
        """Returns 5-10 detailed samples of migrated data for a specific entity type."""
        job = self.get_object()
        entity_type = request.query_params.get('entity_type', 'TRANSACTION')
        
        mappings = MigrationMapping.objects.filter(job=job, entity_type=entity_type).order_by('?')[:3]
        if not mappings:
            return Response({'error': 'No mappings found for this type'}, status=404)

        samples_data = []
        for m in mappings:
            target_data = None
            ledger_impact = []
            try:
                if entity_type == 'TRANSACTION':
                    from apps.pos.serializers import OrderSerializer
                    from apps.pos.models import Order
                    obj = Order.objects.get(id=m.target_id)
                    target_data = OrderSerializer(obj).data
                    
                    # Fetch Ledger Impact
                    from apps.finance.models.ledger_models import JournalEntry
                    from apps.finance.serializers import JournalEntrySerializer
                    jes = JournalEntry.objects.filter(reference_type='SALE', reference_id=obj.id)
                    ledger_impact = JournalEntrySerializer(jes, many=True).data

                elif entity_type == 'PRODUCT':
                    from apps.inventory.serializers import ProductSerializer
                    from apps.inventory.models import Product
                    obj = Product.objects.get(id=m.target_id)
                    target_data = ProductSerializer(obj).data
                    
                    # If it's a combo, include its components
                    if obj.product_type == 'COMBO':
                        from apps.inventory.models import ComboLink
                        links = ComboLink.objects.filter(combo_product=obj)
                        target_data['combo_components'] = [
                            {'product': l.component_product.name, 'qty': float(l.quantity)} 
                            for l in links
                        ]

                elif entity_type == 'CONTACT':
                    from apps.crm.serializers import ContactSerializer
                    from apps.crm.models import Contact
                    obj = Contact.objects.get(id=m.target_id)
                    target_data = ContactSerializer(obj).data
                    # Add linked account status
                    target_data['has_ledger_link'] = bool(obj.linked_account_id)

                elif entity_type == 'CATEGORY':
                    from apps.inventory.serializers import CategorySerializer
                    from apps.inventory.models import Category
                    obj = Category.objects.get(id=m.target_id)
                    target_data = CategorySerializer(obj).data

                elif entity_type == 'UNIT':
                    from apps.inventory.serializers import UnitSerializer
                    from apps.inventory.models import Unit
                    obj = Unit.objects.get(id=m.target_id)
                    target_data = UnitSerializer(obj).data

                elif entity_type == 'ACCOUNT':
                    from apps.finance.serializers import FinancialAccountSerializer
                    from apps.finance.models import FinancialAccount
                    obj = FinancialAccount.objects.get(id=m.target_id)
                    target_data = FinancialAccountSerializer(obj).data
                    target_data['is_linked_to_coa'] = bool(obj.ledger_account_id)

                elif entity_type == 'EXPENSE':
                    from apps.finance.serializers import DirectExpenseSerializer
                    from apps.finance.models import DirectExpense
                    obj = DirectExpense.objects.get(id=m.target_id)
                    target_data = DirectExpenseSerializer(obj).data
                    
                    # Fetch Ledger Impact
                    from apps.finance.models.ledger_models import JournalEntry
                    from apps.finance.serializers import JournalEntrySerializer
                    jes = JournalEntry.objects.filter(reference_type='EXPENSE', reference_id=obj.id)
                    ledger_impact = JournalEntrySerializer(jes, many=True).data
                
                # ... append other types as needed
            except Exception as e:
                target_data = {"error": f"Failed to load record {m.target_id}: {str(e)}"}

            samples_data.append({
                'source_id': m.source_id,
                'target_id': m.target_id,
                'source_raw': m.extra_data,
                'target_state': target_data,
                'ledger_impact': ledger_impact,
                'integration_logic': self._get_logic_snippet(entity_type)
            })

        return Response({
            'entity_type': entity_type,
            'job_id': job.id,
            'samples': samples_data
        })


    def _get_logic_snippet(self, etype):
        LOGIC = {
            'TRANSACTION': "Maps UPOS transactions to TSF Orders. Deducts stock if type is SALE. Links to Site/Branch and Supplier/Contact via mapped IDs.",
            'JOURNAL_ENTRY': "Converts UPOS account_transactions into double-entry Ledger entries. Debits the destination account and Credits the source account. Preserves historical dates.",
            'PRODUCT': "Creates TSF Products with identical SKUs. Recalculates HT/TTC prices based on the detected tax group. Status set to DRAFT if needs audit.",
            'CONTACT': "Maps UPOS contacts to TSF CRM Contacts. Detects if type is Customer, Supplier, or Both. Preserves balance information as opening balance.",
            'CATEGORY': "Imports hierarchical categories. Preserves parent-child relationships using a two-pass mapping approach.",
            'UNIT': "Maps source units (e.g., Pcs, Kg) to TSF Inventory Units. Normalizes unit names and symbols.",
            'BRAND': "Imports product brands. Deduplicates by name and links to related products via TSF internal brand_id.",
            'ACCOUNT': "Links UPOS payment accounts to TSF Financial Accounts. Maps to standardized Chart of Accounts types (Asset, Liability, etc.)."
        }
        return LOGIC.get(etype, "Standard mapping of source fields to target model.")


    @action(detail=True, methods=['get', 'post'], url_path='review')
    def review(self, request, pk=None):
        """
        GET: Post-migration review with per-entity DRAFT/OK breakdown.
        POST: Bulk approve or bulk edit DRAFT records for a given entity_type.
        """
        job = self.get_object()
        org_id = request.headers.get('X-Tenant-Id') or \
                 getattr(request.user, 'organization_id', None)

        if request.method == 'POST':
            action_type = request.data.get('action', 'approve')
            if action_type == 'edit':
                return self._bulk_edit(request, job, org_id)
            if action_type == 'audit':
                return self._bulk_audit_action(request, job, org_id)
            return self._bulk_approve(request, job, org_id)

        from django.db.models import Count
        from apps.pos.models import Order
        from apps.finance.models import DirectExpense
        try:
            from apps.finance.payment_models import Payment
        except ImportError:
            Payment = None

        # ── Single query: all mappings grouped by entity_type ──
        entity_counts = list(
            MigrationMapping.objects.filter(job=job)
            .values('entity_type')
            .annotate(total=Count('id'))
            .order_by('entity_type')
        )

        # Pre-fetch ALL target_ids grouped by entity type in one batch
        all_mappings = list(
            MigrationMapping.objects.filter(job=job)
            .values('entity_type', 'target_id', 'extra_data')
        )
        
        ids_by_type = {}
        target_meta = {}
        for m in all_mappings:
            etype = m['entity_type']
            if etype not in ids_by_type: ids_by_type[etype] = []
            ids_by_type[etype].append(m['target_id'])
            if m.get('extra_data'):
                target_meta[(etype, m['target_id'])] = m['extra_data']

        # Status counts for common entities
        draft_counts = {}
        for etype, t_ids in ids_by_type.items():
            if etype == 'TRANSACTION':
                draft_counts[etype] = Order.objects.filter(id__in=t_ids, status='DRAFT').count()
            elif etype == 'EXPENSE':
                draft_counts[etype] = DirectExpense.objects.filter(id__in=t_ids, status='DRAFT').count()
            elif etype == 'PAYMENT' and Payment:
                draft_counts[etype] = Payment.objects.filter(id__in=t_ids, status='DRAFT').count()
            elif etype == 'JOURNAL_ENTRY':
                from apps.finance.models.ledger_models import JournalEntry
                draft_counts[etype] = JournalEntry.objects.filter(id__in=t_ids, status='DRAFT').count()
            elif etype == 'PRODUCT':
                from apps.inventory.models import Product
                draft_counts[etype] = Product.objects.filter(id__in=t_ids, status='DRAFT').count()
            elif etype == 'ACCOUNT':
                from apps.finance.models import FinancialAccount
                draft_counts[etype] = FinancialAccount.objects.filter(id__in=t_ids, ledger_account_id__isnull=True).count()
            elif etype == 'STOCK_ADJUSTMENT':
                from apps.inventory.models import StockAdjustmentOrder
                draft_counts[etype] = StockAdjustmentOrder.objects.filter(id__in=t_ids, is_posted=False).count()
            elif etype == 'STOCK_TRANSFER':
                from apps.inventory.models import StockTransferOrder
                draft_counts[etype] = StockTransferOrder.objects.filter(id__in=t_ids, is_posted=False).count()

        ENTITY_META = {
            'SITE':       {'page': '/settings/sites',       'group': 'infrastructure', 'order': 1},
            'TAX_GROUP':  {'page': '/settings',             'group': 'infrastructure', 'order': 2},
            'UNIT':       {'page': '/inventory/units',      'group': 'master_data',    'order': 3},
            'CATEGORY':   {'page': '/inventory/categories', 'group': 'master_data',    'order': 4},
            'BRAND':      {'page': '/inventory/brands',     'group': 'master_data',    'order': 5},
            'USER':       {'page': '/users/approvals',      'group': 'master_data',    'order': 6},
            'PRODUCT':    {'page': '/inventory/products',   'group': 'products',       'order': 7, 'filter': 'status=DRAFT'},
            'COMBO_LINK': {'page': '/inventory/products',   'group': 'products',       'order': 8},
            'INVENTORY':  {'page': '/inventory',            'group': 'products',       'order': 9},
            'CONTACT':    {'page': '/contacts',             'group': 'partners',       'order': 10},
            'ACCOUNT':    {'page': '/finance',              'group': 'finance',        'order': 11},
            'EXPENSE':    {'page': '/finance',              'group': 'finance',        'order': 12, 'filter': 'status=DRAFT'},
            'PAYMENT':    {'page': '/finance',              'group': 'finance',        'order': 13, 'filter': 'status=DRAFT'},
            'TRANSACTION':{'page': '/sales',                'group': 'transactions',   'order': 14, 'filter': 'status=DRAFT'},
            'STOCK_ADJUSTMENT':{'page': '/inventory',       'group': 'transactions',   'order': 15, 'filter': 'status=DRAFT'},
            'STOCK_TRANSFER':  {'page': '/inventory',       'group': 'transactions',   'order': 16, 'filter': 'status=DRAFT'},
            'ORDER_LINE': {'page': '/sales',                'group': 'transactions',   'order': 17},
        }

        review_data = []
        needs_review_notes = 0

        for ec in entity_counts:
            et = ec['entity_type']
            total = ec['total']
            t_ids = ids_by_type.get(et, [])
            draft = draft_counts.get(et, 0)
            meta = ENTITY_META.get(et, {})
            
            # Count logical needs-review markers
            entity_needs_review = 0
            for tid in t_ids:
                if target_meta.get((et, tid), {}).get('needs_review'):
                    entity_needs_review += 1
            
            needs_review_notes += entity_needs_review

            review_data.append({
                'entity_type': et,
                'total': total,
                'draft': draft,
                'good': total - draft,
                'needs_review': entity_needs_review,
                'page_link': meta.get('page'),
                'filter_param': meta.get('filter') if draft > 0 else None,
                'group': meta.get('group', 'other'),
                'order': meta.get('order', 99),
                'can_approve': et in draft_counts and draft > 0,
                'logic': self._get_logic_snippet(et)
            })

        review_data.sort(key=lambda x: x['order'])

        # Additional needs-review check via notes for transactions
        if ids_by_type.get('TRANSACTION'):
            legacy_notes_count = Order.objects.filter(
                id__in=ids_by_type['TRANSACTION'], notes__contains='[NEEDS REVIEW]'
            ).count()
            needs_review_notes = max(needs_review_notes, legacy_notes_count)

        raw_log = job.error_log or ""
        error_lines = [l.strip() for l in raw_log.split('\n') if l.strip()]

        return Response({
            'job_id': job.id,
            'job_status': job.status,
            'total_mappings': sum(ec['total'] for ec in entity_counts),
            'total_errors': len(error_lines),
            'total_draft': sum(d['draft'] for d in review_data),
            'total_good': sum(d['good'] for d in review_data),
            'error_log': raw_log[:10000],
            'error_lines_preview': error_lines[:50],
            'entities': review_data,
            'needs_review_count': needs_review_notes,
            'groups': {
                'infrastructure': 'Infrastructure',
                'master_data': 'Master Data',
                'products': 'Products & Stock',
                'partners': 'Contacts & Partners',
                'finance': 'Finance',
                'transactions': 'Sales & Purchases',
                'other': 'Other',
            },
        })


    @action(detail=True, methods=['get', 'post'], url_path='account-mapping')
    def account_mapping(self, request, pk=None):
        """
        GET: Fetch accounts and COA options for mapping.
        POST: Save mappings for specific accounts.
        """
        job = self.get_object()
        from apps.finance.models import FinancialAccount, ChartOfAccount
        
        if request.method == 'POST':
            mappings = request.data.get('mappings', [])
            updated = 0
            for m in mappings:
                if m.get('target_id') and m.get('coa_id'):
                    cnt = FinancialAccount.objects.filter(id=m['target_id']).update(ledger_account_id=m['coa_id'])
                    updated += cnt
            return Response({'status': 'ok', 'updated': updated})

        # GET logic
        mapping_qs = MigrationMapping.objects.filter(job=job, entity_type='ACCOUNT')
        
        accounts_data = []
        fas = FinancialAccount.objects.filter(organization_id=job.organization_id)
        
        # Link back to source name for clarity
        source_names = {m.target_id: m.extra_data.get('name', 'Unknown') for m in mapping_qs}
        
        for fa in fas:
            accounts_data.append({
                'id': fa.id,
                'name': fa.name,
                'source_name': source_names.get(fa.id, ""),
                'ledger_account_id': fa.ledger_account_id
            })

        coa_options = ChartOfAccount.objects.all().values('id', 'name', 'code', 'type').order_by('code')
        
        return Response({
            'accounts': accounts_data,
            'coa_options': list(coa_options)
        })


    def _bulk_edit(self, request, job, org_id):
        """POST /review/ with { entity_type, action: 'edit', updates: {...} }."""
        entity_type = request.data.get('entity_type')
        updates = request.data.get('updates', {})

        if not entity_type or not updates:
            return Response({'error': 'entity_type and updates are required'}, status=status.HTTP_400_BAD_REQUEST)

        mappings_qs = MigrationMapping.objects.filter(job=job, entity_type=entity_type)
        if not mappings_qs.exists():
            return Response({'error': 'No mappings found'}, status=status.HTTP_404_NOT_FOUND)

        target_ids_qs = mappings_qs.values_list('target_id', flat=True)
        updated = 0

        # Define allowed fields per entity for standardization
        ALLOWED_FIELDS = {
            'TRANSACTION': ['site_id', 'type', 'payment_method', 'scope', 'status', 'notes'],
            'PRODUCT': ['category_id', 'brand_id', 'unit_id', 'tax_rate_id', 'status', 'is_active'],
            'CONTACT': ['type', 'group_id'],
            'JOURNAL_ENTRY': ['scope', 'description'],
            'EXPENSE': ['category_id', 'payment_method', 'scope'],
            'ACCOUNT': ['type', 'ledger_account_id']
        }

        allowed = ALLOWED_FIELDS.get(entity_type, [])
        safe_updates = {k: v for k, v in updates.items() if k in allowed}

        if not safe_updates:
            return Response({
                'error': f'No valid fields to update for {entity_type}. Allowed: {", ".join(allowed)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                if entity_type == 'TRANSACTION':
                    from apps.pos.models import Order
                    updated = Order.objects.filter(id__in=target_ids_qs).update(**safe_updates)
                elif entity_type == 'PRODUCT':
                    from apps.inventory.models import Product
                    updated = Product.objects.filter(id__in=target_ids_qs).update(**safe_updates)
                elif entity_type == 'CONTACT':
                    from apps.crm.models import Contact
                    updated = Contact.objects.filter(id__in=target_ids_qs).update(**safe_updates)
                elif entity_type == 'JOURNAL_ENTRY':
                    from apps.finance.models.ledger_models import JournalEntry
                    updated = JournalEntry.objects.filter(id__in=target_ids_qs).update(**safe_updates)
                elif entity_type == 'EXPENSE':
                    from apps.finance.models import DirectExpense
                    updated = DirectExpense.objects.filter(id__in=target_ids_qs).update(**safe_updates)
                elif entity_type == 'ACCOUNT':
                    from apps.finance.models import FinancialAccount
                    updated = FinancialAccount.objects.filter(id__in=target_ids_qs).update(**safe_updates)
        except Exception as e:
            return Response({'error': f'Bulk edit failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'entity_type': entity_type,
            'updated': updated,
            'fields': list(safe_updates.keys())
        })


    def _bulk_approve(self, request, job, org_id):
        """POST /review/ with { entity_type, action } to bulk-approve draft records."""
        entity_type = request.data.get('entity_type')
        action_type = request.data.get('action', 'approve')

        if not entity_type:
            return Response({'error': 'entity_type is required'}, status=status.HTTP_400_BAD_REQUEST)

        mappings_qs = MigrationMapping.objects.filter(job=job, entity_type=entity_type)
        if not mappings_qs.exists():
            return Response({'error': 'No mappings found'}, status=status.HTTP_404_NOT_FOUND)

        target_ids_qs = mappings_qs.values_list('target_id', flat=True)
        updated = 0

        try:
            with transaction.atomic():
                if entity_type == 'TRANSACTION':
                    from apps.pos.models import Order
                    if action_type == 'approve':
                        updated = Order.objects.filter(id__in=target_ids_qs, status='DRAFT').update(status='COMPLETED')
                elif entity_type == 'EXPENSE':
                    from apps.finance.models import DirectExpense
                    if action_type == 'approve':
                        updated = DirectExpense.objects.filter(id__in=target_ids_qs, status='DRAFT').update(status='POSTED')
                elif entity_type == 'PAYMENT':
                    try:
                        from apps.finance.payment_models import Payment
                        if action_type == 'approve':
                            updated = Payment.objects.filter(id__in=target_ids_qs, status='DRAFT').update(status='POSTED')
                    except ImportError:
                        pass
                elif entity_type == 'JOURNAL_ENTRY':
                    from apps.finance.models.ledger_models import JournalEntry
                    if action_type == 'approve':
                        updated = JournalEntry.objects.filter(id__in=target_ids_qs, status='DRAFT').update(status='POSTED')
                elif entity_type == 'PRODUCT':
                    from apps.inventory.models import Product
                    if action_type == 'approve':
                        updated = Product.objects.filter(id__in=target_ids_qs, status='DRAFT').update(status='ACTIVE')
                elif entity_type == 'STOCK_ADJUSTMENT':
                    from apps.inventory.models import StockAdjustmentOrder
                    if action_type == 'approve':
                        updated = StockAdjustmentOrder.objects.filter(id__in=target_ids_qs, is_posted=False).update(is_posted=True)
                elif entity_type == 'STOCK_TRANSFER':
                    from apps.inventory.models import StockTransferOrder
                    if action_type == 'approve':
                        updated = StockTransferOrder.objects.filter(id__in=target_ids_qs, is_posted=False).update(is_posted=True)
        except Exception as e:
            return Response({'error': f'Bulk approve failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'entity_type': entity_type,
            'action': action_type,
            'updated': updated,
        })

    def _bulk_audit_action(self, request, job, org_id):
        """Perform Forensic Audit: Verify content and post to Ledger if applicable."""
        entity_type = request.data.get('entity_type', 'TRANSACTION')
        from django.utils import timezone
        from apps.migration.ledger_integrator import MigrationLedgerIntegrator
        
        if entity_type == 'TRANSACTION':
            count, errors = MigrationLedgerIntegrator.bulk_post_migration(
                job.id, entity_type='TRANSACTION', user=request.user
            )
            return Response({
                'entity_type': 'TRANSACTION',
                'action': 'ledger_integration',
                'posted_count': count,
                'error_count': errors,
                'status': 'Audit phase complete. Check individual records for flags.'
            })
        
        # Default bulk audit (non-ledger)
        updated = MigrationMapping.objects.filter(
            job=job, entity_type=entity_type, audit_status='PENDING'
        ).update(
            audit_status='VERIFIED',
            audit_at=timezone.now(),
            audited_by=request.user
        )
        
        return Response({
            'entity_type': entity_type,
            'action': 'bulk_verify',
            'verified_count': updated
        })

