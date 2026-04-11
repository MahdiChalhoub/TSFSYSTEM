"""
Kernel Views — Infrastructure & Cross-Cutting Concerns Only
============================================================
This file contains ONLY the kernel-level ViewSets:
 - TenantModelViewSet (base class for all organization-scoped views, with AuditLogMixin)
 - UserViewSet, OrganizationViewSet, SiteViewSet, CountryViewSet, RoleViewSet
 - TenantResolutionView, SettingsViewSet, DashboardViewSet, health_check

All business-domain ViewSets live in their canonical module locations:
 - apps.finance.views
 - apps.inventory.views
 - apps.pos.views
 - apps.crm.views
 - apps.hr.views

Backward-compatible re-exports are provided at the bottom of this file.
"""
from django.db import transaction
from django.db.models import Q, Sum, F, Avg
from rest_framework import viewsets, status, serializers, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, action, permission_classes
from django.utils import timezone
from .middleware import get_current_tenant_id
from .mixins import AuditLogMixin, TenantFilterMixin, UDLEViewSetMixin
from .throttles import TenantResolveRateThrottle

# --- Kernel Models ---
from .models import (
    Organization, Site, User, Country, Role, Permission,
    SystemModule, OrganizationModule, GlobalCurrency,
    ManagerOverrideLog, Notification
)

# --- Business Module Models (optional — modules may be uninstalled) ---
try:
    from .models import FinancialAccount, ChartOfAccount, JournalEntryLine, Transaction
except ImportError:
    FinancialAccount = ChartOfAccount = JournalEntryLine = Transaction = None

try:
    from .models import Product, Inventory, OrderLine, Brand
except ImportError:
    Product = Inventory = OrderLine = Brand = None

try:
    from .models import Contact
except ImportError:
    Contact = None
# --- Kernel Serializers ---
from .serializers import (
    OrganizationSerializer, SiteSerializer, UserSerializer,
    CountrySerializer, RoleSerializer, NotificationSerializer, PermissionSerializer,
)
from .serializers.core import GlobalCurrencySerializer
try:
    from .serializers import ProductSerializer, BrandSerializer
except ImportError:
    ProductSerializer = BrandSerializer = None

# --- Kernel Services ---
from .services import ProvisioningService, ConfigurationService
try:
    from .services import LedgerService, InventoryService
except ImportError:
    LedgerService = InventoryService = None

# ============================================================================
#  KERNEL BASE CLASS
# ============================================================================


from .views_base import TenantModelViewSet

class NotificationViewSet(viewsets.ModelViewSet):
    """
    Endpoints for current user notifications.
    [RESILIENCE] Wrapped with try/except to prevent 500 HTML errors on SaaS pages
    where organization context may not be fully resolved.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        try:
            return Notification.objects.filter(user=self.request.user)
        except Exception:
            return Notification.objects.none()

    def list(self, request, *args, **kwargs):
        """Resilient list — returns empty array on any backend error."""
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            import logging
            logging.getLogger('erp').warning(f"NotificationViewSet.list failed: {e}")
            return Response([], status=200)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        try:
            Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        except Exception:
            pass
        return Response({"message": "All notifications marked as read."})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.mark_as_read()
        return Response({"message": "Notification marked as read."})

    @action(detail=False, methods=['get'], url_path='preferences')
    def get_preferences(self, request):
        """Get notification preferences for the current user."""
        from erp.notification_service import NotificationService
        prefs = NotificationService.get_user_preferences(request.user)
        return Response(prefs)

    @action(detail=False, methods=['post'], url_path='update-preference')
    def update_preference(self, request):
        """Update a single notification preference.
        Body: { "notification_type": "invoice_overdue", "channel": "EMAIL", "is_enabled": true }
        """
        from erp.notification_service import NotificationService
        ntype = request.data.get('notification_type')
        channel = request.data.get('channel')
        is_enabled = request.data.get('is_enabled', True)
        if not ntype or not channel:
            return Response({"error": "notification_type and channel are required"}, status=400)
        pref = NotificationService.update_preference(request.user, ntype, channel, is_enabled)
        return Response({
            "notification_type": pref.notification_type,
            "channel": pref.channel,
            "is_enabled": pref.is_enabled,
        })

    @action(detail=False, methods=['get'], url_path='delivery-log')
    def delivery_log(self, request):
        """Get notification delivery log for the current user."""
        from erp.notification_models import NotificationLog
        logs = NotificationLog.objects.filter(user=request.user)[:50]
        data = [{
            'id': log.id,
            'channel': log.channel,
            'subject': log.subject,
            'status': log.status,
            'sent_at': log.sent_at.isoformat() if log.sent_at else None,
            'created_at': log.created_at.isoformat() if log.created_at else None,
        } for log in logs]
        return Response(data)


class TenantResolutionView(viewsets.ViewSet):
    """
    Public endpoint to resolve organization slug to ID.
    Used by Next.js middleware/context to avoid direct DB access.
    """
    permission_classes = [] 
    authentication_classes = []
    throttle_classes = [TenantResolveRateThrottle]

    @action(detail=False, methods=['get'])
    def resolve(self, request):
        slug = request.query_params.get('slug')
        if not slug:
            return Response({"error": "Slug required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            org = Organization.objects.get(slug=slug)
            return Response({
                "id": str(org.id),
                "slug": org.slug,
                "name": org.name
            })
        except Organization.DoesNotExist:
            return Response({"error": "Tenant not found"}, status=status.HTTP_404_NOT_FOUND)


class SettingsViewSet(viewsets.ViewSet):
    """Handles system-wide configuration."""
    @action(detail=False, methods=['get', 'post'])
    def posting_rules(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            new_config = request.data
            old_config = ConfigurationService.get_posting_rules(organization)
            reclassify = request.query_params.get('reclassify', 'false').lower() == 'true'
            dry_run = request.query_params.get('dry_run', 'false').lower() == 'true'

            # ── Change Impact Analysis ──
            changes = []
            for section_key, section_fields in new_config.items():
                if not isinstance(section_fields, dict):
                    continue
                old_section = old_config.get(section_key, {})
                if not isinstance(old_section, dict):
                    old_section = {}
                for field_key, new_val in section_fields.items():
                    old_val = old_section.get(field_key)
                    # Normalize: treat empty string and None as equal
                    n = new_val if new_val else None
                    o = old_val if old_val else None
                    if n != o and o is not None:
                        changes.append({
                            'section': section_key,
                            'field': field_key,
                            'old_account_id': o,
                            'new_account_id': n,
                        })

            # Build impact report for each change
            impact = []
            if changes:
                try:
                    from apps.finance.models import ChartOfAccount, JournalEntryLine
                    for change in changes:
                        old_id = change['old_account_id']
                        new_id = change['new_account_id']
                        old_acc = ChartOfAccount.objects.filter(id=old_id, organization=organization).first()
                        new_acc = ChartOfAccount.objects.filter(id=new_id, organization=organization).first() if new_id else None

                        # Special handling for automation root accounts
                        if change['field'] in ('customerRoot', 'supplierRoot', 'payrollRoot'):
                            child_count = ChartOfAccount.objects.filter(
                                parent=old_acc, organization=organization
                            ).count() if old_acc else 0
                            entry = {
                                'rule': f"{change['section']}.{change['field']}",
                                'old_account': f"{old_acc.code} — {old_acc.name}" if old_acc else str(old_id),
                                'new_account': f"{new_acc.code} — {new_acc.name}" if new_acc else '(unmapped)',
                                'journal_entries': 0,
                                'balance': 0,
                                'child_accounts': child_count,
                                'risk': 'HIGH' if child_count > 0 else 'LOW',
                            }
                            impact.append(entry)
                            continue

                        # Count JE lines on old account
                        je_count = JournalEntryLine.objects.filter(
                            account_id=old_id,
                            journal_entry__tenant=organization
                        ).count()

                        # Get balance
                        from django.db.models import Sum as _Sum
                        from decimal import Decimal
                        agg = JournalEntryLine.objects.filter(
                            account_id=old_id,
                            journal_entry__tenant=organization
                        ).aggregate(
                            total_debit=_Sum('debit'),
                            total_credit=_Sum('credit')
                        )
                        balance = (agg['total_debit'] or Decimal('0')) - (agg['total_credit'] or Decimal('0'))

                        entry = {
                            'rule': f"{change['section']}.{change['field']}",
                            'old_account': f"{old_acc.code} — {old_acc.name}" if old_acc else str(old_id),
                            'new_account': f"{new_acc.code} — {new_acc.name}" if new_acc else '(unmapped)',
                            'journal_entries': je_count,
                            'balance': float(balance),
                            'risk': 'HIGH' if je_count > 0 and abs(balance) > 0.01 else 'LOW',
                        }
                        impact.append(entry)
                except ImportError:
                    pass  # Finance module not installed

            # Dry run: return impact analysis without saving
            if dry_run:
                return Response({
                    'changes': len(changes),
                    'impact': impact,
                    'has_high_risk': any(i['risk'] == 'HIGH' for i in impact),
                    'message': 'Dry run — no changes saved. Review impact before confirming.',
                })

            # ── Reclassification JEs ──
            reclass_results = []
            if reclassify and changes:
                try:
                    from apps.finance.models import ChartOfAccount, JournalEntryLine
                    from apps.finance.services import LedgerService
                    from django.db.models import Sum as _Sum
                    from decimal import Decimal

                    for change in changes:
                        old_id = change['old_account_id']
                        new_id = change['new_account_id']
                        if not new_id:
                            continue

                        # ── Special: Parent account re-linking for automation roots ──
                        if change['field'] in ('customerRoot', 'supplierRoot', 'payrollRoot'):
                            try:
                                old_parent = ChartOfAccount.objects.filter(id=old_id, organization=organization).first()
                                new_parent = ChartOfAccount.objects.filter(id=new_id, organization=organization).first()
                                if old_parent and new_parent:
                                    children = ChartOfAccount.objects.filter(parent=old_parent, organization=organization)
                                    moved = 0
                                    for idx, child in enumerate(children):
                                        child.parent = new_parent
                                        child.code = f"{new_parent.code}-{(idx + 1):04d}"
                                        child.save(update_fields=['parent', 'code'])
                                        moved += 1
                                    reclass_results.append({
                                        'rule': f"{change['section']}.{change['field']}",
                                        'status': 'relinked',
                                        'message': f"Moved {moved} sub-account(s) from {old_parent.code} to {new_parent.code}",
                                    })
                            except Exception as e:
                                reclass_results.append({
                                    'rule': f"{change['section']}.{change['field']}",
                                    'status': 'error',
                                    'error': f"Parent re-link failed: {e}",
                                })
                            continue  # No JE needed for parent re-linking

                        agg = JournalEntryLine.objects.filter(
                            account_id=old_id,
                            journal_entry__tenant=organization
                        ).aggregate(
                            total_debit=_Sum('debit'),
                            total_credit=_Sum('credit')
                        )
                        balance = (agg['total_debit'] or Decimal('0')) - (agg['total_credit'] or Decimal('0'))

                        if abs(balance) < Decimal('0.01'):
                            reclass_results.append({
                                'rule': f"{change['section']}.{change['field']}",
                                'status': 'skipped',
                                'reason': 'Zero balance — no reclassification needed.',
                            })
                            continue

                        # Post reclassification: move balance from old to new
                        lines = []
                        if balance > 0:
                            lines = [
                                {'account_id': new_id, 'debit': balance, 'credit': Decimal('0'),
                                 'description': f"Reclassification from {change['section']}.{change['field']}"},
                                {'account_id': old_id, 'debit': Decimal('0'), 'credit': balance,
                                 'description': f"Reclassification to new posting rule account"},
                            ]
                        else:
                            abs_bal = abs(balance)
                            lines = [
                                {'account_id': new_id, 'debit': Decimal('0'), 'credit': abs_bal,
                                 'description': f"Reclassification from {change['section']}.{change['field']}"},
                                {'account_id': old_id, 'debit': abs_bal, 'credit': Decimal('0'),
                                 'description': f"Reclassification to new posting rule account"},
                            ]

                        try:
                            je = LedgerService.create_journal_entry(
                                organization=organization,
                                transaction_date=timezone.now().date(),
                                description=f"Posting Rule Reclassification: {change['section']}.{change['field']}",
                                lines=lines,
                                reference=f"RECLASS-{change['section']}-{change['field']}",
                                status='POSTED',
                                scope='OFFICIAL',
                                internal_bypass=True,
                            )
                            reclass_results.append({
                                'rule': f"{change['section']}.{change['field']}",
                                'status': 'posted',
                                'je_id': str(je.id) if je else None,
                                'amount': float(abs(balance)),
                            })
                        except Exception as e:
                            reclass_results.append({
                                'rule': f"{change['section']}.{change['field']}",
                                'status': 'error',
                                'error': str(e),
                            })
                except ImportError:
                    pass  # Finance module not installed

            # ── Save ──
            ConfigurationService.save_posting_rules(organization, new_config)

            response = {"message": "Posting rules saved successfully"}
            if impact:
                response['impact'] = impact
            if reclass_results:
                response['reclassifications'] = reclass_results
            return Response(response)
        
        rules = ConfigurationService.get_posting_rules(organization)
        return Response(rules)

    @action(detail=False, methods=['post'])
    def smart_apply(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        config = ConfigurationService.apply_smart_posting_rules(organization)
        return Response(config)

    @action(detail=False, methods=['get', 'post'])
    def coa_setup(self, request):
        """COA Setup Wizard status tracker.

        Auto-detects COMPLETED status: if the org has COA accounts (e.g. from
        an imported template) but the explicit status was never updated, we
        treat it as COMPLETED so the finance module is fully accessible.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            reset = request.query_params.get('reset') == 'true' or request.data.get('reset') is True
            print(f"--- COA SETUP ACTION --- Organization: {organization.id}, Reset: {reset}")
            
            if reset:
                try:
                    from django.db import transaction as db_transaction
                    with db_transaction.atomic():
                        from apps.finance.models import ChartOfAccount, JournalEntry, PostingRule, ContextualPostingRule, OpeningBalance, TaxAccountMapping
                        
                        has_journal_entries = JournalEntry.objects.filter(organization=organization).exists()
                        if has_journal_entries:
                            return Response({
                                "error": "Cannot reset: existing journal entries detected. Reversing transactions or deleting ledger history is required first."
                            }, status=status.HTTP_400_BAD_REQUEST)
                        
                        # ─── CLEAR DEPENDENCIES (Order matters due to PROTECT or related links) ───
                        # 1. Clear posting engine
                        PostingRule.objects.filter(organization=organization).delete()
                        ContextualPostingRule.objects.filter(organization=organization).delete()
                        
                        try:
                            from apps.finance.models.posting_event import PostingRuleHistory
                            PostingRuleHistory.objects.filter(organization=organization).delete()
                        except: pass
                        
                        # 2. Clear sub-modules
                        OpeningBalance.objects.filter(organization=organization).delete()
                        
                        try:
                            from apps.finance.models.budget_models import BudgetLine
                            BudgetLine.objects.filter(organization=organization).delete()
                        except: pass
                        
                        try:
                            from apps.finance.models.recurring_journal_models import RecurringJournalLine
                            RecurringJournalLine.objects.filter(organization=organization).delete()
                        except: pass
                        
                        # 3. Clear tax mappings
                        TaxAccountMapping.objects.filter(organization=organization).delete()
                        
                        # 4. Finally clear COA
                        ChartOfAccount.objects.filter(organization=organization).delete()
                        
                        # 5. Reset Settings / Status
                        settings = organization.settings or {}
                        # Clear legacy and V2 nomenclature
                        settings.pop('finance_posting_rules', None)
                        settings.pop('imported_coa_filename', None)
                        
                        # Reset Setup Status
                        settings['coa_setup'] = {
                            'status': 'NOT_STARTED',
                            'selectedTemplate': None,
                            'importedAt': None,
                            'postingRulesConfigured': False,
                            'migrationNeeded': False,
                            'migrationCompleted': False,
                            'completedAt': None,
                        }
                        organization.settings = settings
                        organization.save(update_fields=['settings'])
                        
                        print(f"--- RESET COMPLETED --- Organization: {organization.id}")
                        return Response({"message": "Chart of Accounts setup has been completely reset", "status": "NOT_STARTED"})
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    return Response({"error": f"Reset failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            current = ConfigurationService.get_setting(organization, 'coa_setup', {})
            if not isinstance(current, dict):
                current = {}
            current.update(request.data)
            ConfigurationService.save_setting(organization, 'coa_setup', current)
            return Response({"message": "COA setup status updated", **current})
        
        # GET
        default = {
            'status': 'NOT_STARTED',
            'selectedTemplate': None,
            'importedAt': None,
            'postingRulesConfigured': False,
            'migrationNeeded': False,
            'migrationCompleted': False,
            'completedAt': None,
        }
        stored = ConfigurationService.get_setting(organization, 'coa_setup', {})
        if isinstance(stored, dict):
            default.update(stored)

        # ── Auto-detect: if COA has accounts, setup is COMPLETED ──
        if default['status'] != 'COMPLETED':
            try:
                coa_count = ChartOfAccount.objects.filter(
                    organization=organization
                ).count() if ChartOfAccount else 0
                if coa_count > 0:
                    default['status'] = 'COMPLETED'
                    default['completedAt'] = default.get('completedAt') or timezone.now().isoformat()
                    # Persist so we don't re-check every time
                    ConfigurationService.save_setting(organization, 'coa_setup', default)
            except Exception:
                pass  # If query fails, just use the stored status

        return Response(default)

    @action(detail=False, methods=['get', 'post'])
    def global_financial(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            ConfigurationService.save_global_settings(organization, request.data)
            return Response({"message": "Settings saved successfully"})
        
        settings = ConfigurationService.get_global_settings(organization)
        return Response(settings)

    @action(detail=False, methods=['get', 'post'], url_path='item/(?P<key>[^/.]+)')
    def item(self, request, key=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            ConfigurationService.save_setting(organization, key, request.data)
            return Response({"message": f"Setting '{key}' saved successfully"})
        
        value = ConfigurationService.get_setting(organization, key)
        return Response(value)

    @action(detail=False, methods=['get', 'post'], url_path='purchase-analytics-config')
    def purchase_analytics_config(self, request):
        """
        GET  → Returns current PO Intelligence Grid configuration.
        POST → Saves new configuration.

        Stored in Organization.settings['purchase_analytics_config'].
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)

        DEFAULTS = {
            'sales_avg_period_days': 180,
            'sales_avg_exclude_types': [],
            'sales_window_size_days': 15,
            'best_price_period_days': 180,
            'proposed_qty_formula': 'AVG_DAILY_x_LEAD_DAYS',
            'proposed_qty_lead_days': 14,
            'proposed_qty_safety_multiplier': 1.5,
            'purchase_context': 'RETAIL',
            'po_count_source': 'PURCHASE_INVOICE',
            'financial_score_weights': {
                'margin': 40,
                'velocity': 30,
                'stock_health': 30,
            },
        }

        if request.method == 'POST':
            config = request.data

            # ── Detect sub-action ──
            sub_action = request.query_params.get('action')

            # ── History endpoint ──
            if sub_action == 'history':
                history = ConfigurationService.get_setting(organization, 'purchase_analytics_history', [])
                if not isinstance(history, list):
                    history = []
                return Response({'history': history, 'total': len(history)})

            # ── Rollback endpoint ──
            if sub_action == 'rollback':
                version_idx = config.get('version_index')
                history = ConfigurationService.get_setting(organization, 'purchase_analytics_history', [])
                if not isinstance(history, list) or not history:
                    return Response({"error": "No history available"}, status=status.HTTP_400_BAD_REQUEST)
                if version_idx is None or version_idx < 0 or version_idx >= len(history):
                    return Response({"error": "Invalid version index"}, status=status.HTTP_400_BAD_REQUEST)
                snapshot = history[version_idx].get('config', {})
                merged = {**DEFAULTS, **snapshot}
                # Save the rollback as a new version
                history.append({
                    'config': merged,
                    'changed_by': request.user.username if request.user else 'system',
                    'changed_at': timezone.now().isoformat(),
                    'action': f'rollback_to_v{version_idx}',
                    'changes': [],
                })
                if len(history) > 50:
                    history = history[-50:]
                ConfigurationService.save_setting(organization, 'purchase_analytics_config', merged)
                ConfigurationService.save_setting(organization, 'purchase_analytics_history', history)
                return Response({"message": f"Rolled back to version {version_idx}", **merged})

            # ── Normal save ──
            merged = {**DEFAULTS}
            for k, v in config.items():
                if k in DEFAULTS:
                    merged[k] = v

            # Track changes for audit
            old_config = ConfigurationService.get_setting(organization, 'purchase_analytics_config', {})
            if not isinstance(old_config, dict):
                old_config = {}
            old_full = {**DEFAULTS, **old_config}

            changes = []
            for k in DEFAULTS:
                old_val = old_full.get(k)
                new_val = merged.get(k)
                if str(old_val) != str(new_val):
                    changes.append({'field': k, 'old': old_val, 'new': new_val})

            # Save config
            ConfigurationService.save_setting(organization, 'purchase_analytics_config', merged)

            # Save version history
            history = ConfigurationService.get_setting(organization, 'purchase_analytics_history', [])
            if not isinstance(history, list):
                history = []
            history.append({
                'config': merged,
                'changed_by': request.user.username if request.user else 'system',
                'changed_at': timezone.now().isoformat(),
                'action': 'save',
                'changes': changes,
            })
            # Keep max 50 versions
            if len(history) > 50:
                history = history[-50:]
            ConfigurationService.save_setting(organization, 'purchase_analytics_history', history)

            return Response({
                "message": "Purchase analytics config saved",
                "changed_by": request.user.username if request.user else 'system',
                "changed_at": timezone.now().isoformat(),
                "changes_count": len(changes),
                **merged
            })

        stored = ConfigurationService.get_setting(organization, 'purchase_analytics_config', {})
        if not isinstance(stored, dict):
            stored = {}
        result = {**DEFAULTS, **stored}

        # ── RBAC: determine user permission level ──
        user = request.user
        role = 'viewer'
        if user and user.is_authenticated:
            if user.is_superuser or getattr(user, 'is_org_admin', False):
                role = 'admin'
            elif user.has_perm('erp.change_organization') or getattr(user, 'role', '') in ('manager', 'admin', 'owner'):
                role = 'editor'
            else:
                role = 'viewer'
        # Fields restricted for viewers (read-only)
        restricted_fields = [] if role in ('admin', 'editor') else list(DEFAULTS.keys())
        result['_user_role'] = role
        result['_restricted_fields'] = restricted_fields

        # ── Presence: track active editors ──
        presence_key = 'purchase_analytics_presence'
        presence = ConfigurationService.get_setting(organization, presence_key, {})
        if not isinstance(presence, dict):
            presence = {}
        now = timezone.now()
        # Register this user as active
        if user and user.is_authenticated:
            presence[user.username] = now.isoformat()
        # Clean stale (>90s ago)
        cutoff = (now - timezone.timedelta(seconds=90)).isoformat()
        presence = {k: v for k, v in presence.items() if v > cutoff}
        ConfigurationService.save_setting(organization, presence_key, presence)
        # Exclude current user from "active editors" list
        other_editors = [k for k in presence.keys() if k != (user.username if user else '')]
        result['_active_editors'] = other_editors

        # Attach last modified metadata from history
        history = ConfigurationService.get_setting(organization, 'purchase_analytics_history', [])
        if isinstance(history, list) and history:
            last = history[-1]
            result['_last_modified_by'] = last.get('changed_by', 'unknown')
            result['_last_modified_at'] = last.get('changed_at')
            result['_version_count'] = len(history)
        return Response(result)

    @action(detail=False, methods=['get', 'post', 'delete'], url_path='analytics-profiles')
    def analytics_profiles(self, request):
        """
        Analytics Profile Engine — per-page configuration profiles.

        GET  → List all profiles (optional ?page_context=X to get resolved config)
        POST → Create/update/activate/delete profiles based on 'action' field
        DELETE → Delete a profile by ?profile_id=X
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)

        if request.method == 'GET':
            page_context = request.query_params.get('page_context')
            if page_context and request.query_params.get('resolve') == 'true':
                config = ConfigurationService.resolve_analytics_config(organization, page_context)
                return Response({'resolved_config': config, 'page_context': page_context})

            data = ConfigurationService.get_analytics_profiles(organization)
            if page_context:
                data['profiles'] = [p for p in data.get('profiles', []) if p.get('page_context') == page_context]
            return Response(data)

        if request.method == 'DELETE':
            profile_id = request.query_params.get('profile_id')
            if not profile_id:
                return Response({"error": "profile_id required"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                ConfigurationService.delete_analytics_profile(organization, profile_id)
                return Response({"message": "Profile deleted"})
            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # POST — action-based
        action_type = request.data.get('action', 'create')

        if action_type == 'create':
            name = request.data.get('name', 'New Profile')
            page_context = request.data.get('page_context')
            overrides = request.data.get('overrides', {})
            visibility = request.data.get('visibility', 'organization')
            if not page_context:
                return Response({"error": "page_context required"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                profile = ConfigurationService.create_analytics_profile(
                    organization, name, page_context, overrides
                )
                profile['visibility'] = visibility
                if visibility == 'personal' and request.user:
                    profile['created_by'] = request.user.username
                return Response({"message": "Profile created", "profile": profile})
            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        elif action_type == 'update':
            profile_id = request.data.get('profile_id')
            updates = {}
            if 'name' in request.data:
                updates['name'] = request.data['name']
            if 'overrides' in request.data:
                updates['overrides'] = request.data['overrides']
            if not profile_id:
                return Response({"error": "profile_id required"}, status=status.HTTP_400_BAD_REQUEST)
            data = ConfigurationService.update_analytics_profile(organization, profile_id, updates)
            return Response({"message": "Profile updated", **data})

        elif action_type == 'activate':
            page_context = request.data.get('page_context')
            profile_id = request.data.get('profile_id')
            if not page_context:
                return Response({"error": "page_context required"}, status=status.HTTP_400_BAD_REQUEST)
            data = ConfigurationService.set_active_profile(organization, page_context, profile_id)
            return Response({"message": f"Active profile set for {page_context}", **data})

        elif action_type == 'delete':
            profile_id = request.data.get('profile_id')
            if not profile_id:
                return Response({"error": "profile_id required"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                ConfigurationService.delete_analytics_profile(organization, profile_id)
                return Response({"message": "Profile deleted"})
            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"error": f"Unknown action: {action_type}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    from erp.latency_middleware import LatencyStore
    store = LatencyStore()
    latency = store.get_stats()

    return Response({
        "status": "online",
        "service": "TSF ERP Core (Django)",
        "database": "PostgreSQL",
        "tenant_context": request.headers.get('X-Tenant-Slug', 'None'),
        "organization_id": get_current_tenant_id(),
        "latency": {
            "avg_ms": latency['avg_ms'],
            "p50_ms": latency['p50_ms'],
            "p95_ms": latency['p95_ms'],
            "p99_ms": latency['p99_ms'],
            "max_ms": latency['max_ms'],
            "min_ms": latency.get('min_ms', 0),
        },
        "traffic": {
            "total_requests": latency['total_requests'],
            "tracked_window": latency['tracked_window'],
            "requests_last_5min": latency.get('requests_last_5min', 0),
            "status_breakdown": latency.get('status_breakdown', {}),
        },
        "slow_endpoints": latency.get('slow_endpoints', []),
        "uptime_seconds": latency.get('uptime_seconds', 0),
    })
class RecordHistoryViewSet(viewsets.ViewSet):
    """
    Record History API — Retrieves the full audit trail for any entity.
    GET /api/record-history/?table=Product&id=<uuid>
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def trail(self, request):
        from .models_audit import AuditLog
        table = request.query_params.get('table', '')
        record_id = request.query_params.get('id', '')
        limit = min(int(request.query_params.get('limit', 50)), 200)

        if not table or not record_id:
            return Response({"error": "Both 'table' and 'id' params required"}, status=status.HTTP_400_BAD_REQUEST)

        organization_id = get_current_tenant_id()
        qs = AuditLog.objects.filter(table_name=table, record_id=record_id)
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        
        # --- STRICT SCOPE ISOLATION ---
        from .middleware import get_authorized_scope
        auth_scope = get_authorized_scope() or 'official'
        if auth_scope == 'official':
             # Filter metadata for OFFICIAL scope or no scope (legacy)
             qs = qs.filter(Q(metadata__scope='OFFICIAL') | Q(metadata__scope__isnull=True))
        
        entries = qs[:limit]
        data = [{
            "id": str(e.id),
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "action": e.action,
            "actor": e.actor.username if e.actor else "system",
            "old_value": e.old_value,
            "new_value": e.new_value,
            "ip_address": str(e.ip_address) if e.ip_address else None,
            "description": e.description,
        } for e in entries]

        return Response({"table": table, "record_id": record_id, "history": data})


class EntityGraphViewSet(viewsets.ViewSet):
    """
    Entity Graph API — Shows relationships between entities.
    GET /api/entity-graph/?table=Product&id=<uuid>
    Returns the entity and all related audit/approval/task references.
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def relations(self, request):
        from .models_audit import AuditLog, ApprovalRequest, TaskQueue
        table = request.query_params.get('table', '')
        record_id = request.query_params.get('id', '')

        if not table or not record_id:
            return Response({"error": "Both 'table' and 'id' params required"}, status=status.HTTP_400_BAD_REQUEST)

        organization_id = get_current_tenant_id()

        # Audit entries for this entity
        audit_qs = AuditLog.objects.filter(table_name=table, record_id=record_id)
        if organization_id:
            audit_qs = audit_qs.filter(organization_id=organization_id)
        audit_ids = list(audit_qs.values_list('id', flat=True)[:50])

        # Approval requests linked to this entity
        approval_qs = ApprovalRequest.objects.filter(target_table=table, target_id=record_id)
        if organization_id:
            approval_qs = approval_qs.filter(organization_id=organization_id)
        approvals = [{
            "id": str(a.id),
            "status": a.status,
            "requested_by": a.requested_by.username if a.requested_by else None,
            "reviewed_by": a.reviewed_by.username if a.reviewed_by else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        } for a in approval_qs[:20]]

        # Tasks linked via audit logs
        tasks_qs = TaskQueue.objects.filter(source_audit_log_id__in=audit_ids)
        tasks = [{
            "id": str(t.id),
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        } for t in tasks_qs[:20]]

        return Response({
            "entity": {"table": table, "id": record_id},
            "audit_count": len(audit_ids),
            "approvals": approvals,
            "tasks": tasks,
        })
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def import_sales_csv_view(request):
    """
    Endpoint to receive a CSV file and mapping for batch sales import.
    """
    from .services_sales_import import SalesImportService
    
    csv_file = request.FILES.get('file')
    mapping_str = request.data.get('mapping')
    warehouse_id = request.data.get('warehouse_id')
    scope = request.data.get('scope', 'INTERNAL')

    if not all([csv_file, mapping_str, warehouse_id]):
        return Response({"error": "Missing file, mapping, or warehouse_id."}, status=400)

    try:
        import json
        mapping = json.loads(mapping_str)
        results = SalesImportService.process_csv(
            organization=request.user.organization,
            user=request.user,
            warehouse_id=warehouse_id,
            csv_file=csv_file,
            mapping=mapping,
            scope=scope
        )
        return Response(results)
    except Exception as e:
        import logging
        logger = logging.getLogger('erp')
        logger.error(f"[SALE_IMPORT_VIEW] Error: {e}")
        return Response({"error": str(e)}, status=500)
