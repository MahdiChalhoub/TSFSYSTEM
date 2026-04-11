"""
Management command to backfill product completeness levels.

Usage:
    python manage.py backfill_completeness              # All active products
    python manage.py backfill_completeness --org=1      # Specific org
    python manage.py backfill_completeness --batch=200  # Custom batch size
    python manage.py backfill_completeness --dry-run    # Preview without saving
"""
from django.core.management.base import BaseCommand
from apps.inventory.models import Product
from apps.inventory.services.product_completeness import ProductCompletenessService


class Command(BaseCommand):
    help = 'Backfill data_completeness_level for all products using ProductCompletenessService'

    def add_arguments(self, parser):
        parser.add_argument(
            '--org', type=int, default=None,
            help='Organization ID to filter products (default: all orgs)',
        )
        parser.add_argument(
            '--batch', type=int, default=100,
            help='Batch size for processing (default: 100)',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Preview changes without saving to database',
        )

    def handle(self, *args, **options):
        org_id = options['org']
        batch_size = options['batch']
        dry_run = options['dry_run']

        qs = Product.objects.filter(is_active=True)
        if org_id:
            qs = qs.filter(organization_id=org_id)

        total = qs.count()
        self.stdout.write(f'Processing {total} products (batch={batch_size}, dry_run={dry_run})')

        updated = 0
        unchanged = 0
        level_distribution = {}

        for i, product in enumerate(qs.iterator(chunk_size=batch_size)):
            new_level = ProductCompletenessService.compute(product)
            old_level = product.data_completeness_level

            level_distribution[new_level] = level_distribution.get(new_level, 0) + 1

            if old_level != new_level:
                updated += 1
                if not dry_run:
                    product.data_completeness_level = new_level
                    product.save(update_fields=['data_completeness_level', 'updated_at'])
                if updated <= 20:  # Log first 20 changes
                    label = ProductCompletenessService.LABELS.get(new_level, '?')
                    self.stdout.write(
                        f'  {product.sku} ({product.name[:30]}): '
                        f'L{old_level} → L{new_level} ({label})'
                    )
            else:
                unchanged += 1

            if (i + 1) % 500 == 0:
                self.stdout.write(f'  ... processed {i + 1}/{total}')

        # Summary
        self.stdout.write(self.style.SUCCESS(
            f'\nDone! Updated: {updated}, Unchanged: {unchanged}, Total: {total}'
        ))
        self.stdout.write('\nLevel distribution:')
        for lvl in sorted(level_distribution.keys()):
            label = ProductCompletenessService.LABELS.get(lvl, '?')
            count = level_distribution[lvl]
            bar = '█' * min(count, 50)
            self.stdout.write(f'  L{lvl} {label:12s} {count:5d} {bar}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n⚠ DRY RUN — no changes saved.'))
