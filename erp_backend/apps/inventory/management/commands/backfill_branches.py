"""
Management command: backfill_branches
=====================================
Backfills branch_id on all transactional records that don't have one yet.
Also creates a default Branch for orphan warehouses.

Usage:
    python manage.py backfill_branches
    python manage.py backfill_branches --dry-run
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Backfill branch_id on transactional records and organize orphan warehouses'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Preview without making changes')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        prefix = '[DRY RUN] ' if dry_run else ''

        from apps.inventory.models import Warehouse, Inventory, InventoryMovement
        from apps.inventory.models.goods_receipt_models import GoodsReceipt
        from apps.inventory.models.stock_move_model import StockMove
        from erp.connector_registry import connector
        Order = connector.require('pos.orders.get_model', org_id=0, source='inventory')
        from erp.models import Organization

        for org in Organization.objects.all():
            self.stdout.write(f'\n{"="*60}')
            self.stdout.write(f'{prefix}Organization: {org.name} (ID: {org.id})')
            self.stdout.write(f'{"="*60}')

            # ── Step 1: Ensure at least one Branch exists ──
            branches = Warehouse.objects.filter(organization=org, location_type='BRANCH')
            if not branches.exists():
                if not dry_run:
                    default_branch = Warehouse(
                        organization=org,
                        name=f'{org.name} — Main Branch',
                        code='MAIN-BR',
                        location_type='BRANCH',
                        can_sell=False,
                    )
                    # Skip clean() for legacy migration
                    super(Warehouse, default_branch).save()
                    self.stdout.write(self.style.SUCCESS(f'  Created default branch: {default_branch.name}'))
                else:
                    self.stdout.write(f'  {prefix}Would create default branch: {org.name} — Main Branch')

            # Refresh branches
            branches = Warehouse.objects.filter(organization=org, location_type='BRANCH')
            default_branch = branches.first()

            # ── Step 2: Attach orphan warehouses to default branch ──
            orphans = Warehouse.objects.filter(
                organization=org, parent__isnull=True
            ).exclude(location_type='BRANCH')
            orphan_count = orphans.count()

            if orphan_count > 0:
                self.stdout.write(f'  {prefix}Found {orphan_count} orphan warehouses')
                if not dry_run and default_branch:
                    orphans.update(parent=default_branch)
                    self.stdout.write(self.style.SUCCESS(f'  Attached {orphan_count} orphans to {default_branch.name}'))

            # ── Step 3: Backfill branch on Inventory ──
            inv_missing = Inventory.objects.filter(organization=org, branch__isnull=True)
            inv_count = inv_missing.count()
            if inv_count > 0:
                self.stdout.write(f'  {prefix}Inventory records missing branch: {inv_count}')
                if not dry_run:
                    updated = 0
                    for inv in inv_missing.select_related('warehouse'):
                        branch = inv.warehouse.get_branch() if inv.warehouse else default_branch
                        if branch:
                            inv.branch = branch
                            inv.save(update_fields=['branch'])
                            updated += 1
                    self.stdout.write(self.style.SUCCESS(f'  Backfilled {updated} Inventory records'))

            # ── Step 4: Backfill branch on InventoryMovement ──
            mov_missing = InventoryMovement.objects.filter(organization=org, branch__isnull=True)
            mov_count = mov_missing.count()
            if mov_count > 0:
                self.stdout.write(f'  {prefix}InventoryMovement records missing branch: {mov_count}')
                if not dry_run:
                    updated = 0
                    for mov in mov_missing.select_related('warehouse'):
                        branch = mov.warehouse.get_branch() if mov.warehouse else default_branch
                        if branch:
                            mov.branch = branch
                            mov.save(update_fields=['branch'])
                            updated += 1
                    self.stdout.write(self.style.SUCCESS(f'  Backfilled {updated} InventoryMovement records'))

            # ── Step 5: Backfill branch on GoodsReceipt ──
            gr_missing = GoodsReceipt.objects.filter(organization=org, branch__isnull=True)
            gr_count = gr_missing.count()
            if gr_count > 0:
                self.stdout.write(f'  {prefix}GoodsReceipt records missing branch: {gr_count}')
                if not dry_run:
                    updated = 0
                    for gr in gr_missing.select_related('warehouse'):
                        branch = gr.warehouse.get_branch() if gr.warehouse else default_branch
                        if branch:
                            gr.branch = branch
                            gr.save(update_fields=['branch'])
                            updated += 1
                    self.stdout.write(self.style.SUCCESS(f'  Backfilled {updated} GoodsReceipt records'))

            # ── Step 6: Backfill branch on Order ──
            ord_missing = Order.objects.filter(organization=org, branch__isnull=True)
            ord_count = ord_missing.count()
            if ord_count > 0:
                self.stdout.write(f'  {prefix}Order records missing branch: {ord_count}')
                if not dry_run:
                    updated = 0
                    for order in ord_missing.select_related('site'):
                        branch = order.site.get_branch() if order.site else default_branch
                        if branch:
                            order.branch = branch
                            order.save(update_fields=['branch'])
                            updated += 1
                    self.stdout.write(self.style.SUCCESS(f'  Backfilled {updated} Order records'))

            # ── Step 7: Backfill branches on StockMove ──
            sm_missing = StockMove.objects.filter(
                organization=org
            ).filter(source_branch__isnull=True)
            sm_count = sm_missing.count()
            if sm_count > 0:
                self.stdout.write(f'  {prefix}StockMove records missing branch: {sm_count}')
                if not dry_run:
                    updated = 0
                    for sm in sm_missing.select_related('from_warehouse', 'to_warehouse'):
                        if sm.from_warehouse:
                            sm.source_branch = sm.from_warehouse.get_branch()
                        if sm.to_warehouse:
                            sm.dest_branch = sm.to_warehouse.get_branch()
                        sm.save(update_fields=['source_branch', 'dest_branch'])
                        updated += 1
                    self.stdout.write(self.style.SUCCESS(f'  Backfilled {updated} StockMove records'))

            # ── Step 8: Infer user assigned_branches from home_site ──
            from erp.models import User
            users = User.objects.filter(organization=org, home_site__isnull=False)
            for user in users:
                if not user.assigned_branches.exists() and user.home_site:
                    branch = user.home_site.get_branch()
                    if branch and not dry_run:
                        user.assigned_branches.add(branch)
                        self.stdout.write(f'  Assigned {user.username} → {branch.name}')
                    elif branch and dry_run:
                        self.stdout.write(f'  {prefix}Would assign {user.username} → {branch.name}')

        self.stdout.write(self.style.SUCCESS(f'\n✅ {prefix}Backfill complete!'))
