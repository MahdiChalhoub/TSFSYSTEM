"""
Kernel — RBAC Permission Tests
================================
Tests for the Role-Based Access Control system.
Covers: permission checking, role assignment, superuser bypass,
        org admin checks, and the permission_required decorator.
"""
from django.test import TestCase
from unittest.mock import MagicMock

from erp.models import Organization, User, Role, Permission
from erp.permissions import (
    HasPermission, IsOrgAdmin, IsSuperAdmin,
)


class PermissionTestBase(TestCase):
    """Shared fixtures for RBAC tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='RBAC Test Org', slug='rbac-test-org',
        )

        # ── Permissions ──────────────────────────────────────
        cls.perm_view_finance = Permission.objects.create(
            code='finance.view', name='View Finance',
        )
        cls.perm_manage_finance = Permission.objects.create(
            code='finance.manage', name='Manage Finance',
        )
        cls.perm_view_inventory = Permission.objects.create(
            code='inventory.view', name='View Inventory',
        )
        cls.perm_manage_inventory = Permission.objects.create(
            code='inventory.manage', name='Manage Inventory',
        )
        cls.perm_pos_view = Permission.objects.create(
            code='pos.view', name='View POS',
        )

        # ── Roles ────────────────────────────────────────────
        cls.admin_role = Role.objects.create(
            name='Admin', organization=cls.org,
        )
        cls.admin_role.permissions.set([
            cls.perm_view_finance, cls.perm_manage_finance,
            cls.perm_view_inventory, cls.perm_manage_inventory,
            cls.perm_pos_view,
        ])

        cls.cashier_role = Role.objects.create(
            name='Cashier', organization=cls.org,
        )
        cls.cashier_role.permissions.set([cls.perm_pos_view])

        cls.viewer_role = Role.objects.create(
            name='Viewer', organization=cls.org,
        )
        cls.viewer_role.permissions.set([
            cls.perm_view_finance, cls.perm_view_inventory,
        ])

        # ── Users ────────────────────────────────────────────
        cls.admin_user = User.objects.create_user(
            username='admin', password='pass123',
            email='admin@rbac.com', organization=cls.org,
            is_staff=True,
        )
        cls.admin_user.roles = MagicMock()
        cls.admin_user.role = cls.admin_role

        cls.cashier_user = User.objects.create_user(
            username='cashier', password='pass123',
            email='cashier@rbac.com', organization=cls.org,
        )
        cls.cashier_user.role = cls.cashier_role

        cls.viewer_user = User.objects.create_user(
            username='viewer', password='pass123',
            email='viewer@rbac.com', organization=cls.org,
        )
        cls.viewer_user.role = cls.viewer_role

        cls.superuser = User.objects.create_superuser(
            username='super', password='pass123',
            email='super@rbac.com',
        )


class TestHasPermission(PermissionTestBase):
    """Tests for the HasPermission utility."""

    def test_user_has_permission_returns_true(self):
        """User with the permission via their role should return True."""
        has = HasPermission.user_has_permission(self.admin_user, 'finance.view')
        self.assertTrue(has)

    def test_user_without_permission_returns_false(self):
        """User without the permission should return False."""
        has = HasPermission.user_has_permission(self.cashier_user, 'finance.view')
        self.assertFalse(has)

    def test_superuser_bypasses_all_permissions(self):
        """Superusers should have all permissions regardless of role."""
        has = HasPermission.user_has_permission(self.superuser, 'finance.manage')
        self.assertTrue(has)
        has = HasPermission.user_has_permission(self.superuser, 'nonexistent.permission')
        self.assertTrue(has)

    def test_cashier_cannot_access_finance(self):
        """Cashier role should not have finance management permissions."""
        has = HasPermission.user_has_permission(self.cashier_user, 'finance.manage')
        self.assertFalse(has)

    def test_viewer_has_view_but_not_manage(self):
        """Viewer role should have view permissions but not manage."""
        self.assertTrue(HasPermission.user_has_permission(self.viewer_user, 'finance.view'))
        self.assertFalse(HasPermission.user_has_permission(self.viewer_user, 'finance.manage'))


class TestIsSuperAdmin(PermissionTestBase):
    """Tests for the IsSuperAdmin permission class."""

    def test_superuser_is_super_admin(self):
        perm = IsSuperAdmin()
        request = MagicMock()
        request.user = self.superuser
        self.assertTrue(perm.has_permission(request, None))

    def test_regular_user_is_not_super_admin(self):
        perm = IsSuperAdmin()
        request = MagicMock()
        request.user = self.admin_user
        self.assertFalse(perm.has_permission(request, None))
