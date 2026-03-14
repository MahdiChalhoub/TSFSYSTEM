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
        """COA Setup Wizard status tracker."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
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
