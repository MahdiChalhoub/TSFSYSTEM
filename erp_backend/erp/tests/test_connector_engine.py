"""
Connector Engine - Unit Tests
==============================
Test coverage for the Connector Module runtime broker.
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from erp.connector_engine import ConnectorEngine, ConnectorResponse, ModuleState, OperationType
from erp.connector_models import BufferedRequest, ConnectorPolicy
from erp.models import Organization, OrganizationModule, SystemModule


class TestModuleStateEvaluation(TestCase):
    """Tests for the 4-state evaluation logic."""

    def setUp(self):
        self.engine = ConnectorEngine()
        self.org = Organization.objects.create(
            name='Test Org',
            slug='test-org',
        )

    def test_module_state_missing_when_not_installed(self):
        """Module should be MISSING when not in SystemModule registry."""
        state = self.engine.get_module_state('nonexistent', self.org.id)
        self.assertEqual(state, ModuleState.MISSING)

    def test_module_state_missing_when_failed(self):
        """Module should be MISSING when status is FAILED."""
        SystemModule.objects.create(
            name='failed_module',
            version='1.0.0',
            status='FAILED',
            manifest={},
            checksum='test'
        )
        state = self.engine.get_module_state('failed_module', self.org.id)
        self.assertEqual(state, ModuleState.MISSING)

    def test_module_state_disabled_when_not_granted(self):
        """Module should be DISABLED when installed but not granted to org."""
        SystemModule.objects.create(
            name='inventory',
            version='1.0.0',
            status='INSTALLED',
            manifest={},
            checksum='test'
        )
        state = self.engine.get_module_state('inventory', self.org.id)
        self.assertEqual(state, ModuleState.DISABLED)

    def test_module_state_disabled_when_explicitly_disabled(self):
        """Module should be DISABLED when OrganizationModule.is_enabled=False."""
        mod = SystemModule.objects.create(
            name='inventory',
            version='1.0.0',
            status='INSTALLED',
            manifest={},
            checksum='test'
        )
        OrganizationModule.objects.create(
            organization=self.org,
            module_name='inventory',
            is_enabled=False
        )
        state = self.engine.get_module_state('inventory', self.org.id)
        self.assertEqual(state, ModuleState.DISABLED)

    def test_module_state_available_when_enabled(self):
        """Module should be AVAILABLE when installed and enabled for org."""
        SystemModule.objects.create(
            name='inventory',
            version='1.0.0',
            status='INSTALLED',
            manifest={},
            checksum='test'
        )
        OrganizationModule.objects.create(
            organization=self.org,
            module_name='inventory',
            is_enabled=True
        )
        state = self.engine.get_module_state('inventory', self.org.id)
        self.assertEqual(state, ModuleState.AVAILABLE)


class TestPolicyRetrieval(TestCase):
    """Tests for policy lookup and priority."""

    def setUp(self):
        self.engine = ConnectorEngine()

    def test_exact_match_policy_takes_precedence(self):
        """Exact module+endpoint match should be returned first."""
        # Global wildcard
        ConnectorPolicy.objects.create(
            target_module='*',
            target_endpoint='*',
            when_missing_read='error',
            priority=0
        )
        # Module wildcard
        ConnectorPolicy.objects.create(
            target_module='inventory',
            target_endpoint='*',
            when_missing_read='cached',
            priority=0
        )
        # Exact match
        exact = ConnectorPolicy.objects.create(
            target_module='inventory',
            target_endpoint='products/',
            when_missing_read='empty',
            priority=0
        )

        policy = self.engine.get_policy('inventory', 'products/')
        self.assertEqual(policy.id, exact.id)

    def test_module_wildcard_fallback(self):
        """Module-level wildcard used when no exact match."""
        module_policy = ConnectorPolicy.objects.create(
            target_module='inventory',
            target_endpoint='*',
            when_missing_read='cached',
            priority=0
        )

        policy = self.engine.get_policy('inventory', 'unknown/')
        self.assertEqual(policy.id, module_policy.id)

    def test_priority_ordering(self):
        """Higher priority policies should be preferred."""
        low = ConnectorPolicy.objects.create(
            source_module='pos',
            target_module='inventory',
            target_endpoint='*',
            when_missing_read='error',
            priority=1
        )
        high = ConnectorPolicy.objects.create(
            source_module='finance',
            target_module='inventory',
            target_endpoint='*',
            when_missing_read='cached',
            priority=10
        )

        policy = self.engine.get_policy('inventory', 'products/')
        self.assertEqual(policy.priority, 10)


class TestBuffering(TestCase):
    """Tests for request buffering and replay."""

    def setUp(self):
        self.engine = ConnectorEngine()
        self.org = Organization.objects.create(
            name='Test Org',
            slug='test-org',
        )

    def test_buffer_request_creates_record(self):
        """Buffering a request should create a BufferedRequest entry."""
        buffered = self.engine.buffer_request(
            target_module='inventory',
            endpoint='stock/update/',
            data={'product_id': 123, 'quantity': 10},
            organization_id=self.org.id,
            source_module='pos',
            ttl_seconds=3600
        )

        self.assertIsNotNone(buffered.id)
        self.assertEqual(buffered.target_module, 'inventory')
        self.assertEqual(buffered.status, 'pending')
        self.assertEqual(buffered.payload['product_id'], 123)

    def test_buffer_expires_correctly(self):
        """Expired buffers should be marked as expired during cleanup."""
        # Create expired buffer
        expired = BufferedRequest.objects.create(
            target_module='inventory',
            target_endpoint='stock/',
            organization=self.org,
            payload={'test': True},
            expires_at=timezone.now() - timedelta(hours=1),
            status='pending'
        )

        count = self.engine.cleanup_expired_buffers()

        expired.refresh_from_db()
        self.assertEqual(expired.status, 'expired')
        self.assertEqual(count, 1)


class TestFallbackActions(TestCase):
    """Tests for fallback action application."""

    def setUp(self):
        self.engine = ConnectorEngine()

    def test_default_read_fallback_is_empty(self):
        """Default read fallback should return empty response."""
        action = self.engine.get_fallback_action(
            ModuleState.MISSING,
            OperationType.READ,
            None
        )
        self.assertEqual(action, 'empty')

    def test_default_write_fallback_is_buffer(self):
        """Default write fallback for MISSING should be buffer."""
        action = self.engine.get_fallback_action(
            ModuleState.MISSING,
            OperationType.WRITE,
            None
        )
        self.assertEqual(action, 'buffer')

    def test_disabled_write_fallback_is_drop(self):
        """Default write fallback for DISABLED should be drop."""
        action = self.engine.get_fallback_action(
            ModuleState.DISABLED,
            OperationType.WRITE,
            None
        )
        self.assertEqual(action, 'drop')


class TestConnectorResponse(TestCase):
    """Tests for ConnectorResponse structure."""

    def test_response_to_dict(self):
        """ConnectorResponse should serialize to dict correctly."""
        response = ConnectorResponse(
            data={'test': 'data'},
            state=ModuleState.AVAILABLE,
            from_cache=True
        )

        d = response.to_dict()

        self.assertEqual(d['data'], {'test': 'data'})
        self.assertEqual(d['state'], 'available')
        self.assertTrue(d['from_cache'])
        self.assertFalse(d['fallback_applied'])

    def test_success_property(self):
        """Success should be True when no error."""
        response = ConnectorResponse(data=None)
        self.assertTrue(response.success)

        error_response = ConnectorResponse(data=None, error='Test error')
        self.assertFalse(error_response.success)
