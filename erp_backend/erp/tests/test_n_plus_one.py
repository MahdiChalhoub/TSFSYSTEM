"""
N+1 Query Detection Tests

These tests ensure that critical API endpoints don't have N+1 query problems.
They verify that select_related() and prefetch_related() are used correctly.

Usage:
    python manage.py test erp.tests.test_n_plus_one
"""

from django.test import TestCase, override_settings
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.contrib.auth import get_user_model

User = get_user_model()


@override_settings(DEBUG=True)  # Required for query capture
class NPlusOneDetectionTest(TestCase):
    """
    Test suite to detect N+1 query problems in critical endpoints.

    Each test:
    1. Creates test data (multiple related objects)
    2. Makes API request
    3. Asserts query count stays below threshold
    """

    def setUp(self):
        """Create test user and authenticate."""
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.login(username='testuser', password='testpass123')

    def test_inventory_product_list_no_n_plus_one(self):
        """
        Inventory product list should use select_related for warehouse, category.

        Expected queries:
        1. Session lookup
        2. User lookup
        3. Products query with select_related('warehouse', 'category')
        Total: ~3-5 queries regardless of product count
        """
        from apps.inventory.models import Product, Warehouse, Category
        from apps.core.models import Organization

        # Create organization
        org = Organization.objects.create(name='Test Org', slug='test')

        # Create warehouse and category
        warehouse = Warehouse.objects.create(
            organization=org,
            name='Main Warehouse',
            code='WH01'
        )
        category = Category.objects.create(
            organization=org,
            name='Electronics'
        )

        # Create 20 products (to detect N+1)
        for i in range(20):
            Product.objects.create(
                organization=org,
                sku=f'SKU{i:03d}',
                name=f'Product {i}',
                warehouse=warehouse,
                category=category
            )

        # Make API request and count queries
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/inventory/products/')

            # Should be less than 10 queries regardless of product count
            # If N+1 exists, it would be 20+ queries (one per product)
            self.assertLess(
                len(ctx),
                10,
                f"N+1 detected! Queries: {len(ctx)}\nQueries:\n" +
                "\n".join([q['sql'] for q in ctx.captured_queries])
            )

    def test_finance_invoice_list_no_n_plus_one(self):
        """
        Invoice list should prefetch customer, journal_entry, lines.

        Expected queries:
        - Main invoice query
        - Prefetch customers
        - Prefetch journal entries
        - Prefetch invoice lines
        Total: ~5-7 queries regardless of invoice count
        """
        # Skip if finance app not installed
        try:
            from apps.finance.models import Invoice
        except ImportError:
            self.skipTest("Finance app not installed")

        # TODO: Create test invoices and verify query count
        pass

    def test_crm_contact_list_no_n_plus_one(self):
        """
        Contact list should prefetch related opportunities, activities.

        Expected queries: < 10 regardless of contact count
        """
        # Skip if CRM app not installed
        try:
            from apps.crm.models import Contact
        except ImportError:
            self.skipTest("CRM app not installed")

        # TODO: Create test contacts and verify query count
        pass

    def test_pos_order_detail_no_n_plus_one(self):
        """
        POS order detail should prefetch lines with products.

        Expected queries: < 5 for retrieving single order with lines
        """
        # Skip if POS app not installed
        try:
            from apps.pos.models import POSOrder
        except ImportError:
            self.skipTest("POS app not installed")

        # TODO: Create test order with multiple lines
        pass

    def test_workspace_project_list_no_n_plus_one(self):
        """
        Project list should prefetch tasks, team members.

        Expected queries: < 8 regardless of project count
        """
        # Skip if workspace app not installed
        try:
            from apps.workspace.models import Project
        except ImportError:
            self.skipTest("Workspace app not installed")

        # TODO: Create test projects and verify query count
        pass


class QueryOptimizationHelperTest(TestCase):
    """
    Tests for query optimization helpers and utilities.
    """

    def test_detect_n_plus_one_in_serializer(self):
        """
        Helper test to detect N+1 in serializers during development.

        Usage: Run this test when adding new serializers to verify
        they don't introduce N+1 queries.
        """
        # This is a template test - implement specific serializer tests
        pass

    def test_database_indexes_exist(self):
        """
        Verify that foreign keys have indexes.

        PostgreSQL auto-creates indexes on ForeignKey fields,
        but this test documents which indexes are critical.
        """
        from django.db import connection

        with connection.cursor() as cursor:
            # Check for indexes on critical tables
            cursor.execute("""
                SELECT tablename, indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                AND tablename IN ('inventory_product', 'finance_invoice', 'crm_contact')
                ORDER BY tablename, indexname;
            """)

            indexes = cursor.fetchall()
            # Just verify we have some indexes
            self.assertGreater(len(indexes), 0, "No indexes found on critical tables")


# Helper function for debugging N+1 queries during development
def print_queries(queries):
    """
    Pretty-print captured queries for debugging.

    Usage:
        with CaptureQueriesContext(connection) as ctx:
            # ... make request
            print_queries(ctx.captured_queries)
    """
    for i, query in enumerate(queries, 1):
        print(f"\n--- Query {i} ({query['time']}s) ---")
        print(query['sql'])
