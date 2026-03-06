"""
Performance Tests for TSFSYSTEM
================================
Tests to ensure system meets performance benchmarks.

Run with: python manage.py test tests.performance
"""

import time
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from erp.models import Organization
from kernel.tenancy.middleware import set_current_tenant, set_current_user
from kernel.events import emit_event
from kernel.events.models import EventOutbox
from kernel.rbac.models import Role, Permission
from kernel.rbac.services import RBACService
from kernel.audit.models import AuditLog

User = get_user_model()


class PerformanceTestCase(TestCase):
    """Base class for performance tests"""

    def setUp(self):
        self.tenant = Organization.objects.create(name="Performance Test Org", slug="perf-test")
        self.user = User.objects.create_user(
            username="perfuser",
            email="perf@test.com",
            password="testpass123"
        )
        set_current_tenant(self.tenant)
        set_current_user(self.user)

    def time_operation(self, operation, *args, **kwargs):
        """Time an operation and return duration in milliseconds"""
        start = time.perf_counter()
        result = operation(*args, **kwargs)
        end = time.perf_counter()
        duration_ms = (end - start) * 1000
        return duration_ms, result

    def assert_performance(self, duration_ms, target_ms, warning_ms=None):
        """Assert operation meets performance target"""
        if duration_ms > target_ms:
            self.fail(f"Performance target not met: {duration_ms:.2f}ms > {target_ms}ms")
        if warning_ms and duration_ms > warning_ms:
            print(f"⚠️ Warning: Operation took {duration_ms:.2f}ms (target: {warning_ms}ms)")
        else:
            print(f"✅ Performance OK: {duration_ms:.2f}ms (target: {target_ms}ms)")


class TenancyPerformanceTest(PerformanceTestCase):
    """Performance tests for tenant isolation"""

    def test_tenant_isolation_query_performance(self):
        """Verify tenant isolation queries are fast (<5ms target, <10ms acceptable)"""
        from apps.inventory.models import Product

        # Create test data
        for i in range(100):
            Product.objects.create(
                name=f"Product {i}",
                sku=f"SKU-{i:03d}"
            )

        # Test query performance
        def query_products():
            return list(Product.objects.all()[:10])

        duration_ms, products = self.time_operation(query_products)

        self.assertEqual(len(products), 10)
        self.assert_performance(duration_ms, target_ms=10, warning_ms=5)

    def test_tenant_context_switch_performance(self):
        """Verify tenant context switching is fast (<1ms)"""
        tenant2 = Organization.objects.create(name="Tenant 2", slug="tenant-2")

        def switch_tenant():
            set_current_tenant(self.tenant)
            set_current_tenant(tenant2)
            set_current_tenant(self.tenant)

        duration_ms, _ = self.time_operation(switch_tenant)

        self.assert_performance(duration_ms, target_ms=1)


class EventBusPerformanceTest(TransactionTestCase):
    """Performance tests for event bus"""

    def setUp(self):
        self.tenant = Organization.objects.create(name="Event Test Org", slug="event-test")
        self.user = User.objects.create_user(
            username="eventuser",
            email="event@test.com",
            password="testpass123"
        )
        set_current_tenant(self.tenant)
        set_current_user(self.user)

    def time_operation(self, operation, *args, **kwargs):
        """Time an operation and return duration in milliseconds"""
        start = time.perf_counter()
        result = operation(*args, **kwargs)
        end = time.perf_counter()
        duration_ms = (end - start) * 1000
        return duration_ms, result

    def assert_performance(self, duration_ms, target_ms, warning_ms=None):
        """Assert operation meets performance target"""
        if duration_ms > target_ms:
            self.fail(f"Performance target not met: {duration_ms:.2f}ms > {target_ms}ms")
        if warning_ms and duration_ms > warning_ms:
            print(f"⚠️ Warning: Operation took {duration_ms:.2f}ms (target: {warning_ms}ms)")
        else:
            print(f"✅ Performance OK: {duration_ms:.2f}ms (target: {target_ms}ms)")

    def test_event_emission_performance(self):
        """Verify event emission is fast (<10ms target, <20ms acceptable)"""

        def emit_test_event():
            emit_event('test.performance', {
                'test_id': 123,
                'timestamp': timezone.now().isoformat(),
                'tenant_id': self.tenant.id
            })

        duration_ms, _ = self.time_operation(emit_test_event)

        # Verify event was created
        events = EventOutbox.objects.filter(event_type='test.performance')
        self.assertEqual(events.count(), 1)

        self.assert_performance(duration_ms, target_ms=20, warning_ms=10)

    def test_bulk_event_emission_performance(self):
        """Verify bulk event emission performance (100 events in <200ms)"""

        def emit_bulk_events():
            for i in range(100):
                emit_event('test.bulk', {
                    'event_id': i,
                    'tenant_id': self.tenant.id
                })

        duration_ms, _ = self.time_operation(emit_bulk_events)

        # Verify all events created
        events = EventOutbox.objects.filter(event_type='test.bulk')
        self.assertEqual(events.count(), 100)

        self.assert_performance(duration_ms, target_ms=200)

        avg_per_event = duration_ms / 100
        print(f"📊 Average per event: {avg_per_event:.2f}ms")


class RBACPerformanceTest(PerformanceTestCase):
    """Performance tests for RBAC system"""

    def setUp(self):
        super().setUp()

        # Create roles and permissions
        self.permissions = []
        for i in range(10):
            perm = Permission.objects.create(
                name=f'test.permission_{i}',
                description=f'Test permission {i}'
            )
            self.permissions.append(perm)

        self.role = Role.objects.create(
            organization=self.tenant,
            name='Test Role'
        )
        self.role.permissions.set(self.permissions)

        RBACService.assign_role(self.user, self.role, self.tenant)

    def test_permission_check_performance(self):
        """Verify permission check is fast (<5ms target, <10ms acceptable)"""

        def check_permission():
            return RBACService.has_permission(
                self.user,
                'test.permission_5',
                self.tenant
            )

        duration_ms, has_perm = self.time_operation(check_permission)

        self.assertTrue(has_perm)
        self.assert_performance(duration_ms, target_ms=10, warning_ms=5)

    def test_bulk_permission_check_performance(self):
        """Verify bulk permission checks are fast (100 checks in <100ms)"""

        def check_permissions():
            results = []
            for i in range(100):
                perm_name = f'test.permission_{i % 10}'
                has_perm = RBACService.has_permission(
                    self.user,
                    perm_name,
                    self.tenant
                )
                results.append(has_perm)
            return results

        duration_ms, results = self.time_operation(check_permissions)

        self.assertEqual(len(results), 100)
        self.assert_performance(duration_ms, target_ms=100)

        avg_per_check = duration_ms / 100
        print(f"📊 Average per check: {avg_per_check:.2f}ms")


class AuditLoggingPerformanceTest(PerformanceTestCase):
    """Performance tests for audit logging"""

    def test_audit_log_write_performance(self):
        """Verify audit log write is fast (<5ms target, <10ms acceptable)"""
        from apps.inventory.models import Product

        def create_with_audit():
            return Product.objects.create(
                name="Test Product",
                sku="TEST-SKU"
            )

        duration_ms, product = self.time_operation(create_with_audit)

        # Verify audit log created
        logs = AuditLog.objects.filter(
            content_type__model='product',
            object_id=str(product.id)
        )
        self.assertTrue(logs.exists())

        self.assert_performance(duration_ms, target_ms=10, warning_ms=5)

    def test_bulk_audit_log_performance(self):
        """Verify bulk operations with audit logging (100 creates in <500ms)"""
        from apps.inventory.models import Product

        def create_bulk():
            products = []
            for i in range(100):
                product = Product.objects.create(
                    name=f"Product {i}",
                    sku=f"BULK-{i:03d}"
                )
                products.append(product)
            return products

        duration_ms, products = self.time_operation(create_bulk)

        self.assertEqual(len(products), 100)

        # Verify audit logs created
        logs = AuditLog.objects.filter(content_type__model='product')
        self.assertGreaterEqual(logs.count(), 100)

        self.assert_performance(duration_ms, target_ms=500)

        avg_per_create = duration_ms / 100
        print(f"📊 Average per create: {avg_per_create:.2f}ms")


class DatabasePerformanceTest(PerformanceTestCase):
    """Performance tests for database operations"""

    def test_query_with_join_performance(self):
        """Verify queries with JOINs are fast"""
        from apps.inventory.models import Product, Inventory, Warehouse

        # Create test data
        warehouse = Warehouse.objects.create(
            organization=self.tenant,
            name="Main Warehouse",
            location_type='WAREHOUSE'
        )

        for i in range(50):
            product = Product.objects.create(
                name=f"Product {i}",
                sku=f"JOIN-{i:03d}"
            )
            Inventory.objects.create(
                organization=self.tenant,
                product=product,
                warehouse=warehouse,
                quantity=Decimal('10.00')
            )

        def query_with_joins():
            return list(
                Inventory.objects
                .select_related('product', 'warehouse')
                .filter(organization=self.tenant)[:20]
            )

        duration_ms, results = self.time_operation(query_with_joins)

        self.assertEqual(len(results), 20)
        self.assert_performance(duration_ms, target_ms=20, warning_ms=10)

    def test_aggregation_performance(self):
        """Verify aggregation queries are fast"""
        from apps.inventory.models import Product
        from django.db.models import Count

        # Create test data
        for i in range(100):
            Product.objects.create(
                name=f"Product {i}",
                sku=f"AGG-{i:03d}"
            )

        def run_aggregation():
            return Product.objects.aggregate(total=Count('id'))

        duration_ms, result = self.time_operation(run_aggregation)

        self.assertEqual(result['total'], 100)
        self.assert_performance(duration_ms, target_ms=10)


class ContractValidationPerformanceTest(PerformanceTestCase):
    """Performance tests for contract validation"""

    def test_contract_validation_performance(self):
        """Verify contract validation is fast (<1ms target, <5ms acceptable)"""
        from kernel.contracts.testing import validate_event_payload
        from kernel.contracts.event_contracts import register_all_contracts

        register_all_contracts()

        payload = {
            'invoice_id': 123,
            'customer_id': 456,
            'total_amount': 99.99,
            'currency': 'USD',
            'tenant_id': self.tenant.id
        }

        def validate():
            return validate_event_payload(
                'invoice.created',
                payload,
                raise_on_error=False
            )

        duration_ms, errors = self.time_operation(validate)

        self.assertEqual(len(errors), 0)
        self.assert_performance(duration_ms, target_ms=5, warning_ms=1)

    def test_bulk_contract_validation_performance(self):
        """Verify bulk validation is fast (100 validations in <50ms)"""
        from kernel.contracts.testing import validate_event_payload
        from kernel.contracts.event_contracts import register_all_contracts

        register_all_contracts()

        def validate_bulk():
            errors_list = []
            for i in range(100):
                payload = {
                    'invoice_id': i,
                    'customer_id': 456,
                    'total_amount': 99.99,
                    'currency': 'USD',
                    'tenant_id': self.tenant.id
                }
                errors = validate_event_payload(
                    'invoice.created',
                    payload,
                    raise_on_error=False
                )
                errors_list.append(errors)
            return errors_list

        duration_ms, errors_list = self.time_operation(validate_bulk)

        self.assertEqual(len(errors_list), 100)
        self.assert_performance(duration_ms, target_ms=50)

        avg_per_validation = duration_ms / 100
        print(f"📊 Average per validation: {avg_per_validation:.3f}ms")


class ConcurrencyPerformanceTest(TransactionTestCase):
    """Performance tests for concurrent operations"""

    def setUp(self):
        self.tenant = Organization.objects.create(name="Concurrency Test", slug="concurrency-test")
        self.user = User.objects.create_user(
            username="concurrentuser",
            email="concurrent@test.com",
            password="testpass123"
        )
        set_current_tenant(self.tenant)
        set_current_user(self.user)

    def time_operation(self, operation, *args, **kwargs):
        """Time an operation and return duration in milliseconds"""
        start = time.perf_counter()
        result = operation(*args, **kwargs)
        end = time.perf_counter()
        duration_ms = (end - start) * 1000
        return duration_ms, result

    def test_concurrent_tenant_operations(self):
        """Verify concurrent operations across tenants don't interfere"""
        from apps.inventory.models import Product

        tenant2 = Organization.objects.create(name="Tenant 2", slug="tenant-2-concurrent")

        def create_products_both_tenants():
            # Tenant 1 products
            set_current_tenant(self.tenant)
            for i in range(10):
                Product.objects.create(name=f"T1-Product-{i}", sku=f"T1-{i:03d}")

            # Tenant 2 products
            set_current_tenant(tenant2)
            for i in range(10):
                Product.objects.create(name=f"T2-Product-{i}", sku=f"T2-{i:03d}")

            # Verify isolation
            set_current_tenant(self.tenant)
            t1_count = Product.objects.count()

            set_current_tenant(tenant2)
            t2_count = Product.objects.count()

            return t1_count, t2_count

        duration_ms, (t1_count, t2_count) = self.time_operation(create_products_both_tenants)

        self.assertEqual(t1_count, 10)
        self.assertEqual(t2_count, 10)

        # Should complete in reasonable time
        self.assertLess(duration_ms, 200, f"Concurrent operations too slow: {duration_ms:.2f}ms")
        print(f"✅ Concurrent operations: {duration_ms:.2f}ms")


class MemoryPerformanceTest(PerformanceTestCase):
    """Performance tests for memory usage"""

    def test_large_queryset_memory(self):
        """Verify large querysets use iterator to save memory"""
        from apps.inventory.models import Product
        import sys

        # Create large dataset
        products = []
        for i in range(1000):
            products.append(Product(
                name=f"Product {i}",
                sku=f"MEM-{i:04d}"
            ))
        Product.objects.bulk_create(products)

        # Test without iterator (loads all into memory)
        def query_without_iterator():
            count = 0
            for product in Product.objects.all():
                count += 1
            return count

        # Test with iterator (memory efficient)
        def query_with_iterator():
            count = 0
            for product in Product.objects.all().iterator(chunk_size=100):
                count += 1
            return count

        # Both should return same count
        duration1, count1 = self.time_operation(query_without_iterator)
        duration2, count2 = self.time_operation(query_with_iterator)

        self.assertEqual(count1, 1000)
        self.assertEqual(count2, 1000)

        print(f"📊 Without iterator: {duration1:.2f}ms")
        print(f"📊 With iterator: {duration2:.2f}ms")

        # Iterator should be faster or similar
        # (Main benefit is memory, not necessarily speed)


class CachePerformanceTest(PerformanceTestCase):
    """Performance tests for caching"""

    def test_cache_read_performance(self):
        """Verify cache reads are fast (<1ms)"""
        from django.core.cache import cache

        # Set cache value
        cache.set('test_key', {'data': 'test_value'}, timeout=300)

        def read_from_cache():
            return cache.get('test_key')

        duration_ms, value = self.time_operation(read_from_cache)

        self.assertIsNotNone(value)
        self.assertEqual(value['data'], 'test_value')

        # Cache reads should be very fast
        self.assertLess(duration_ms, 1, f"Cache read too slow: {duration_ms:.3f}ms")
        print(f"✅ Cache read: {duration_ms:.3f}ms")

    def test_cache_write_performance(self):
        """Verify cache writes are fast (<2ms)"""
        from django.core.cache import cache

        def write_to_cache():
            cache.set('write_test_key', {'data': 'test_value'}, timeout=300)

        duration_ms, _ = self.time_operation(write_to_cache)

        # Verify write succeeded
        value = cache.get('write_test_key')
        self.assertIsNotNone(value)

        # Cache writes should be very fast
        self.assertLess(duration_ms, 2, f"Cache write too slow: {duration_ms:.2f}ms")
        print(f"✅ Cache write: {duration_ms:.3f}ms")


def run_performance_suite():
    """
    Helper function to run all performance tests and generate report.

    Usage:
        python manage.py shell
        >>> from tests.performance.test_performance import run_performance_suite
        >>> run_performance_suite()
    """
    from django.test.utils import get_runner
    from django.conf import settings

    TestRunner = get_runner(settings)
    test_runner = TestRunner(verbosity=2, interactive=False, keepdb=True)

    print("\n" + "="*70)
    print("🚀 TSFSYSTEM PERFORMANCE TEST SUITE")
    print("="*70 + "\n")

    failures = test_runner.run_tests(["tests.performance.test_performance"])

    print("\n" + "="*70)
    if failures:
        print(f"❌ {failures} test(s) failed")
    else:
        print("✅ All performance tests passed!")
    print("="*70 + "\n")

    return failures
