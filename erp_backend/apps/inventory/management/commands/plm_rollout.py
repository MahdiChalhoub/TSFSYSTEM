"""
PLM Rollout Command — backfill readiness, compute completeness, and assess
operational state across all products in an organization.

Usage:
    python manage.py plm_rollout --org <org_id> [--batch 100] [--dry-run]
    python manage.py plm_rollout --org <org_id> --readiness-only
    python manage.py plm_rollout --org <org_id> --completeness-only
    python manage.py plm_rollout --org <org_id> --fresh-only
"""
import time
from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = 'PLM v3 rollout: backfill completeness, readiness, and fresh profiles'

    def add_arguments(self, parser):
        parser.add_argument('--org', type=int, required=True, help='Organization ID')
        parser.add_argument('--batch', type=int, default=100, help='Batch size')
        parser.add_argument('--dry-run', action='store_true', help='Report only, no writes')
        parser.add_argument('--readiness-only', action='store_true', help='Only refresh readiness')
        parser.add_argument('--completeness-only', action='store_true', help='Only refresh completeness')
        parser.add_argument('--fresh-only', action='store_true', help='Only create missing fresh profiles')

    def handle(self, *args, **options):
        from apps.inventory.models import Product
        from erp.models import Organization

        org_id = options['org']
        batch_size = options['batch']
        dry_run = options['dry_run']

        try:
            org = Organization.objects.get(pk=org_id)
        except Organization.DoesNotExist:
            self.stderr.write(f'Organization {org_id} not found')
            return

        products = Product.objects.filter(organization=org)
        total = products.count()
        self.stdout.write(f'PLM Rollout for "{org.name}" — {total} products')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be made'))

        if options['readiness_only']:
            self._run_readiness(products, batch_size, dry_run)
        elif options['completeness_only']:
            self._run_completeness(products, batch_size, dry_run)
        elif options['fresh_only']:
            self._run_fresh_profiles(products, org, batch_size, dry_run)
        else:
            # Full rollout
            self._run_completeness(products, batch_size, dry_run)
            self._run_readiness(products, batch_size, dry_run)
            self._run_fresh_profiles(products, org, batch_size, dry_run)
            self._report_summary(products)

    def _run_completeness(self, products, batch_size, dry_run):
        from apps.inventory.services.product_completeness import ProductCompletenessService

        self.stdout.write('\n── Completeness Backfill ──')
        start = time.time()
        changed = 0
        for i, product in enumerate(products.iterator(chunk_size=batch_size)):
            old_level = product.data_completeness_level
            new_level = ProductCompletenessService.compute(product)
            if old_level != new_level:
                changed += 1
                if not dry_run:
                    ProductCompletenessService.refresh(product, save=True)
            if (i + 1) % batch_size == 0:
                self.stdout.write(f'  Processed {i + 1} products...')

        elapsed = time.time() - start
        self.stdout.write(self.style.SUCCESS(
            f'  Completeness: {changed} products changed in {elapsed:.1f}s'
        ))

    def _run_readiness(self, products, batch_size, dry_run):
        from apps.inventory.services.readiness_service import ReadinessService

        self.stdout.write('\n── Readiness Backfill ──')
        start = time.time()
        scores = {'READY': 0, 'PARTIAL': 0, 'NOT_READY': 0}

        for i, product in enumerate(products.iterator(chunk_size=batch_size)):
            if not dry_run:
                readiness = ReadinessService.refresh(product, trigger='plm_rollout')
                scores[readiness.status] = scores.get(readiness.status, 0) + 1
            if (i + 1) % batch_size == 0:
                self.stdout.write(f'  Processed {i + 1} products...')

        elapsed = time.time() - start
        self.stdout.write(self.style.SUCCESS(
            f'  Readiness: {elapsed:.1f}s — '
            f'READY={scores["READY"]}, PARTIAL={scores["PARTIAL"]}, NOT_READY={scores["NOT_READY"]}'
        ))

    def _run_fresh_profiles(self, products, org, batch_size, dry_run):
        from apps.inventory.models.fresh_models import ProductFreshProfile

        self.stdout.write('\n── Fresh Profile Creation ──')
        fresh_products = products.filter(product_type='FRESH')
        count = fresh_products.count()
        self.stdout.write(f'  Found {count} FRESH products')

        created = 0
        for product in fresh_products.iterator(chunk_size=batch_size):
            if not ProductFreshProfile.objects.filter(product=product).exists():
                if not dry_run:
                    ProductFreshProfile.objects.create(
                        organization=org,
                        product=product,
                        shelf_life_days=3,
                    )
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {created} fresh profiles'))

    def _report_summary(self, products):
        from apps.inventory.models.readiness_models import ProductReadiness

        self.stdout.write('\n── PLM Rollout Summary ──')
        total = products.count()

        # Completeness distribution
        for level in range(8):
            count = products.filter(data_completeness_level=level).count()
            pct = (count / total * 100) if total else 0
            bar = '█' * int(pct / 2)
            self.stdout.write(f'  L{level}: {count:>5} ({pct:5.1f}%) {bar}')

        # Readiness
        readiness_qs = ProductReadiness.objects.filter(product__in=products)
        fully_ready = readiness_qs.filter(
            is_scan_ready=True, is_label_ready=True, is_shelf_ready=True,
            is_purchase_ready=True, is_replenishment_ready=True,
        ).count()
        self.stdout.write(f'\n  Fully operational: {fully_ready}/{total}')

        # Type distribution
        for ptype in ['STANDARD', 'COMBO', 'SERVICE', 'BLANK', 'FRESH']:
            count = products.filter(product_type=ptype).count()
            self.stdout.write(f'  {ptype}: {count}')

        self.stdout.write(self.style.SUCCESS('\n✅ PLM Rollout complete'))
