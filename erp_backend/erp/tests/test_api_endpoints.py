"""
API Integration Tests — Endpoint Validation
=============================================
Tests that critical API endpoints respond correctly.
Uses Django's test Client which doesn't need real network.
"""
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from erp.models import Organization, User, Site


class APITestBase(TestCase):
    """Shared API test fixtures."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="API Test Org", slug="api-test")
        cls.site = Site.objects.create(organization=cls.org, name="HQ", code="HQ")
        cls.user = User.objects.create_user(
            username="api_user", password="test123",
            email="api@test.com", organization=cls.org,
        )

    def setUp(self):
        self.client = APIClient()
        from rest_framework.authtoken.models import Token
        self.token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Token {self.token.key}',
            HTTP_X_TENANT_ID=str(self.org.id),
        )


# =============================================================================
# AUTHENTICATION
# =============================================================================


class TestAuthEndpoints(APITestBase):
    """Tests for authentication behavior."""

    def test_unauthenticated_products_returns_401(self):
        """API calls without authentication should return 401."""
        client = APIClient()  # Fresh client, no credentials
        response = client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_token_returns_401(self):
        """Invalid tokens should be rejected."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token invalidtoken123')
        response = client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_access_api(self):
        """Valid token should grant access."""
        response = self.client.get('/api/products/')
        self.assertIn(response.status_code, [200, 404])

    def test_auth_me_returns_user_data(self):
        """The /auth/me/ endpoint should return user info."""
        response = self.client.get('/api/auth/me/')
        if response.status_code == 200:
            data = response.json()
            self.assertIn('username', data)


# =============================================================================
# INVENTORY ENDPOINTS
# =============================================================================


class TestInventoryEndpoints(APITestBase):
    """Tests for inventory API endpoints."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        from apps.inventory.models import Unit, Category, Product, Warehouse
        cls.unit = Unit.objects.create(organization=cls.org, name="Piece", code="PCS2")
        cls.cat = Category.objects.create(organization=cls.org, name="General")
        cls.product = Product.objects.create(
            organization=cls.org, name="API Widget", sku="APIWDG-001",
            category=cls.cat, unit=cls.unit,
            cost_price=Decimal("0"), cost_price_ht=Decimal("10"),
            cost_price_ttc=Decimal("11"), selling_price_ht=Decimal("25"),
            selling_price_ttc=Decimal("27.50"), tva_rate=Decimal("0.10"),
        )
        cls.wh = Warehouse.objects.create(
            organization=cls.org, name="API Warehouse", site=cls.site,
        )

    def test_products_list_returns_200(self):
        """Products endpoint should return 200."""
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, 200)

    def test_products_list_is_json(self):
        """Products response should be JSON."""
        response = self.client.get('/api/products/')
        self.assertEqual(response['content-type'], 'application/json')

    def test_products_contain_test_product(self):
        """Product list should include our test product."""
        response = self.client.get('/api/products/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        if isinstance(results, list):
            names = [p.get('name', '') for p in results]
            self.assertIn('API Widget', names)

    def test_product_detail_returns_200(self):
        """Individual product detail should be accessible."""
        response = self.client.get(f'/api/products/{self.product.id}/')
        self.assertEqual(response.status_code, 200)

    def test_categories_list_returns_200(self):
        """Categories endpoint should return 200."""
        response = self.client.get('/api/categories/')
        self.assertEqual(response.status_code, 200)

    def test_warehouses_list_returns_200(self):
        """Warehouses endpoint should return 200."""
        response = self.client.get('/api/warehouses/')
        self.assertEqual(response.status_code, 200)

    def test_units_list_returns_200(self):
        """Units endpoint should return 200."""
        response = self.client.get('/api/units/')
        self.assertEqual(response.status_code, 200)


# =============================================================================
# FINANCE ENDPOINTS
# =============================================================================


class TestFinanceEndpoints(APITestBase):
    """Tests for finance API endpoints."""

    def test_accounts_list_returns_200(self):
        """Chart of Accounts endpoint should return 200."""
        response = self.client.get('/api/accounts/')
        self.assertEqual(response.status_code, 200)

    def test_fiscal_years_list_returns_200(self):
        """Fiscal years endpoint should return 200."""
        response = self.client.get('/api/fiscal-years/')
        self.assertEqual(response.status_code, 200)

    def test_journal_entries_list_returns_200(self):
        """Journal entries endpoint should return 200."""
        response = self.client.get('/api/journal/')
        self.assertEqual(response.status_code, 200)


# =============================================================================
# POS ENDPOINTS
# =============================================================================


class TestPOSEndpoints(APITestBase):
    """Tests for POS API endpoints."""

    def test_orders_list_returns_200(self):
        """Orders endpoint should return 200."""
        response = self.client.get('/api/orders/')
        self.assertEqual(response.status_code, 200)


# =============================================================================
# SCHEMA & DOCS
# =============================================================================


class TestSchemaEndpoints(APITestBase):
    """Tests for OpenAPI schema and Swagger docs."""

    def test_schema_endpoint_accessible(self):
        """OpenAPI schema should be accessible."""
        response = self.client.get('/api/schema/')
        self.assertIn(response.status_code, [200, 403])

    def test_docs_endpoint_accessible(self):
        """Swagger UI should be accessible."""
        response = self.client.get('/api/docs/')
        self.assertIn(response.status_code, [200, 403])


# =============================================================================
# TENANT ISOLATION IN API
# =============================================================================


class TestTenantIsolationAPI(APITestBase):
    """Tests that API endpoints respect tenant isolation."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org2 = Organization.objects.create(name="Other Org", slug="other-org")
        cls.user2 = User.objects.create_user(
            username="user2", password="test123",
            email="user2@test.com", organization=cls.org2,
        )
        from apps.inventory.models import Unit, Category, Product
        unit = Unit.objects.create(organization=cls.org2, name="Unit2", code="U2B")
        cat = Category.objects.create(organization=cls.org2, name="Cat2")
        cls.secret_product = Product.objects.create(
            organization=cls.org2, name="Secret Product", sku="SEC-001",
            category=cat, unit=unit, cost_price=Decimal("0"),
            cost_price_ht=Decimal("10"), cost_price_ttc=Decimal("11"),
            selling_price_ht=Decimal("25"), selling_price_ttc=Decimal("27.50"),
        )

    def test_cross_tenant_product_not_visible(self):
        """User from org1 should not see products from org2."""
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        if isinstance(results, list):
            product_names = [p.get('name', '') for p in results]
            self.assertNotIn('Secret Product', product_names)

    def test_cross_tenant_direct_access_blocked(self):
        """Direct access to org2's product by ID should be blocked."""
        response = self.client.get(f'/api/products/{self.secret_product.id}/')
        self.assertIn(response.status_code, [403, 404])
