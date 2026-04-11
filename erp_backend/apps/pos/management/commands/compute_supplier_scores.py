"""
compute_supplier_scores — Scheduled Management Command
========================================================
Computes SupplierPerformanceSnapshot for every active supplier
within a configurable period window.

Usage:
    # Last 90 days for all organizations
    python manage.py compute_supplier_scores

    # Custom period
    python manage.py compute_supplier_scores --days 30

    # Specific organization
    python manage.py compute_supplier_scores --org <org_id>

    # Specific supplier
    python manage.py compute_supplier_scores --supplier <supplier_id>

Designed to run as a cron job or Celery periodic task:
    # Nightly at 2 AM
    0 2 * * * cd /app && python manage.py compute_supplier_scores --days 90

    # Weekly on Sunday
    0 3 * * 0 cd /app && python manage.py compute_supplier_scores --days 180
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Compute supplier performance scores and persist snapshots.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=90,
            help='Number of days to look back for PO data (default: 90)'
        )
        parser.add_argument(
            '--org', type=str, default=None,
            help='Specific organization UUID to process'
        )
        parser.add_argument(
            '--supplier', type=str, default=None,
            help='Specific supplier ID to score'
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Preview what would be computed without saving'
        )

    def handle(self, *args, **options):
        from erp.models import Organization
        from apps.pos.models import PurchaseOrder
        from apps.pos.services.procurement_domain_service import ProcurementDomainService

        days = options['days']
        org_id = options['org']
        supplier_id = options['supplier']
        dry_run = options['dry_run']

        period_end = timezone.now().date()
        period_start = period_end - timedelta(days=days)

        self.stdout.write(
            f"Computing supplier scores for period {period_start} → {period_end} "
            f"({days} days)"
        )

        # Determine organizations to process
        if org_id:
            orgs = Organization.objects.filter(id=org_id)
        else:
            # Get all orgs that have POs in the period
            org_ids = PurchaseOrder.objects.filter(
                created_at__date__gte=period_start,
                created_at__date__lte=period_end,
            ).exclude(
                status='CANCELLED'
            ).values_list('organization_id', flat=True).distinct()
            orgs = Organization.objects.filter(id__in=org_ids)

        total_snapshots = 0
        total_errors = 0

        for org in orgs:
            self.stdout.write(f"\n  Organization: {org.name} ({org.id})")

            # Get all suppliers with POs in period
            if supplier_id:
                supplier_ids = [supplier_id]
            else:
                supplier_ids = PurchaseOrder.objects.filter(
                    organization=org,
                    created_at__date__gte=period_start,
                    created_at__date__lte=period_end,
                ).exclude(
                    status='CANCELLED'
                ).exclude(
                    supplier_id__isnull=True
                ).values_list('supplier_id', flat=True).distinct()

            for sid in supplier_ids:
                try:
                    if dry_run:
                        # Count POs without creating snapshot
                        po_count = PurchaseOrder.objects.filter(
                            organization=org,
                            supplier_id=sid,
                            created_at__date__gte=period_start,
                            created_at__date__lte=period_end,
                        ).exclude(status='CANCELLED').count()
                        self.stdout.write(
                            f"    [DRY-RUN] Supplier {sid}: {po_count} POs"
                        )
                        total_snapshots += 1
                        continue

                    snapshot = ProcurementDomainService.compute_supplier_score(
                        organization=org,
                        supplier_id=sid,
                        period_start=period_start,
                        period_end=period_end,
                    )

                    if snapshot:
                        self.stdout.write(
                            f"    ✅ Supplier {sid}: "
                            f"score={snapshot.score}, "
                            f"POs={snapshot.total_pos}, "
                            f"OTD={snapshot.on_time_delivery_rate}%, "
                            f"fill={snapshot.fill_rate}%"
                        )
                        total_snapshots += 1
                    else:
                        self.stdout.write(
                            f"    ⏭ Supplier {sid}: No qualifying POs"
                        )

                except Exception as e:
                    total_errors += 1
                    self.stderr.write(
                        f"    ❌ Supplier {sid}: {str(e)}"
                    )
                    logger.exception(
                        f"Error computing score for supplier {sid} in org {org.id}"
                    )

        self.stdout.write(
            f"\n{'[DRY-RUN] ' if dry_run else ''}"
            f"Done. {total_snapshots} snapshots created, {total_errors} errors."
        )
