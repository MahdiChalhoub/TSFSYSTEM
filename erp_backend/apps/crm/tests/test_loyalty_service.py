"""
CRM Module — Loyalty Service Tests
====================================
Tests for the loyalty points system, tier calculation,
point burn/earn, and supplier rating engine.
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

from erp.models import Organization, User, Site
from apps.crm.models import Contact
from apps.crm.loyalty_service import LoyaltyService


class LoyaltyTestBase(TestCase):
    """Shared fixtures for CRM tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="CRM Test Org", slug="crm-test")
        cls.site = Site.objects.create(organization=cls.org, name="HQ", code="HQ")
        cls.user = User.objects.create_user(
            username="crm_admin", password="test123",
            email="crm@test.com", organization=cls.org,
        )


# =============================================================================
# CONTACT MODEL
# =============================================================================


class TestContactModel(LoyaltyTestBase):
    """Tests for CRM Contact model basics."""

    def test_create_customer_contact(self):
        """Can create a CUSTOMER contact with default values."""
        c = Contact.objects.create(
            organization=self.org, name="Jane Doe", type="CUSTOMER",
        )
        self.assertEqual(c.type, "CUSTOMER")
        self.assertEqual(c.loyalty_points, 0)
        self.assertEqual(c.customer_tier, "STANDARD")
        self.assertEqual(c.lifetime_value, Decimal("0.00"))

    def test_create_supplier_contact(self):
        """Can create a SUPPLIER contact with default ratings."""
        c = Contact.objects.create(
            organization=self.org, name="Acme Corp", type="SUPPLIER",
        )
        self.assertEqual(c.type, "SUPPLIER")
        self.assertEqual(c.overall_rating, Decimal("0.0"))
        self.assertEqual(c.supplier_total_orders, 0)

    def test_str_representation(self):
        """Contact __str__ should show name and type."""
        c = Contact.objects.create(
            organization=self.org, name="Test Co", type="LEAD",
        )
        self.assertIn("Test Co", str(c))
        self.assertIn("LEAD", str(c))

    def test_recalculate_analytics_with_orders(self):
        """Analytics should compute average order value correctly."""
        c = Contact.objects.create(
            organization=self.org, name="Buyer", type="CUSTOMER",
            total_orders=4, lifetime_value=Decimal("400.00"),
        )
        c.recalculate_analytics()
        self.assertEqual(c.average_order_value, Decimal("100.00"))

    def test_recalculate_analytics_zero_orders(self):
        """With zero orders, average should be zero."""
        c = Contact.objects.create(
            organization=self.org, name="New", type="CUSTOMER",
        )
        c.recalculate_analytics()
        self.assertEqual(c.average_order_value, Decimal("0.00"))

    def test_recalculate_supplier_rating(self):
        """Supplier overall rating = average of non-zero individual ratings."""
        c = Contact.objects.create(
            organization=self.org, name="Vendor", type="SUPPLIER",
            quality_rating=Decimal("4.0"),
            delivery_rating=Decimal("3.0"),
            pricing_rating=Decimal("5.0"),
            service_rating=Decimal("0.0"),  # Excluded
        )
        c.recalculate_supplier_rating()
        # Average of 4.0, 3.0, 5.0 = 4.0
        self.assertEqual(c.overall_rating, Decimal("4.0"))


# =============================================================================
# LOYALTY ENGINE — EARN
# =============================================================================


class TestLoyaltyEarn(LoyaltyTestBase):
    """Tests for LoyaltyService.earn_points()."""

    def test_earn_points_basic(self):
        """Customer should earn points based on order total."""
        c = Contact.objects.create(
            organization=self.org, name="Loyal", type="CUSTOMER",
        )
        result = LoyaltyService.earn_points(c, Decimal("100.00"))
        # 100 * 0.1 = 10 points
        self.assertEqual(result['points_earned'], 10)
        self.assertEqual(result['new_total'], 10)

    def test_earn_points_updates_lifetime_value(self):
        """Earning points should increase lifetime value."""
        c = Contact.objects.create(
            organization=self.org, name="Spender", type="CUSTOMER",
        )
        LoyaltyService.earn_points(c, Decimal("500.00"))
        c.refresh_from_db()
        self.assertEqual(c.lifetime_value, Decimal("500.00"))
        self.assertEqual(c.total_orders, 1)

    def test_earn_points_updates_purchase_dates(self):
        """First purchase should set first_purchase_date."""
        c = Contact.objects.create(
            organization=self.org, name="First Timer", type="CUSTOMER",
        )
        LoyaltyService.earn_points(c, Decimal("50.00"))
        c.refresh_from_db()
        self.assertIsNotNone(c.first_purchase_date)
        self.assertIsNotNone(c.last_purchase_date)

    def test_earn_points_zero_order_returns_zero(self):
        """Zero order total should earn zero points."""
        c = Contact.objects.create(
            organization=self.org, name="Zero", type="CUSTOMER",
        )
        result = LoyaltyService.earn_points(c, Decimal("0.00"))
        self.assertEqual(result['points_earned'], 0)

    def test_earn_accumulates_across_orders(self):
        """Multiple orders should accumulate points."""
        c = Contact.objects.create(
            organization=self.org, name="Repeat", type="CUSTOMER",
        )
        LoyaltyService.earn_points(c, Decimal("200.00"))
        LoyaltyService.earn_points(c, Decimal("300.00"))
        c.refresh_from_db()
        # 200*0.1 + 300*0.1 = 20 + 30 = 50
        self.assertEqual(c.loyalty_points, 50)
        self.assertEqual(c.total_orders, 2)


# =============================================================================
# LOYALTY ENGINE — BURN
# =============================================================================


class TestLoyaltyBurn(LoyaltyTestBase):
    """Tests for LoyaltyService.burn_points()."""

    def test_burn_points_basic(self):
        """Customer should be able to redeem points for a discount."""
        c = Contact.objects.create(
            organization=self.org, name="Burner", type="CUSTOMER",
            loyalty_points=500,
        )
        result = LoyaltyService.burn_points(c, 200)
        # 200 * 0.01 = 2.0 discount
        self.assertEqual(result['discount_amount'], 2.0)
        self.assertEqual(result['remaining_points'], 300)

    def test_burn_insufficient_points_returns_error(self):
        """Cannot burn more points than available."""
        c = Contact.objects.create(
            organization=self.org, name="Broke", type="CUSTOMER",
            loyalty_points=50,
        )
        result = LoyaltyService.burn_points(c, 100)
        self.assertIn('error', result)

    def test_burn_zero_points_returns_zero_discount(self):
        """Burning zero points should return zero discount."""
        c = Contact.objects.create(
            organization=self.org, name="Zero Burn", type="CUSTOMER",
            loyalty_points=100,
        )
        result = LoyaltyService.burn_points(c, 0)
        self.assertEqual(result['discount_amount'], Decimal("0.00"))

    def test_burn_deducts_from_database(self):
        """Points should be deducted in the database."""
        c = Contact.objects.create(
            organization=self.org, name="DB Check", type="CUSTOMER",
            loyalty_points=1000,
        )
        LoyaltyService.burn_points(c, 400)
        c.refresh_from_db()
        self.assertEqual(c.loyalty_points, 600)


# =============================================================================
# TIER CALCULATION
# =============================================================================


class TestTierCalculation(LoyaltyTestBase):
    """Tests for LoyaltyService.calculate_tier()."""

    def test_standard_tier(self):
        """Lifetime value < 5000 = STANDARD."""
        self.assertEqual(LoyaltyService.calculate_tier(Decimal("0")), "STANDARD")
        self.assertEqual(LoyaltyService.calculate_tier(Decimal("4999")), "STANDARD")

    def test_vip_tier(self):
        """Lifetime value >= 5000 = VIP."""
        self.assertEqual(LoyaltyService.calculate_tier(Decimal("5000")), "VIP")
        self.assertEqual(LoyaltyService.calculate_tier(Decimal("49999")), "VIP")

    def test_wholesale_tier(self):
        """Lifetime value >= 50000 = WHOLESALE."""
        self.assertEqual(LoyaltyService.calculate_tier(Decimal("50000")), "WHOLESALE")
        self.assertEqual(LoyaltyService.calculate_tier(Decimal("999999")), "WHOLESALE")

    def test_auto_tier_upgrade(self):
        """Spending enough should auto-upgrade tier."""
        c = Contact.objects.create(
            organization=self.org, name="Upgrader", type="CUSTOMER",
        )
        # Spend 5000 (50 orders of 100)
        for _ in range(50):
            LoyaltyService.earn_points(c, Decimal("100.00"))
        c.refresh_from_db()
        self.assertEqual(c.customer_tier, "VIP")


# =============================================================================
# SUPPLIER RATING
# =============================================================================


class TestSupplierRating(LoyaltyTestBase):
    """Tests for LoyaltyService.rate_supplier()."""

    def test_rate_supplier_first_time(self):
        """First rating should set all provided scores."""
        s = Contact.objects.create(
            organization=self.org, name="Vendor A", type="SUPPLIER",
        )
        result = LoyaltyService.rate_supplier(s, quality=4, delivery=3)
        self.assertGreater(result['overall_rating'], 0)
        self.assertEqual(result['total_ratings'], 1)

    def test_rate_supplier_running_average(self):
        """Multiple ratings should compute running average."""
        s = Contact.objects.create(
            organization=self.org, name="Vendor B", type="SUPPLIER",
        )
        LoyaltyService.rate_supplier(s, quality=5)
        LoyaltyService.rate_supplier(s, quality=3)
        s.refresh_from_db()
        # Running avg: (5 + 3) / 2 = 4.0
        self.assertAlmostEqual(float(s.quality_rating), 4.0, places=1)


# =============================================================================
# SUPPLIER DELIVERY TRACKING
# =============================================================================


class TestSupplierDelivery(LoyaltyTestBase):
    """Tests for LoyaltyService.record_delivery()."""

    def test_record_on_time_delivery(self):
        """On-time delivery should increment counter."""
        s = Contact.objects.create(
            organization=self.org, name="On Time Ltd", type="SUPPLIER",
        )
        LoyaltyService.record_delivery(s, on_time=True, lead_time_days=5)
        s.refresh_from_db()
        self.assertEqual(s.supplier_total_orders, 1)
        self.assertEqual(s.on_time_deliveries, 1)
        self.assertEqual(s.late_deliveries, 0)

    def test_record_late_delivery(self):
        """Late delivery should increment late counter."""
        s = Contact.objects.create(
            organization=self.org, name="Late Ltd", type="SUPPLIER",
        )
        LoyaltyService.record_delivery(s, on_time=False)
        s.refresh_from_db()
        self.assertEqual(s.late_deliveries, 1)

    def test_lead_time_running_average(self):
        """Lead time should be running average."""
        s = Contact.objects.create(
            organization=self.org, name="Avg Ltd", type="SUPPLIER",
        )
        LoyaltyService.record_delivery(s, on_time=True, lead_time_days=10)
        LoyaltyService.record_delivery(s, on_time=True, lead_time_days=6)
        s.refresh_from_db()
        # Avg of 10 and 6 = 8.0
        self.assertAlmostEqual(float(s.avg_lead_time_days), 8.0, places=1)


# =============================================================================
# SUPPLIER SCORECARD
# =============================================================================


class TestSupplierScorecard(LoyaltyTestBase):
    """Tests for LoyaltyService.get_supplier_scorecard()."""

    def test_scorecard_returns_expected_keys(self):
        """Scorecard should contain all performance metrics."""
        s = Contact.objects.create(
            organization=self.org, name="Score Ltd", type="SUPPLIER",
        )
        LoyaltyService.record_delivery(s, on_time=True, lead_time_days=5)
        LoyaltyService.rate_supplier(s, quality=4, delivery=5)
        scorecard = LoyaltyService.get_supplier_scorecard(s)
        expected_keys = [
            'name', 'overall_rating', 'quality_rating', 'delivery_rating',
            'total_orders', 'on_time_pct', 'avg_lead_time_days',
        ]
        for key in expected_keys:
            self.assertIn(key, scorecard)

    def test_scorecard_on_time_percentage(self):
        """On-time percentage should be accurate."""
        s = Contact.objects.create(
            organization=self.org, name="Pct Ltd", type="SUPPLIER",
        )
        LoyaltyService.record_delivery(s, on_time=True)
        LoyaltyService.record_delivery(s, on_time=True)
        LoyaltyService.record_delivery(s, on_time=False)
        scorecard = LoyaltyService.get_supplier_scorecard(s)
        # 2/3 = 66.7%
        self.assertAlmostEqual(scorecard['on_time_pct'], 66.7, places=1)
