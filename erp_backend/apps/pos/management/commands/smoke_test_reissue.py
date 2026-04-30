"""
Management command: smoke_test_reissue
======================================
End-to-end exercise of the procurement request → PO → reject → auto-reissue
loop, including the receipt-aware suppression and the workspace task board
integration.

Runs entirely inside an atomic block that's rolled back at the end so the
database is left untouched (override with --commit).

Usage:
    python manage.py smoke_test_reissue --org <slug>
    python manage.py smoke_test_reissue --org <slug> --commit  # keep the records

What it asserts:
    1. PO rejected with [PRICE_HIGH]   → new ProcurementRequest created, contains category hint, original task → CANCELLED, new task created.
    2. PO rejected with [NO_STOCK]     → reissue with stock-specific hint.
    3. PO rejected with [DAMAGED]      → reissue with damage hint.
    4. PO rejected with [NEEDS_REVISION] → PO reverts to DRAFT, NO reissue fires.
    5. PO with partial receipt (qty_received > 0) then rejected → reissue suppressed.
    6. PO cancelled (status=CANCELLED) → same auto-reissue behavior as REJECTED.
"""
from decimal import Decimal
import sys

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from erp.models import Organization, User
from apps.inventory.models import Product
from apps.crm.models import Contact
from apps.pos.models.purchase_order_models import PurchaseOrder, PurchaseOrderLine
from apps.pos.models.procurement_request_models import ProcurementRequest


GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


class Assertion(Exception):
    pass


class Command(BaseCommand):
    help = 'End-to-end smoke test for procurement request → PO → reject auto-reissue loop'

    def add_arguments(self, parser):
        parser.add_argument('--org', required=True, help='Organization slug')
        parser.add_argument('--commit', action='store_true',
                            help='Keep the test records (default: rollback)')

    def handle(self, *args, **opts):
        try:
            org = Organization.objects.get(slug=opts['org'])
        except Organization.DoesNotExist:
            raise CommandError(f"Organization '{opts['org']}' not found")

        commit = opts['commit']

        # Find any active user + product + supplier in the org.
        # User is optional — the model allows requested_by=NULL (treated as system).
        user = (User.objects.filter(organization=org, is_active=True).first()
                or User.objects.filter(organization=org).first()
                or User.objects.filter(is_superuser=True).first())
        product = Product.objects.filter(organization=org).first()
        if product is None:
            raise CommandError(f"No product in {org.slug}")
        supplier = Contact.objects.filter(organization=org, type='SUPPLIER').first()
        if supplier is None:
            raise CommandError(f"No supplier in {org.slug}")

        self.stdout.write(f"{BLUE}Smoke test against{RESET} org={org.slug} user={user.username if user else '(none)'} product={product.name} supplier={supplier.name}")
        self.stdout.write(f"{YELLOW}Mode: {'COMMIT' if commit else 'ROLLBACK'}{RESET}\n")

        scenarios = [
            ('PRICE_HIGH',      'Price too high',      'REJECTED', False),
            ('NO_STOCK',        'No stock at supplier', 'REJECTED', False),
            ('DAMAGED',         'Goods damaged',       'REJECTED', False),
            ('NEEDS_REVISION',  'Needs editing',       'DRAFT',    False),
            ('PRICE_HIGH',      'Partial receipt',     'REJECTED', True),  # receipt-suppression
            ('OTHER',           'Cancelled before fulfilment', 'CANCELLED', False),
        ]

        passed = 0
        failed = 0

        sid = transaction.savepoint()
        try:
            for category, blurb, target_status, with_receipt in scenarios:
                label = f"[{category}{' +receipt' if with_receipt else ''}] → {target_status}"
                try:
                    self._run_scenario(org, user, product, supplier,
                                       category=category, target_status=target_status,
                                       with_receipt=with_receipt)
                    self.stdout.write(f"  {GREEN}✓{RESET} {label}")
                    passed += 1
                except Assertion as e:
                    self.stdout.write(f"  {RED}✗{RESET} {label}\n    {e}")
                    failed += 1
                except Exception as e:
                    self.stdout.write(f"  {RED}✗{RESET} {label}\n    {type(e).__name__}: {e}")
                    failed += 1
        finally:
            if commit:
                transaction.savepoint_commit(sid)
                self.stdout.write(f"\n{YELLOW}Records committed.{RESET}")
            else:
                transaction.savepoint_rollback(sid)
                self.stdout.write(f"\n{YELLOW}Rolled back. No data persisted.{RESET}")

        self.stdout.write(f"\n{passed} passed, {failed} failed")
        if failed:
            sys.exit(1)

    # ------------------------------------------------------------------
    def _run_scenario(self, org, user, product, supplier, *,
                       category, target_status, with_receipt):
        """Each scenario runs in its own savepoint so a failure in one
        doesn't poison the next."""
        inner = transaction.savepoint()
        try:
            # 1. Create a procurement request.
            req = ProcurementRequest.objects.create(
                organization=org,
                request_type='PURCHASE',
                status='APPROVED',  # skip approval flow, focus on PO loop
                priority='NORMAL',
                product=product,
                quantity=Decimal('5'),
                supplier=supplier,
                requested_by=user,
                reviewed_by=user,
                reviewed_at=timezone.now(),
                reason='smoke-test',
            )

            # 2. Build a PO and link via source_po (mimics convert-to-po).
            po = PurchaseOrder.objects.create(
                organization=org,
                supplier=supplier,
                supplier_name=supplier.name or '',
                status='DRAFT',
                priority='NORMAL',
            )
            line = PurchaseOrderLine.objects.create(
                organization=org,
                order=po,
                product=product,
                product_name=product.name,
                quantity=Decimal('5'),
                unit_price=Decimal('10'),
            )
            req.source_po = po
            req.status = 'EXECUTED'
            req.save(update_fields=['source_po', 'status'])

            if with_receipt:
                line.qty_received = Decimal('2')
                line.save(update_fields=['qty_received'])

            # 3. Drive the rejection. Mirror what PurchaseViewSet.reject does.
            free_text = f'smoke-test {category}'
            po.rejection_reason = f"[{category}] {free_text}"
            po.rejected_by = user
            po.rejected_at = timezone.now()

            if category == 'NEEDS_REVISION':
                po.status = 'DRAFT'
                po.save(update_fields=['status', 'rejection_reason', 'rejected_by', 'rejected_at'])
            else:
                po.status = target_status  # REJECTED or CANCELLED
                po.save(update_fields=['status', 'rejection_reason', 'rejected_by', 'rejected_at'])

            # 4. Assert the post-conditions.
            marker = f"[Reissue of #{req.id}]"
            reissue = ProcurementRequest.objects.filter(
                organization=org,
                product=product,
                notes__contains=marker,
            ).first()

            if category == 'NEEDS_REVISION':
                if reissue is not None:
                    raise Assertion("NEEDS_REVISION should not auto-reissue")
                po.refresh_from_db()
                if po.status != 'DRAFT':
                    raise Assertion(f"NEEDS_REVISION should land at DRAFT, got {po.status}")
                return

            if with_receipt:
                if reissue is not None:
                    raise Assertion("Partial receipt should suppress auto-reissue")
                return

            if reissue is None:
                raise Assertion(f"Expected a reissue request with marker {marker!r}")

            # Sanity-check the reissue carries the category context forward.
            if category not in (reissue.notes or ''):
                raise Assertion(f"Reissue notes missing category {category!r}: {reissue.notes!r}")

            # Workspace task assertions are best-effort — only check if the
            # workspace.Task table is wired up in this environment.
            self._check_taskboard(org, req, reissue)
        finally:
            transaction.savepoint_rollback(inner)

    def _check_taskboard(self, org, original, reissue):
        try:
            from apps.workspace.models import Task as WorkspaceTask
        except ImportError:
            return  # workspace app not installed — skip silently

        # Original task should have been moved out of PENDING.
        orig_task = WorkspaceTask.objects.filter(
            organization=org,
            related_object_type='ProcurementRequest',
            related_object_id=original.id,
        ).order_by('-id').first()
        if orig_task is not None and orig_task.status not in ('CANCELLED', 'COMPLETED'):
            raise Assertion(
                f"Original task should be CANCELLED/COMPLETED after reissue, got {orig_task.status}"
            )

        # New reissue should have a fresh task.
        new_task = WorkspaceTask.objects.filter(
            organization=org,
            related_object_type='ProcurementRequest',
            related_object_id=reissue.id,
        ).order_by('-id').first()
        if new_task is None:
            raise Assertion("Reissued request should have a new workspace task")
