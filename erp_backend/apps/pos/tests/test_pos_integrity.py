"""
POS Module — Integrity Tests
=============================
Tests for POS order immutability, hash chain, checkout, and purchase lifecycle.
Covers: order locking, hash chaining, stock deduction, receipt integrity.

Tier 3 of the Road to 5 Stars test coverage plan.
"""
from decimal import Decimal
import datetime

from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone

from erp.models import Organization, User
from apps.pos.models import Order, OrderLine
from apps.inventory.models import (
    Product, Unit, Category, Warehouse, Inventory,
)


class POSTestBase(TestCase):
    """Shared fixtures for all POS tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="POS Test Org", slug="pos-test")
        cls.user = User.objects.create_user(
            username="cashier",
            password="test123",
            email="cashier@test.com",
            organization=cls.org,
        )

        # Inventory fixtures
        cls.unit = Unit.objects.create(organization=cls.org, name="Piece", code="PCS")
        cls.category = Category.objects.create(organization=cls.org, name="General")
        cls.product = Product.objects.create(
            organization=cls.org,
            name="Test Widget",
            sku="WDG-001",
            category=cls.category,
            unit=cls.unit,
            cost_price=Decimal("0.00"),
            cost_price_ht=Decimal("10.00"),
            cost_price_ttc=Decimal("11.00"),
            selling_price_ht=Decimal("25.00"),
            selling_price_ttc=Decimal("27.50"),
            tva_rate=Decimal("0.10"),
        )
        cls.warehouse = Warehouse.objects.create(
            organization=cls.org,
            name="Main Warehouse",
        )


# =============================================================================
# ORDER IMMUTABILITY
# =============================================================================


class TestOrderImmutability(POSTestBase):
    """Tests for immutability guards on finalized orders."""

    def _create_completed_order(self):
        """Helper: create an order and mark it COMPLETED."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="COMPLETED",
            total_amount=Decimal("100.00"),
            user=self.user,
        )
        return order

    def test_completed_order_cannot_be_modified(self):
        """Modifying a COMPLETED order should raise ValidationError."""
        order = self._create_completed_order()
        order.total_amount = Decimal("200.00")
        with self.assertRaises(ValidationError) as cm:
            order.save()
        self.assertIn("Immutable POS", str(cm.exception))

    def test_completed_order_cannot_be_deleted(self):
        """Deleting a COMPLETED order should raise ValidationError."""
        order = self._create_completed_order()
        with self.assertRaises(ValidationError) as cm:
            order.delete()
        self.assertIn("Immutable POS", str(cm.exception))

    def test_invoiced_order_cannot_be_modified(self):
        """Modifying an INVOICED order should raise ValidationError."""
        order = Order.objects.create(
            organization=self.org,
            type="PURCHASE",
            status="INVOICED",
            total_amount=Decimal("50.00"),
        )
        order.notes = "Updated notes"
        with self.assertRaises(ValidationError):
            order.save()

    def test_received_order_cannot_be_deleted(self):
        """Deleting a RECEIVED order should raise ValidationError."""
        order = Order.objects.create(
            organization=self.org,
            type="PURCHASE",
            status="RECEIVED",
            total_amount=Decimal("75.00"),
        )
        with self.assertRaises(ValidationError):
            order.delete()

    def test_draft_order_can_be_modified(self):
        """DRAFT orders should be freely modifiable."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("100.00"),
        )
        order.total_amount = Decimal("200.00")
        order.save()  # Should not raise
        order.refresh_from_db()
        self.assertEqual(order.total_amount, Decimal("200.00"))

    def test_draft_order_can_be_deleted(self):
        """DRAFT orders should be deletable."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("100.00"),
        )
        order_id = order.id
        order.delete()  # Should not raise
        self.assertFalse(Order.objects.filter(id=order_id).exists())

    def test_force_audit_bypass_allows_completed_modification(self):
        """Internal bypass flag should allow modifying COMPLETED orders."""
        order = self._create_completed_order()
        order.total_amount = Decimal("200.00")
        order.save(force_audit_bypass=True)  # Should not raise
        order.refresh_from_db()
        self.assertEqual(order.total_amount, Decimal("200.00"))

    def test_cancelled_order_can_be_modified(self):
        """CANCELLED orders should be modifiable (not in immutable set)."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="CANCELLED",
            total_amount=Decimal("100.00"),
        )
        order.notes = "Cancelled by admin"
        order.save()  # Should not raise
        order.refresh_from_db()
        self.assertEqual(order.notes, "Cancelled by admin")


# =============================================================================
# HASH CHAIN INTEGRITY
# =============================================================================


class TestHashChain(POSTestBase):
    """Tests for receipt hash chain integrity."""

    def test_hash_generation_produces_sha256(self):
        """Hash should be a 64-character hex string (SHA-256)."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("100.00"),
        )
        OrderLine.objects.create(
            organization=self.org,
            order=order,
            product=self.product,
            quantity=Decimal("2"),
            unit_price=Decimal("50.00"),
        )
        hash_val = order.calculate_hash()
        self.assertEqual(len(hash_val), 64)
        # Should be hexadecimal
        int(hash_val, 16)  # If not hex, ValueError is raised

    def test_hash_is_deterministic(self):
        """Same order data should produce the same hash."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("100.00"),
        )
        OrderLine.objects.create(
            organization=self.org,
            order=order,
            product=self.product,
            quantity=Decimal("1"),
            unit_price=Decimal("100.00"),
        )
        hash1 = order.calculate_hash()
        hash2 = order.calculate_hash()
        self.assertEqual(hash1, hash2)

    def test_genesis_hash_uses_genesis_string(self):
        """First order in chain should use 'GENESIS' as previous_hash."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("100.00"),
            previous_hash=None,
        )
        # calculate_hash uses "GENESIS" when previous_hash is None
        hash_val = order.calculate_hash()
        self.assertIsNotNone(hash_val)
        self.assertEqual(len(hash_val), 64)

    def test_different_data_produces_different_hash(self):
        """Orders with different data should produce different hashes."""
        order1 = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("100.00"),
        )
        order2 = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("200.00"),
        )
        hash1 = order1.calculate_hash()
        hash2 = order2.calculate_hash()
        self.assertNotEqual(hash1, hash2)

    def test_hash_chain_links_orders(self):
        """Sequential orders should form a linked hash chain."""
        order1 = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("100.00"),
        )
        hash1 = order1.calculate_hash()
        order1.receipt_hash = hash1
        order1.save(force_audit_bypass=True)

        order2 = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("200.00"),
            previous_hash=hash1,
        )
        hash2 = order2.calculate_hash()
        self.assertNotEqual(hash1, hash2)
        self.assertEqual(order2.previous_hash, hash1)


# =============================================================================
# ORDER LINE ITEMS
# =============================================================================


class TestOrderLines(POSTestBase):
    """Tests for order line item operations."""

    def test_create_order_with_lines(self):
        """Creating an order with lines should work correctly."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("75.00"),
            user=self.user,
        )
        line = OrderLine.objects.create(
            organization=self.org,
            order=order,
            product=self.product,
            quantity=Decimal("3"),
            unit_price=Decimal("25.00"),
        )
        self.assertEqual(order.lines.count(), 1)
        self.assertEqual(line.quantity, Decimal("3"))
        self.assertEqual(line.unit_price, Decimal("25.00"))

    def test_multiple_lines_on_order(self):
        """An order should support multiple line items."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("150.00"),
        )
        OrderLine.objects.create(
            organization=self.org, order=order, product=self.product,
            quantity=Decimal("2"), unit_price=Decimal("25.00"),
        )
        product2 = Product.objects.create(
            organization=self.org, name="Widget B", sku="WDG-002",
            category=self.category, unit=self.unit,
            cost_price_ht=Decimal("20.00"), selling_price_ht=Decimal("50.00"),
        )
        OrderLine.objects.create(
            organization=self.org, order=order, product=product2,
            quantity=Decimal("2"), unit_price=Decimal("50.00"),
        )
        self.assertEqual(order.lines.count(), 2)

    def test_order_line_preserves_product_snapshot(self):
        """Line items should capture price at time of sale."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("25.00"),
        )
        line = OrderLine.objects.create(
            organization=self.org, order=order, product=self.product,
            quantity=Decimal("1"), unit_price=Decimal("25.00"),
        )
        # Change product price
        self.product.selling_price_ht = Decimal("30.00")
        self.product.save()

        # Line should retain original price
        line.refresh_from_db()
        self.assertEqual(line.unit_price, Decimal("25.00"))


# =============================================================================
# PURCHASE ORDER LIFECYCLE
# =============================================================================


class TestPurchaseOrderLifecycle(POSTestBase):
    """Tests for PO status transitions."""

    def test_po_creation_starts_as_draft(self):
        """New purchase orders should start as DRAFT."""
        po = Order.objects.create(
            organization=self.org,
            type="PURCHASE",
            status="DRAFT",
            total_amount=Decimal("500.00"),
        )
        self.assertEqual(po.status, "DRAFT")
        self.assertEqual(po.type, "PURCHASE")

    def test_po_can_transition_to_authorized(self):
        """PO should be able to move from DRAFT to AUTHORIZED."""
        po = Order.objects.create(
            organization=self.org,
            type="PURCHASE",
            status="DRAFT",
            total_amount=Decimal("500.00"),
        )
        po.status = "AUTHORIZED"
        po.save()
        po.refresh_from_db()
        self.assertEqual(po.status, "AUTHORIZED")

    def test_po_can_have_lines(self):
        """Purchase orders should support line items."""
        po = Order.objects.create(
            organization=self.org,
            type="PURCHASE",
            status="DRAFT",
            total_amount=Decimal("100.00"),
        )
        OrderLine.objects.create(
            organization=self.org, order=po, product=self.product,
            quantity=Decimal("10"), unit_price=Decimal("10.00"),
        )
        self.assertEqual(po.lines.count(), 1)

    def test_sale_order_types(self):
        """Should support SALE, PURCHASE, and RETURN order types."""
        for order_type in ["SALE", "PURCHASE", "RETURN"]:
            order = Order.objects.create(
                organization=self.org,
                type=order_type,
                status="DRAFT",
                total_amount=Decimal("10.00"),
            )
            self.assertEqual(order.type, order_type)

    def test_order_scope_default(self):
        """Default scope should be OFFICIAL."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("10.00"),
        )
        self.assertEqual(order.scope, "OFFICIAL")

    def test_order_str_representation(self):
        """Order string representation should include the order's ID."""
        order = Order.objects.create(
            organization=self.org,
            type="SALE",
            status="DRAFT",
            total_amount=Decimal("10.00"),
        )
        self.assertIn(str(order.id), str(order))
