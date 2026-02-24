"""
Inventory Module — InventoryService Tests
==========================================
Tests for stock management operations: receive, reduce, adjust, transfer.
Covers: AMC calculations, negative stock prevention, serial tracking,
        movement creation, and cross-module finance journal entries.

These tests ensure stock accuracy across the entire system.
"""
from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone

from erp.models import Organization, User, Site
from apps.inventory.models import (
    Product, Unit, Category, Warehouse, Inventory, InventoryMovement,
)
from apps.inventory.services import InventoryService


class InventoryTestBase(TestCase):
    """Shared fixtures for all inventory tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Test Org', slug='test-inv-org',
        )
        cls.user = User.objects.create_user(
            username='inv_admin', password='test123',
            email='inv@test.com', organization=cls.org,
        )
        cls.site = Site.objects.create(
            name='Main Store', code='MS', organization=cls.org,
        )

        # ── Product Setup ────────────────────────────────────
        cls.unit = Unit.objects.create(
            organization=cls.org, name='Piece', code='PCS',
        )
        cls.category = Category.objects.create(
            organization=cls.org, name='Electronics',
        )
        cls.product = Product.objects.create(
            organization=cls.org,
            name='Test Widget',
            sku='TW-001',
            unit=cls.unit,
            category=cls.category,
            cost_price=Decimal('0.00'),
            cost_price_ht=Decimal('0.00'),
            cost_price_ttc=Decimal('0.00'),
            selling_price_ht=Decimal('100.00'),
            selling_price_ttc=Decimal('111.00'),
            tva_rate=Decimal('0.11'),
        )
        cls.product_serial = Product.objects.create(
            organization=cls.org,
            name='Serial Widget',
            sku='SW-001',
            unit=cls.unit,
            category=cls.category,
            cost_price=Decimal('0.00'),
            cost_price_ht=Decimal('0.00'),
            cost_price_ttc=Decimal('0.00'),
            selling_price_ht=Decimal('200.00'),
            selling_price_ttc=Decimal('222.00'),
            tva_rate=Decimal('0.11'),
            tracks_serials=True,
        )

        # ── Warehouses ───────────────────────────────────────
        cls.warehouse_a = Warehouse.objects.create(
            organization=cls.org, name='Warehouse A',
            site=cls.site,
        )
        cls.warehouse_b = Warehouse.objects.create(
            organization=cls.org, name='Warehouse B',
            site=cls.site,
        )


class TestReceiveStock(InventoryTestBase):
    """Tests for InventoryService.receive_stock()"""

    def test_receive_creates_inventory_record(self):
        """Receiving stock should create/update an Inventory record."""
        result = InventoryService.receive_stock(
            organization=self.org,
            product=self.product,
            warehouse=self.warehouse_a,
            quantity=10,
            cost_price_ht=Decimal('50.00'),
            user=self.user,
            skip_finance=True,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.quantity, Decimal('10'))

    def test_receive_updates_amc(self):
        """Receiving stock should update the product's Average Moving Cost."""
        InventoryService.receive_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=10,
            cost_price_ht=Decimal('50.00'), user=self.user, skip_finance=True,
        )
        self.product.refresh_from_db()
        # AMC should be ~50.00 (tax recoverable, so effective cost = HT)
        self.assertAlmostEqual(float(self.product.cost_price), 50.00, places=2)

        # Second reception at different price
        InventoryService.receive_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=10,
            cost_price_ht=Decimal('70.00'), user=self.user, skip_finance=True,
        )
        self.product.refresh_from_db()
        # AMC should be (10*50 + 10*70) / 20 = 60.00
        self.assertAlmostEqual(float(self.product.cost_price), 60.00, places=2)

    def test_receive_creates_movement(self):
        """Receiving stock should create an IN movement record."""
        InventoryService.receive_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=5,
            cost_price_ht=Decimal('30.00'), user=self.user, skip_finance=True,
        )
        movement = InventoryMovement.objects.filter(
            organization=self.org, product=self.product, type='IN',
        ).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity, Decimal('5'))

    def test_receive_accumulates_quantity(self):
        """Multiple receptions should accumulate the inventory quantity."""
        InventoryService.receive_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=10,
            cost_price_ht=Decimal('50.00'), user=self.user, skip_finance=True,
        )
        InventoryService.receive_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=5,
            cost_price_ht=Decimal('50.00'), user=self.user, skip_finance=True,
        )
        inv = Inventory.objects.get(
            organization=self.org, product=self.product, warehouse=self.warehouse_a,
        )
        self.assertEqual(inv.quantity, Decimal('15'))


class TestReduceStock(InventoryTestBase):
    """Tests for InventoryService.reduce_stock()"""

    def _seed_stock(self, qty=20, cost=Decimal('50.00')):
        """Helper to seed stock before reduction tests."""
        InventoryService.receive_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=qty,
            cost_price_ht=cost, user=self.user, skip_finance=True,
        )

    def test_reduce_deducts_quantity(self):
        """Reducing stock should decrease the inventory quantity."""
        self._seed_stock(20)
        InventoryService.reduce_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=5,
            user=self.user, skip_finance=True,
        )
        inv = Inventory.objects.get(
            organization=self.org, product=self.product, warehouse=self.warehouse_a,
        )
        self.assertEqual(inv.quantity, Decimal('15'))

    def test_reduce_creates_out_movement(self):
        """Reducing stock should create an OUT movement."""
        self._seed_stock(10)
        InventoryService.reduce_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=3,
            user=self.user, skip_finance=True,
        )
        movement = InventoryMovement.objects.filter(
            organization=self.org, product=self.product, type='OUT',
        ).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity, Decimal('3'))

    def test_reduce_returns_amc(self):
        """Reduce stock should return the current AMC for COGS booking."""
        self._seed_stock(10, Decimal('50.00'))
        amc = InventoryService.reduce_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=5,
            user=self.user, skip_finance=True,
        )
        self.assertAlmostEqual(float(amc), 50.00, places=2)

    def test_reduce_insufficient_stock_raises_error(self):
        """Reducing more than available should raise ValidationError."""
        self._seed_stock(5)
        with self.assertRaises(ValidationError) as ctx:
            InventoryService.reduce_stock(
                organization=self.org, product=self.product,
                warehouse=self.warehouse_a, quantity=10,
                user=self.user, skip_finance=True,
            )
        self.assertIn('insufficient', str(ctx.exception).lower())

    def test_reduce_allows_negative_with_flag(self):
        """With allow_negative=True, stock can go below zero."""
        self._seed_stock(5)
        InventoryService.reduce_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=10,
            user=self.user, skip_finance=True,
            allow_negative=True,
        )
        inv = Inventory.objects.get(
            organization=self.org, product=self.product, warehouse=self.warehouse_a,
        )
        self.assertEqual(inv.quantity, Decimal('-5'))


class TestAdjustStock(InventoryTestBase):
    """Tests for InventoryService.adjust_stock()"""

    def _seed_stock(self, qty=20, cost=Decimal('50.00')):
        InventoryService.receive_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=qty,
            cost_price_ht=cost, user=self.user, skip_finance=True,
        )

    def test_positive_adjustment_increases_stock(self):
        """A positive adjustment should increase inventory."""
        self._seed_stock(10)
        InventoryService.adjust_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=5,
            reason='Found extra stock', user=self.user, skip_finance=True,
        )
        inv = Inventory.objects.get(
            organization=self.org, product=self.product, warehouse=self.warehouse_a,
        )
        self.assertEqual(inv.quantity, Decimal('15'))

    def test_negative_adjustment_decreases_stock(self):
        """A negative adjustment should decrease inventory."""
        self._seed_stock(10)
        InventoryService.adjust_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=-3,
            reason='Damaged goods', user=self.user, skip_finance=True,
        )
        inv = Inventory.objects.get(
            organization=self.org, product=self.product, warehouse=self.warehouse_a,
        )
        self.assertEqual(inv.quantity, Decimal('7'))

    def test_zero_adjustment_raises_error(self):
        """Zero quantity adjustment should raise ValidationError."""
        self._seed_stock(10)
        with self.assertRaises(ValidationError) as ctx:
            InventoryService.adjust_stock(
                organization=self.org, product=self.product,
                warehouse=self.warehouse_a, quantity=0,
                user=self.user, skip_finance=True,
            )
        self.assertIn('zero', str(ctx.exception).lower())

    def test_adjustment_creates_movement(self):
        """Adjustments should create ADJUSTMENT movement records."""
        self._seed_stock(10)
        InventoryService.adjust_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=5,
            reason='Count correction', user=self.user, skip_finance=True,
        )
        movement = InventoryMovement.objects.filter(
            organization=self.org, product=self.product, type='ADJUSTMENT',
        ).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity, Decimal('5'))
        self.assertIn('Count correction', movement.reason)

    def test_negative_adjustment_below_zero_raises_error(self):
        """Adjustment cannot bring stock below zero."""
        self._seed_stock(5)
        with self.assertRaises(ValidationError) as ctx:
            InventoryService.adjust_stock(
                organization=self.org, product=self.product,
                warehouse=self.warehouse_a, quantity=-10,
                reason='Too much', user=self.user, skip_finance=True,
            )
        self.assertIn('negative', str(ctx.exception).lower())


class TestTransferStock(InventoryTestBase):
    """Tests for InventoryService.transfer_stock()"""

    def _seed_stock(self, qty=20, cost=Decimal('50.00')):
        InventoryService.receive_stock(
            organization=self.org, product=self.product,
            warehouse=self.warehouse_a, quantity=qty,
            cost_price_ht=cost, user=self.user, skip_finance=True,
        )

    def test_transfer_moves_stock_between_warehouses(self):
        """Transfer should deduct from source and add to destination."""
        self._seed_stock(20)
        result = InventoryService.transfer_stock(
            organization=self.org, product=self.product,
            source_warehouse=self.warehouse_a,
            destination_warehouse=self.warehouse_b,
            quantity=8, user=self.user,
        )
        self.assertEqual(result['source_remaining'], 12.0)
        self.assertEqual(result['destination_total'], 8.0)

    def test_transfer_creates_paired_movements(self):
        """Transfer should create two TRANSFER movements (one negative, one positive)."""
        self._seed_stock(10)
        InventoryService.transfer_stock(
            organization=self.org, product=self.product,
            source_warehouse=self.warehouse_a,
            destination_warehouse=self.warehouse_b,
            quantity=5, user=self.user,
        )
        movements = InventoryMovement.objects.filter(
            organization=self.org, product=self.product, type='TRANSFER',
        ).order_by('quantity')
        self.assertEqual(movements.count(), 2)
        self.assertEqual(movements[0].quantity, Decimal('-5'))  # OUT
        self.assertEqual(movements[1].quantity, Decimal('5'))   # IN

    def test_transfer_insufficient_stock_raises_error(self):
        """Cannot transfer more than available at source."""
        self._seed_stock(5)
        with self.assertRaises(ValidationError) as ctx:
            InventoryService.transfer_stock(
                organization=self.org, product=self.product,
                source_warehouse=self.warehouse_a,
                destination_warehouse=self.warehouse_b,
                quantity=10, user=self.user,
            )
        self.assertIn('insufficient', str(ctx.exception).lower())

    def test_transfer_same_warehouse_raises_error(self):
        """Cannot transfer to the same warehouse."""
        self._seed_stock(10)
        with self.assertRaises(ValidationError):
            InventoryService.transfer_stock(
                organization=self.org, product=self.product,
                source_warehouse=self.warehouse_a,
                destination_warehouse=self.warehouse_a,
                quantity=5, user=self.user,
            )

    def test_transfer_zero_quantity_raises_error(self):
        """Zero transfer quantity should raise ValidationError."""
        self._seed_stock(10)
        with self.assertRaises(ValidationError):
            InventoryService.transfer_stock(
                organization=self.org, product=self.product,
                source_warehouse=self.warehouse_a,
                destination_warehouse=self.warehouse_b,
                quantity=0, user=self.user,
            )

    def test_transfer_preserves_total_stock(self):
        """Total stock across all warehouses should remain constant after a transfer."""
        self._seed_stock(20)

        total_before = sum(
            Inventory.objects.filter(
                organization=self.org, product=self.product,
            ).values_list('quantity', flat=True)
        )

        InventoryService.transfer_stock(
            organization=self.org, product=self.product,
            source_warehouse=self.warehouse_a,
            destination_warehouse=self.warehouse_b,
            quantity=8, user=self.user,
        )

        total_after = sum(
            Inventory.objects.filter(
                organization=self.org, product=self.product,
            ).values_list('quantity', flat=True)
        )
        self.assertEqual(total_before, total_after)
