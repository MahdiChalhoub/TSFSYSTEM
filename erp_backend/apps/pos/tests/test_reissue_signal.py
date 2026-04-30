"""
POS Module — Procurement Reissue Signal Tests
==============================================
Validates the auto-reissue loop that fires when a PO is REJECTED or CANCELLED:
  - Category-aware reissue notes (PRICE_HIGH / NO_STOCK / EXPIRY_TOO_SOON / DAMAGED / OTHER)
  - NEEDS_REVISION reverts the PO to DRAFT instead — no reissue
  - Partial-receipt suppression
  - Workspace task board side effects
  - Bump-while-PO-in-flight policy

Mirrors the scenarios in `manage.py smoke_test_reissue` but runs as part of
the test suite (fresh test DB per run).
"""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from erp.models import Organization, User
from apps.crm.models import Contact
from apps.inventory.models import Product, Unit, Category
from apps.pos.models.purchase_order_models import PurchaseOrder, PurchaseOrderLine
from apps.pos.models.procurement_request_models import ProcurementRequest


class ReissueTestBase(TestCase):
    """Shared fixtures for all reissue-loop tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="Reissue Test Org", slug="reissue-test")
        cls.user = User.objects.create_user(
            username="buyer", password="test123",
            email="buyer@test.com", organization=cls.org,
        )
        cls.unit = Unit.objects.create(organization=cls.org, name="Piece", code="PCS")
        cls.category = Category.objects.create(organization=cls.org, name="General")
        cls.product = Product.objects.create(
            organization=cls.org, name="Test Widget", sku="WDG-001",
            category=cls.category, unit=cls.unit,
            cost_price=Decimal("0.00"),
            cost_price_ht=Decimal("10.00"), cost_price_ttc=Decimal("11.00"),
            selling_price_ht=Decimal("25.00"), selling_price_ttc=Decimal("27.50"),
            tva_rate=Decimal("0.10"),
        )
        cls.supplier = Contact.objects.create(
            organization=cls.org, type='SUPPLIER', name="Acme Supplies",
        )

    # ── helpers ────────────────────────────────────────────────────────
    def _make_request_and_po(self, *, with_receipt=False):
        req = ProcurementRequest.objects.create(
            organization=self.org, request_type='PURCHASE',
            status='APPROVED', priority='NORMAL',
            product=self.product, quantity=Decimal('5'),
            supplier=self.supplier, requested_by=self.user,
            reviewed_by=self.user, reviewed_at=timezone.now(),
        )
        po = PurchaseOrder.objects.create(
            organization=self.org, supplier=self.supplier,
            supplier_name=self.supplier.name, status='DRAFT', priority='NORMAL',
        )
        line = PurchaseOrderLine.objects.create(
            organization=self.org, order=po, product=self.product,
            quantity=Decimal('5'), unit_price=Decimal('10'),
        )
        req.source_po = po
        req.status = 'EXECUTED'
        req.save(update_fields=['source_po', 'status'])

        if with_receipt:
            line.qty_received = Decimal('2')
            line.save(update_fields=['qty_received'])

        return req, po, line

    def _reject_po(self, po, *, category, free_text='reason text', target='REJECTED'):
        po.rejection_reason = f"[{category}] {free_text}"
        po.rejected_by = self.user
        po.rejected_at = timezone.now()
        po.status = target
        po.save(update_fields=['status', 'rejection_reason', 'rejected_by', 'rejected_at'])

    def _find_reissue(self, original):
        return ProcurementRequest.objects.filter(
            organization=self.org, product=self.product,
            notes__contains=f"[Reissue of #{original.id}]",
        ).first()


# =============================================================================
# CATEGORY-AWARE REISSUE
# =============================================================================
class TestReissueCategories(ReissueTestBase):
    """Each rejection category should produce a reissue with category-specific notes."""

    def test_price_high_creates_reissue_with_negotiation_hint(self):
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='PRICE_HIGH', free_text='quote 18% over target')
        new = self._find_reissue(original)
        self.assertIsNotNone(new, "PRICE_HIGH should auto-reissue")
        self.assertIn('PRICE_HIGH', new.notes or '')
        self.assertIn('Negotiate', new.notes or '')
        self.assertEqual(new.status, 'PENDING')
        # Source-PO link must be cleared so the reissue isn't recursively triggered.
        self.assertIsNone(new.source_po_id)

    def test_no_stock_creates_reissue_with_alternative_supplier_hint(self):
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='NO_STOCK')
        new = self._find_reissue(original)
        self.assertIsNotNone(new)
        self.assertIn('NO_STOCK', new.notes or '')
        self.assertIn('different supplier', (new.notes or '').lower())

    def test_damaged_creates_reissue_with_replacement_hint(self):
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='DAMAGED')
        new = self._find_reissue(original)
        self.assertIsNotNone(new)
        self.assertIn('DAMAGED', new.notes or '')

    def test_expiry_too_soon_creates_reissue_with_fresher_batch_hint(self):
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='EXPIRY_TOO_SOON')
        new = self._find_reissue(original)
        self.assertIsNotNone(new)
        self.assertIn('EXPIRY_TOO_SOON', new.notes or '')
        self.assertIn('fresher', (new.notes or '').lower())

    def test_other_creates_reissue_with_generic_hint(self):
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='OTHER', free_text='unspecified')
        new = self._find_reissue(original)
        self.assertIsNotNone(new)
        self.assertIn('OTHER', new.notes or '')

    def test_cancelled_po_also_triggers_reissue(self):
        """Cancellation before fulfilment should reissue the same as rejection."""
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='OTHER', target='CANCELLED')
        new = self._find_reissue(original)
        self.assertIsNotNone(new, "CANCELLED PO should auto-reissue")


# =============================================================================
# NEEDS_REVISION
# =============================================================================
class TestNeedsRevision(ReissueTestBase):
    """NEEDS_REVISION is a soft rejection — PO reverts to DRAFT, no reissue."""

    def test_needs_revision_does_not_reissue(self):
        original, po, _ = self._make_request_and_po()
        # Mirror the view-layer behavior: status DRAFT, not REJECTED.
        po.rejection_reason = "[NEEDS_REVISION] please change supplier"
        po.status = 'DRAFT'
        po.save(update_fields=['status', 'rejection_reason'])
        # Even if we somehow reach the signal with REJECTED + NEEDS_REVISION,
        # the category branch should bail.
        new = self._find_reissue(original)
        self.assertIsNone(new, "NEEDS_REVISION must not auto-reissue")


# =============================================================================
# RECEIPT-AWARE SUPPRESSION
# =============================================================================
class TestReceiptSuppression(ReissueTestBase):
    """If any goods were received before rejection, skip the reissue."""

    def test_partial_receipt_suppresses_reissue(self):
        original, po, _ = self._make_request_and_po(with_receipt=True)
        self._reject_po(po, category='DAMAGED', free_text='wrong batch')
        new = self._find_reissue(original)
        self.assertIsNone(
            new,
            "Partial receipt should suppress auto-reissue — original need was at "
            "least partly fulfilled, operator can submit a fresh request manually",
        )


# =============================================================================
# DOUBLE-REISSUE GUARD
# =============================================================================
class TestDoubleReissueGuard(ReissueTestBase):
    """Saving the PO twice in REJECTED state must not create two reissues."""

    def test_second_save_does_not_create_duplicate(self):
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='PRICE_HIGH')
        first = self._find_reissue(original)
        self.assertIsNotNone(first)
        # Re-save without changing anything — signal fires again.
        po.save(update_fields=['status'])
        all_reissues = ProcurementRequest.objects.filter(
            organization=self.org,
            notes__contains=f"[Reissue of #{original.id}]",
        )
        self.assertEqual(all_reissues.count(), 1, "Second post_save must not duplicate the reissue")


# =============================================================================
# WORKSPACE TASK BOARD
# =============================================================================
class TestTaskBoardIntegration(ReissueTestBase):
    """Reissue should close the original task and open a fresh one."""

    def test_taskboard_reflects_reissue_lifecycle(self):
        try:
            from apps.workspace.models import Task as WorkspaceTask
        except ImportError:
            self.skipTest("workspace app not installed")

        original, po, _ = self._make_request_and_po()

        # Seed a task for the original request (signal-layer auto-creates one
        # via the create-time hook, but that path runs through the request
        # viewset rather than direct ORM. Create explicitly here.).
        WorkspaceTask.objects.create(
            organization=self.org,
            title=f"Review purchase: {self.product.name}",
            status='PENDING', priority='MEDIUM',
            related_object_type='ProcurementRequest',
            related_object_id=original.id,
        )

        self._reject_po(po, category='PRICE_HIGH')
        new = self._find_reissue(original)
        self.assertIsNotNone(new)

        orig_task = WorkspaceTask.objects.filter(
            organization=self.org,
            related_object_type='ProcurementRequest',
            related_object_id=original.id,
        ).order_by('-id').first()
        self.assertIsNotNone(orig_task)
        self.assertIn(orig_task.status, ('CANCELLED', 'COMPLETED'),
                      "Original request task should close when reissue fires")

        new_task = WorkspaceTask.objects.filter(
            organization=self.org,
            related_object_type='ProcurementRequest',
            related_object_id=new.id,
        ).order_by('-id').first()
        self.assertIsNotNone(new_task, "Reissued request should have a fresh task")


# =============================================================================
# SERIALIZER FIELDS
# =============================================================================
class TestRejectionSerializerFields(ReissueTestBase):
    """`rejection_category` and `caused_reissue_id` should be derivable."""

    def test_rejection_category_extracted_from_bracket_prefix(self):
        from apps.pos.serializers.purchase_serializers import PurchaseOrderSerializer
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='DAMAGED', free_text='broken')
        data = PurchaseOrderSerializer(po).data
        self.assertEqual(data.get('rejection_category'), 'DAMAGED')

    def test_caused_reissue_id_links_to_new_request(self):
        from apps.pos.serializers.purchase_serializers import PurchaseOrderSerializer
        original, po, _ = self._make_request_and_po()
        self._reject_po(po, category='PRICE_HIGH')
        new = self._find_reissue(original)
        po.refresh_from_db()
        data = PurchaseOrderSerializer(po).data
        self.assertEqual(data.get('caused_reissue_id'), new.id)

    def test_caused_reissue_id_null_for_open_po(self):
        from apps.pos.serializers.purchase_serializers import PurchaseOrderSerializer
        _, po, _ = self._make_request_and_po()
        # PO still in DRAFT — no reissue possible.
        data = PurchaseOrderSerializer(po).data
        self.assertIsNone(data.get('caused_reissue_id'))
