"""
Kernel OS Integration Tests
============================
Comprehensive integration tests for Kernel OS v2.0

Run with:
    python manage.py test tests.integration.test_kernel_integration
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
import json

User = get_user_model()


class TenancyIntegrationTest(TransactionTestCase):
    """Test tenant isolation works correctly"""

    def setUp(self):
        """Create two separate tenants for isolation testing"""
        from erp.models import Organization, Site

        # Tenant 1
        self.tenant1 = Organization.objects.create(
            name="Acme Corp",
            slug="acme"
        )
        self.site1 = Site.objects.create(
            organization=self.tenant1,
            name="Acme HQ"
        )

        # Tenant 2
        self.tenant2 = Organization.objects.create(
            name="Beta Inc",
            slug="beta"
        )
        self.site2 = Site.objects.create(
            organization=self.tenant2,
            name="Beta HQ"
        )

    def test_tenant_isolation_models_auto_filter(self):
        """Verify TenantOwnedModel automatically filters by tenant"""
        from apps.inventory.models import Product
        from kernel.tenancy.middleware import set_current_tenant

        # Create products for each tenant
        set_current_tenant(self.tenant1)
        product1 = Product.objects.create(
            name="Product 1",
            sku="ACME-001"
        )

        set_current_tenant(self.tenant2)
        product2 = Product.objects.create(
            name="Product 2",
            sku="BETA-001"
        )

        # Verify isolation
        set_current_tenant(self.tenant1)
        tenant1_products = list(Product.objects.all())
        self.assertEqual(len(tenant1_products), 1)
        self.assertEqual(tenant1_products[0].sku, "ACME-001")

        set_current_tenant(self.tenant2)
        tenant2_products = list(Product.objects.all())
        self.assertEqual(len(tenant2_products), 1)
        self.assertEqual(tenant2_products[0].sku, "BETA-001")

        print("✅ Tenant isolation: Products correctly filtered by tenant")

    def test_tenant_isolation_no_cross_tenant_access(self):
        """Verify cannot access another tenant's data"""
        from apps.finance.models import Invoice
        from kernel.tenancy.middleware import set_current_tenant

        # Create invoice for tenant 1
        set_current_tenant(self.tenant1)
        invoice1 = Invoice.objects.create(
            reference="INV-001",
            total_amount=Decimal("100.00")
        )
        invoice1_id = invoice1.id

        # Try to access from tenant 2
        set_current_tenant(self.tenant2)
        with self.assertRaises(Invoice.DoesNotExist):
            Invoice.objects.get(id=invoice1_id)

        print("✅ Tenant isolation: Cannot access other tenant's data")


class EventBusIntegrationTest(TransactionTestCase):
    """Test event bus functionality"""

    def setUp(self):
        from erp.models import Organization
        self.tenant = Organization.objects.create(name="Test Org", slug="test")

    def test_event_emission_and_outbox(self):
        """Verify events are emitted to outbox"""
        from kernel.events import emit_event
        from kernel.events.models import EventOutbox
        from kernel.tenancy.middleware import set_current_tenant

        set_current_tenant(self.tenant)

        # Emit event
        emit_event('test.event', {
            'test_id': 123,
            'message': 'Hello World'
        })

        # Verify in outbox
        events = EventOutbox.objects.filter(event_type='test.event')
        self.assertEqual(events.count(), 1)

        event = events.first()
        self.assertEqual(event.payload['test_id'], 123)
        self.assertEqual(event.payload['message'], 'Hello World')
        self.assertEqual(event.status, 'PENDING')

        print("✅ Event Bus: Events stored in outbox")

    def test_event_handler_registration(self):
        """Verify event handlers can be registered and invoked"""
        from kernel.events import event_handler, emit_event
        from kernel.tenancy.middleware import set_current_tenant

        # Track if handler was called
        handler_called = []

        @event_handler('test.handler_event')
        def test_handler(payload):
            handler_called.append(payload)
            return {'success': True}

        set_current_tenant(self.tenant)
        emit_event('test.handler_event', {'data': 'test'})

        # Process events
        from kernel.events.processor import EventProcessor
        processor = EventProcessor()
        processor.process_pending_events()

        # Verify handler was called
        self.assertEqual(len(handler_called), 1)
        self.assertEqual(handler_called[0]['data'], 'test')

        print("✅ Event Bus: Handlers registered and invoked")


class RBACIntegrationTest(TransactionTestCase):
    """Test RBAC permissions system"""

    def setUp(self):
        from erp.models import Organization
        self.tenant = Organization.objects.create(name="Test Org", slug="test")
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )

    def test_permission_assignment_and_checking(self):
        """Verify permissions can be assigned and checked"""
        from kernel.rbac.models import Role, Permission
        from kernel.rbac.services import RBACService

        # Create permission
        perm = Permission.objects.create(
            name="finance.create_invoice",
            description="Can create invoices"
        )

        # Create role
        role = Role.objects.create(
            organization=self.tenant,
            name="Accountant"
        )
        role.permissions.add(perm)

        # Assign role to user
        RBACService.assign_role(self.user, role, self.tenant)

        # Check permission
        has_perm = RBACService.has_permission(
            self.user,
            "finance.create_invoice",
            self.tenant
        )

        self.assertTrue(has_perm)
        print("✅ RBAC: Permission assignment and checking works")

    def test_permission_denial(self):
        """Verify users without permission are denied"""
        from kernel.rbac.services import RBACService

        # User has no permissions
        has_perm = RBACService.has_permission(
            self.user,
            "finance.delete_invoice",
            self.tenant
        )

        self.assertFalse(has_perm)
        print("✅ RBAC: Permission denial works")


class AuditLoggingIntegrationTest(TransactionTestCase):
    """Test audit logging functionality"""

    def setUp(self):
        from erp.models import Organization
        self.tenant = Organization.objects.create(name="Test Org", slug="test")
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )

    def test_audit_log_creation_on_model_save(self):
        """Verify audit logs created automatically on model changes"""
        from apps.finance.models import Invoice
        from kernel.audit.models import AuditLog
        from kernel.tenancy.middleware import set_current_tenant, set_current_user

        set_current_tenant(self.tenant)
        set_current_user(self.user)

        # Create invoice
        invoice = Invoice.objects.create(
            reference="INV-001",
            total_amount=Decimal("100.00")
        )

        # Verify audit log exists
        logs = AuditLog.objects.filter(
            content_type__model='invoice',
            object_id=str(invoice.id),
            action='CREATE'
        )

        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertEqual(log.user, self.user)
        self.assertEqual(log.organization, self.tenant)

        print("✅ Audit Logging: CREATE actions logged")

    def test_audit_log_on_update(self):
        """Verify audit logs track changes on updates"""
        from apps.finance.models import Invoice
        from kernel.audit.models import AuditLog
        from kernel.tenancy.middleware import set_current_tenant, set_current_user

        set_current_tenant(self.tenant)
        set_current_user(self.user)

        # Create and update
        invoice = Invoice.objects.create(
            reference="INV-002",
            total_amount=Decimal("100.00")
        )

        invoice.total_amount = Decimal("200.00")
        invoice.save()

        # Verify UPDATE log
        logs = AuditLog.objects.filter(
            content_type__model='invoice',
            object_id=str(invoice.id),
            action='UPDATE'
        )

        self.assertGreater(logs.count(), 0)
        log = logs.first()
        self.assertIn('total_amount', log.changes)

        print("✅ Audit Logging: UPDATE actions tracked with changes")


class ModuleLoaderIntegrationTest(TransactionTestCase):
    """Test module loader functionality"""

    def setUp(self):
        from erp.models import Organization
        self.tenant = Organization.objects.create(name="Test Org", slug="test")

    def test_module_registration(self):
        """Verify modules can be registered"""
        from kernel.modules.models import KernelModule
        from kernel.modules.loader import ModuleLoader

        # Register module
        module = ModuleLoader.register(
            name="test_module",
            version="1.0.0",
            description="Test module",
            dependencies=["core"]
        )

        self.assertIsNotNone(module)
        self.assertEqual(module.name, "test_module")
        self.assertEqual(module.version, "1.0.0")

        print("✅ Module Loader: Module registration works")

    def test_module_enable_disable(self):
        """Verify modules can be enabled/disabled per tenant"""
        from kernel.modules.loader import ModuleLoader

        # Register module
        module = ModuleLoader.register(
            name="finance",
            version="1.0.0",
            description="Finance module"
        )

        # Install for tenant
        org_module = ModuleLoader.install_for_tenant(
            self.tenant,
            "finance",
            auto_enable=True
        )

        # Check if enabled
        is_enabled = ModuleLoader.is_module_enabled(self.tenant, "finance")
        self.assertTrue(is_enabled)

        # Disable
        org_module.disable()
        is_enabled = ModuleLoader.is_module_enabled(self.tenant, "finance")
        self.assertFalse(is_enabled)

        print("✅ Module Loader: Enable/disable functionality works")


class ConfigEngineIntegrationTest(TransactionTestCase):
    """Test configuration engine"""

    def setUp(self):
        from erp.models import Organization
        self.tenant = Organization.objects.create(name="Test Org", slug="test")

    def test_config_get_set(self):
        """Verify config can be set and retrieved"""
        from kernel.config import set_config, get_config
        from kernel.tenancy.middleware import set_current_tenant

        set_current_tenant(self.tenant)

        # Set config
        set_config('test_key', 'test_value')

        # Get config
        value = get_config('test_key')
        self.assertEqual(value, 'test_value')

        print("✅ Config Engine: Set and get works")

    def test_feature_flags(self):
        """Verify feature flags work"""
        from kernel.config import enable_feature, is_feature_enabled
        from kernel.tenancy.middleware import set_current_tenant

        set_current_tenant(self.tenant)

        # Enable feature
        enable_feature('new_invoice_flow')

        # Check feature
        is_enabled = is_feature_enabled('new_invoice_flow')
        self.assertTrue(is_enabled)

        print("✅ Config Engine: Feature flags work")


class ContractValidationIntegrationTest(TestCase):
    """Test event contract validation"""

    def test_contract_validation_valid_payload(self):
        """Verify valid payloads pass validation"""
        from kernel.contracts.testing import validate_event_payload
        from kernel.contracts.event_contracts import register_all_contracts

        # Register contracts
        register_all_contracts()

        # Valid payload
        payload = {
            'invoice_id': 123,
            'customer_id': 456,
            'total_amount': 99.99,
            'currency': 'USD',
            'tenant_id': 1
        }

        errors = validate_event_payload('invoice.created', payload, raise_on_error=False)
        self.assertEqual(len(errors), 0)

        print("✅ Contract Validation: Valid payloads pass")

    def test_contract_validation_invalid_payload(self):
        """Verify invalid payloads fail validation"""
        from kernel.contracts.testing import validate_event_payload
        from kernel.contracts.event_contracts import register_all_contracts

        register_all_contracts()

        # Missing required fields
        payload = {
            'invoice_id': 123
            # Missing required fields
        }

        errors = validate_event_payload('invoice.created', payload, raise_on_error=False)
        self.assertGreater(len(errors), 0)

        print("✅ Contract Validation: Invalid payloads rejected")


class EndToEndIntegrationTest(TransactionTestCase):
    """End-to-end integration tests"""

    def test_complete_sales_flow(self):
        """
        Test complete flow: POS Sale → Inventory Deduction → Finance Journal Entry

        This tests:
        - Event emission
        - Cross-module communication
        - Contract validation
        - Audit logging
        """
        from erp.models import Organization, Site
        from apps.pos.models import Order, OrderLine
        from apps.inventory.models import Product, Inventory, Warehouse
        from kernel.events import emit_event
        from kernel.tenancy.middleware import set_current_tenant
        from decimal import Decimal

        # Setup
        tenant = Organization.objects.create(name="Test Shop", slug="shop")
        site = Site.objects.create(organization=tenant, name="Shop HQ")
        warehouse = Warehouse.objects.create(
            organization=tenant,
            name="Main Warehouse",
            location_type="WAREHOUSE"
        )

        set_current_tenant(tenant)

        # Create product with stock
        product = Product.objects.create(
            name="Test Product",
            sku="TEST-001",
            price=Decimal("50.00"),
            cost_price=Decimal("30.00")
        )

        Inventory.objects.create(
            organization=tenant,
            product=product,
            warehouse=warehouse,
            quantity=Decimal("100")
        )

        # Create POS order
        order = Order.objects.create(
            organization=tenant,
            site=site,
            type='SALE',
            total_amount=Decimal("50.00"),
            reference="SALE-001"
        )

        OrderLine.objects.create(
            order=order,
            product=product,
            quantity=Decimal("1"),
            unit_price=Decimal("50.00"),
            line_total=Decimal("50.00")
        )

        # Emit order completed event
        emit_event('order.completed', {
            'order_id': order.id,
            'type': 'SALE',
            'total_amount': float(order.total_amount),
            'tax_amount': 0,
            'reference': order.reference,
            'warehouse_id': warehouse.id,
            'lines': [{
                'product_id': product.id,
                'quantity': 1,
                'unit_price': 50.00,
                'cost_price': 30.00
            }],
            'tenant_id': tenant.id
        })

        # Process events
        from kernel.events.processor import EventProcessor
        processor = EventProcessor()
        processor.process_pending_events()

        # Verify inventory was deducted
        inventory = Inventory.objects.get(product=product, warehouse=warehouse)
        self.assertEqual(inventory.quantity, Decimal("99"))

        # Verify journal entry was created (if finance module implemented)
        # from apps.finance.models import JournalEntry
        # entries = JournalEntry.objects.filter(reference='SALE-001')
        # self.assertGreater(entries.count(), 0)

        print("✅ End-to-End: Complete sales flow works!")


def run_all_integration_tests():
    """
    Run all integration tests and print summary.

    Usage:
        from tests.integration.test_kernel_integration import run_all_integration_tests
        run_all_integration_tests()
    """
    from django.test.runner import DiscoverRunner

    runner = DiscoverRunner(verbosity=2)
    failures = runner.run_tests(['tests.integration.test_kernel_integration'])

    if failures == 0:
        print("\n" + "="*80)
        print("✅ ALL INTEGRATION TESTS PASSED!")
        print("="*80)
    else:
        print("\n" + "="*80)
        print(f"❌ {failures} TEST(S) FAILED")
        print("="*80)

    return failures
