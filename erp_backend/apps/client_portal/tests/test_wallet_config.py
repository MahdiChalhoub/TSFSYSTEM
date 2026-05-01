"""
Client Portal — Wallet & Config Tests
=======================================
Tests for digital wallet operations, portal configuration,
delivery fee calculation, and loyalty integration.
"""
from decimal import Decimal
from django.test import TestCase
from erp.models import Organization, User, Site
# Pattern D: test-fixture import at module-collection time pre-empts the connector
# (no org context yet, OrganizationModule check would mark crm DISABLED).
from apps.crm.models import Contact  # noqa: E402  (Pattern D: test fixture)
from apps.client_portal.models import (
    ClientPortalConfig, ClientPortalAccess,
    ClientWallet, WalletTransaction,
)


class PortalTestBase(TestCase):
    """Shared fixtures for client portal tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="Portal Org", slug="portal-test")
        cls.site = Site.objects.create(organization=cls.org, name="HQ", code="HQ")
        cls.user = User.objects.create_user(
            username="portal_user", password="test123",
            email="portal@test.com", organization=cls.org,
        )
        cls.customer = Contact.objects.create(
            organization=cls.org, name="Portal Customer", type="CUSTOMER",
        )


# =============================================================================
# PORTAL CONFIG
# =============================================================================


class TestPortalConfig(PortalTestBase):
    """Tests for ClientPortalConfig."""

    def test_get_config_creates_default(self):
        """get_config should auto-create a config for the org."""
        config = ClientPortalConfig.get_config(self.org)
        self.assertIsNotNone(config)
        self.assertEqual(config.organization, self.org)

    def test_get_config_is_idempotent(self):
        """Calling get_config twice returns the same instance."""
        c1 = ClientPortalConfig.get_config(self.org)
        c2 = ClientPortalConfig.get_config(self.org)
        self.assertEqual(c1.pk, c2.pk)

    def test_delivery_fee_below_threshold(self):
        """Orders below threshold should pay delivery fee."""
        config = ClientPortalConfig.get_config(self.org)
        config.default_delivery_fee = Decimal("5.00")
        config.free_delivery_threshold = Decimal("50.00")
        config.save()
        fee = config.get_delivery_fee(Decimal("30.00"))
        self.assertEqual(fee, Decimal("5.00"))

    def test_delivery_fee_above_threshold(self):
        """Orders above threshold should get free delivery."""
        config = ClientPortalConfig.get_config(self.org)
        config.default_delivery_fee = Decimal("5.00")
        config.free_delivery_threshold = Decimal("50.00")
        config.save()
        fee = config.get_delivery_fee(Decimal("50.00"))
        self.assertEqual(fee, Decimal("0.00"))

    def test_delivery_fee_no_threshold(self):
        """With threshold=0, delivery fee always applies."""
        config = ClientPortalConfig.get_config(self.org)
        config.default_delivery_fee = Decimal("10.00")
        config.free_delivery_threshold = Decimal("0.00")
        config.save()
        fee = config.get_delivery_fee(Decimal("999.00"))
        self.assertEqual(fee, Decimal("10.00"))

    def test_points_for_amount(self):
        """Points earned should follow the earn rate."""
        config = ClientPortalConfig.get_config(self.org)
        config.loyalty_earn_rate = Decimal("0.5")  # 1 point per 2 currency units
        config.save()
        points = config.get_points_for_amount(Decimal("100.00"))
        self.assertEqual(points, 50)


# =============================================================================
# CLIENT WALLET
# =============================================================================


class TestClientWallet(PortalTestBase):
    """Tests for digital wallet credit/debit operations."""

    def _create_wallet(self, balance=Decimal("0.00")):
        return ClientWallet.objects.create(
            organization=self.org,
            contact=self.customer,
            balance=balance,
        )

    def test_credit_increases_balance(self):
        """Crediting wallet should increase balance."""
        wallet = self._create_wallet()
        wallet.credit(Decimal("100.00"), reason="Top up")
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("100.00"))

    def test_credit_creates_transaction(self):
        """Credit should create a CREDIT transaction record."""
        wallet = self._create_wallet()
        txn = wallet.credit(Decimal("50.00"), reason="Refund")
        self.assertEqual(txn.transaction_type, "CREDIT")
        self.assertEqual(txn.amount, Decimal("50.00"))
        self.assertEqual(txn.balance_after, Decimal("50.00"))

    def test_debit_decreases_balance(self):
        """Debiting wallet should decrease balance."""
        wallet = self._create_wallet(Decimal("200.00"))
        wallet.debit(Decimal("75.00"), reason="Purchase")
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("125.00"))

    def test_debit_creates_transaction(self):
        """Debit should create a DEBIT transaction record."""
        wallet = self._create_wallet(Decimal("100.00"))
        txn = wallet.debit(Decimal("30.00"), reason="Payment")
        self.assertEqual(txn.transaction_type, "DEBIT")
        self.assertEqual(txn.amount, Decimal("30.00"))

    def test_debit_insufficient_funds_raises(self):
        """Cannot debit more than available balance."""
        wallet = self._create_wallet(Decimal("10.00"))
        with self.assertRaises(ValueError) as ctx:
            wallet.debit(Decimal("50.00"))
        self.assertIn("Insufficient", str(ctx.exception))

    def test_multiple_transactions_maintain_balance(self):
        """Balance should be correct after multiple credit/debit operations."""
        wallet = self._create_wallet()
        wallet.credit(Decimal("100.00"))
        wallet.credit(Decimal("50.00"))
        wallet.debit(Decimal("30.00"))
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("120.00"))

    def test_transaction_audit_trail(self):
        """All transactions should be logged."""
        wallet = self._create_wallet()
        wallet.credit(Decimal("100.00"))
        wallet.debit(Decimal("20.00"))
        wallet.credit(Decimal("50.00"))
        txns = WalletTransaction.objects.filter(wallet=wallet)
        self.assertEqual(txns.count(), 3)

    def test_loyalty_points_credit(self):
        """Adding loyalty points should increment counter."""
        wallet = self._create_wallet()
        wallet.add_loyalty_points(100)
        wallet.refresh_from_db()
        self.assertEqual(wallet.loyalty_points, 100)

    def test_redeem_loyalty_points(self):
        """Redeeming points should deduct points and credit balance."""
        wallet = self._create_wallet()
        wallet.loyalty_points = 500
        wallet.save()
        wallet.redeem_loyalty_points(200, Decimal("2.00"))
        wallet.refresh_from_db()
        self.assertEqual(wallet.loyalty_points, 300)
        self.assertEqual(wallet.balance, Decimal("2.00"))

    def test_redeem_insufficient_points_raises(self):
        """Cannot redeem more points than available."""
        wallet = self._create_wallet()
        wallet.loyalty_points = 50
        wallet.save()
        with self.assertRaises(ValueError):
            wallet.redeem_loyalty_points(100, Decimal("1.00"))


# =============================================================================
# PORTAL ACCESS
# =============================================================================


class TestPortalAccess(PortalTestBase):
    """Tests for ClientPortalAccess model."""

    def test_create_portal_access(self):
        """Can create portal access linking user to contact."""
        access = ClientPortalAccess.objects.create(
            organization=self.org,
            user=self.user,
            contact=self.customer,
        )
        self.assertIsNotNone(access)

    def test_permission_check(self):
        """has_permission should check the permissions list."""
        access = ClientPortalAccess.objects.create(
            organization=self.org,
            user=self.user,
            contact=self.customer,
            permissions=['VIEW_ORDER_HISTORY', 'PLACE_ORDERS'],
        )
        self.assertTrue(access.has_permission('VIEW_ORDER_HISTORY'))
        self.assertTrue(access.has_permission('PLACE_ORDERS'))
        self.assertFalse(access.has_permission('ADMIN'))

    def test_generate_barcode(self):
        """Should generate a unique barcode for POS scanning."""
        access = ClientPortalAccess.objects.create(
            organization=self.org,
            user=self.user,
            contact=self.customer,
        )
        access.generate_barcode()
        access.refresh_from_db()
        self.assertIsNotNone(access.barcode)
        self.assertTrue(len(access.barcode) > 0)
