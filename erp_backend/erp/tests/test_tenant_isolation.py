"""
Kernel — Tenant Isolation Security Tests
==========================================
Tests for the TenantMiddleware to ensure strict multi-tenant isolation.
Covers: anonymous access, cross-tenant attacks, superuser access,
        expired org read-only mode, and cleanup after requests.

These tests are critical for data security and compliance.
"""
from django.test import TestCase, RequestFactory, override_settings
from django.http import JsonResponse
from unittest.mock import patch, MagicMock

from erp.models import Organization, User, Role
from erp.middleware import TenantMiddleware, get_current_tenant_id, set_current_tenant_id


class TenantIsolationTestBase(TestCase):
    """Shared fixtures for tenant isolation tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org_a = Organization.objects.create(
            name='Org Alpha', slug='org-alpha',
        )
        cls.org_b = Organization.objects.create(
            name='Org Beta', slug='org-beta',
        )
        cls.org_inactive = Organization.objects.create(
            name='Org Inactive', slug='org-inactive', is_active=False,
        )

        cls.user_a = User.objects.create_user(
            username='user_a', password='pass123',
            email='a@org-a.com', organization=cls.org_a,
        )
        cls.user_b = User.objects.create_user(
            username='user_b', password='pass123',
            email='b@org-b.com', organization=cls.org_b,
        )
        cls.superuser = User.objects.create_superuser(
            username='superadmin', password='pass123',
            email='super@admin.com',
        )

    def setUp(self):
        self.factory = RequestFactory()
        self.get_response = MagicMock(return_value=JsonResponse({'ok': True}))
        self.middleware = TenantMiddleware(self.get_response)


class TestPublicPathBypass(TenantIsolationTestBase):
    """Paths like /api/health/ should bypass tenant isolation."""

    def test_health_endpoint_is_public(self):
        """Health check should be accessible without tenant context."""
        request = self.factory.get('/api/health/')
        response = self.middleware(request)
        # Should delegate to get_response (not blocked)
        self.get_response.assert_called_once()

    def test_auth_login_is_public(self):
        """Login endpoint should be accessible without tenant context."""
        request = self.factory.get('/api/auth/login/')
        response = self.middleware(request)
        self.get_response.assert_called_once()


class TestAnonymousAccess(TenantIsolationTestBase):
    """Unauthenticated users with tenant headers should be blocked."""

    def test_anonymous_with_tenant_header_returns_401(self):
        """Anonymous request with X-Tenant-Id should be blocked."""
        request = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_a.id),
        )
        request.user = MagicMock()
        request.user.is_authenticated = False

        # Patch _resolve_user_from_token to return None (anonymous)
        with patch.object(self.middleware, '_resolve_user_from_token', return_value=None):
            response = self.middleware(request)

        self.assertEqual(response.status_code, 401)

    def test_anonymous_without_tenant_header_passes(self):
        """Anonymous request without X-Tenant-Id should pass (public API)."""
        request = self.factory.get('/api/some-path/')
        request.user = MagicMock()
        request.user.is_authenticated = False

        with patch.object(self.middleware, '_resolve_user_from_token', return_value=None):
            response = self.middleware(request)
        
        # Should pass through (tenant_id will be None)
        self.get_response.assert_called_once()


class TestCrossTenantIsolation(TenantIsolationTestBase):
    """Users must not access data from other organizations."""

    def test_user_accessing_own_org_is_allowed(self):
        """User should access their own organization's data."""
        request = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_a.id),
        )
        request.user = self.user_a

        with patch.object(self.middleware, '_resolve_user_from_token', return_value=self.user_a):
            response = self.middleware(request)

        self.get_response.assert_called_once()
        self.assertEqual(request.organization_id, str(self.org_a.id))

    def test_user_accessing_other_org_returns_403(self):
        """User trying to access another organization should get 403."""
        request = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_b.id),  # Org B
        )
        request.user = self.user_a  # User from Org A

        with patch.object(self.middleware, '_resolve_user_from_token', return_value=self.user_a):
            response = self.middleware(request)

        self.assertEqual(response.status_code, 403)

    def test_superuser_can_access_any_org(self):
        """Superusers should be able to access any organization."""
        request = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_a.id),
        )
        request.user = self.superuser

        with patch.object(self.middleware, '_resolve_user_from_token', return_value=self.superuser):
            response = self.middleware(request)

        self.get_response.assert_called_once()
        self.assertEqual(request.organization_id, str(self.org_a.id))

    def test_superuser_can_switch_between_orgs(self):
        """Superuser should be able to switch tenant context across requests."""
        # Access Org A
        request_a = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_a.id),
        )
        request_a.user = self.superuser
        with patch.object(self.middleware, '_resolve_user_from_token', return_value=self.superuser):
            self.middleware(request_a)
        self.assertEqual(request_a.organization_id, str(self.org_a.id))

        # Access Org B
        request_b = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_b.id),
        )
        request_b.user = self.superuser
        with patch.object(self.middleware, '_resolve_user_from_token', return_value=self.superuser):
            self.middleware(request_b)
        self.assertEqual(request_b.organization_id, str(self.org_b.id))


class TestInactiveOrganization(TenantIsolationTestBase):
    """Inactive organizations should return 404."""

    def test_inactive_org_returns_404(self):
        """Request to an inactive organization should return 404."""
        inactive_user = User.objects.create_user(
            username='inactive_user', password='pass123',
            email='dead@inactive.com', organization=self.org_inactive,
        )
        request = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_inactive.id),
        )
        request.user = inactive_user

        with patch.object(self.middleware, '_resolve_user_from_token', return_value=inactive_user):
            response = self.middleware(request)

        self.assertEqual(response.status_code, 404)


class TestUserWithoutTenantHeader(TenantIsolationTestBase):
    """Users without X-Tenant-Id header should fall back to their organization."""

    def test_user_without_header_uses_own_org(self):
        """If no X-Tenant-Id header, user's organization should be used."""
        request = self.factory.get('/api/products/')
        request.user = self.user_a

        with patch.object(self.middleware, '_resolve_user_from_token', return_value=self.user_a):
            response = self.middleware(request)

        self.get_response.assert_called_once()
        self.assertEqual(request.organization_id, str(self.org_a.id))


class TestTenantContextCleanup(TenantIsolationTestBase):
    """Tenant context should be cleaned up after each request."""

    def test_tenant_context_cleared_after_request(self):
        """The thread-local tenant_id should be None after request completes."""
        request = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_a.id),
        )
        request.user = self.user_a

        with patch.object(self.middleware, '_resolve_user_from_token', return_value=self.user_a):
            self.middleware(request)

        # After the middleware completes, the tenant context should be cleared
        self.assertIsNone(get_current_tenant_id())

    def test_tenant_context_cleared_on_error(self):
        """Even if the view raises an error, tenant context should be cleaned."""
        self.get_response.side_effect = Exception('View crashed')
        request = self.factory.get(
            '/api/products/',
            HTTP_X_TENANT_ID=str(self.org_a.id),
        )
        request.user = self.user_a

        with patch.object(self.middleware, '_resolve_user_from_token', return_value=self.user_a):
            try:
                self.middleware(request)
            except Exception:
                pass

        # Context should still be cleaned up
        self.assertIsNone(get_current_tenant_id())
