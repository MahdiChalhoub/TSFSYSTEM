"""
RBAC Models

Core models for role-based access control.
"""

from django.db import models
from django.contrib.auth import get_user_model
from kernel.tenancy.models import TenantOwnedModel
from erp.models import Organization as Tenant

User = get_user_model()


class Permission(models.Model):
    """
    System-wide permissions.

    Format: {module}.{action}_{resource}

    Examples:
    - finance.create_invoice
    - finance.view_invoice
    - finance.delete_invoice
    - inventory.adjust_stock
    - pos.open_register
    """

    code = models.CharField(
        max_length=100,
        unique=True,
        help_text="Format: module.action_resource (e.g., finance.create_invoice)"
    )

    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)

    # Module grouping
    module = models.CharField(max_length=50, db_index=True, null=True, blank=True)

    # Permission metadata
    is_dangerous = models.BooleanField(
        default=False,
        help_text="Mark as dangerous (delete, modify critical data)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'erp'
        db_table = 'kernel_permission'
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['module']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Role(TenantOwnedModel):
    """
    Roles within a tenant.

    Examples:
    - Admin
    - Accountant
    - Cashier
    - Warehouse Manager
    - Sales Rep
    """

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    # Permissions granted to this role
    permissions = models.ManyToManyField(Permission, related_name='roles', blank=True)

    # Role hierarchy (optional)
    parent_role = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_roles',
        help_text="Inherit permissions from parent role"
    )

    # Built-in roles (cannot be deleted)
    is_system_role = models.BooleanField(default=False)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'erp'
        db_table = 'kernel_role'
        unique_together = [['tenant', 'name']]
        indexes = [
            models.Index(fields=['tenant', 'name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.tenant.name})"

    def get_all_permissions(self):
        """
        Get all permissions including inherited from parent.

        Returns:
            QuerySet of Permission objects
        """
        perms = set(self.permissions.all())

        # Inherit from parent recursively
        if self.parent_role:
            perms.update(self.parent_role.get_all_permissions())

        return list(perms)

    def has_permission(self, permission_code: str) -> bool:
        """
        Check if role has a specific permission.

        Args:
            permission_code: Permission code (e.g., 'finance.create_invoice')

        Returns:
            bool
        """
        all_perms = self.get_all_permissions()
        return any(p.code == permission_code for p in all_perms)


class UserRole(TenantOwnedModel):
    """
    User-to-Role assignment within a tenant.

    A user can have multiple roles in a tenant.
    A user can belong to multiple tenants with different roles.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_assignments')

    # Optional: Resource-level role (e.g., "Manager of Warehouse A")
    resource_type = models.CharField(max_length=50, blank=True, null=True)
    resource_id = models.IntegerField(blank=True, null=True)

    # Temporal permissions (optional)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'erp'
        db_table = 'kernel_user_role'
        unique_together = [['tenant', 'user', 'role', 'resource_type', 'resource_id']]
        indexes = [
            models.Index(fields=['tenant', 'user']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return f"{self.user} - {self.role.name} ({self.tenant.name})"

    def is_valid(self):
        """
        Check if role assignment is currently valid (time-based).

        Returns:
            bool
        """
        from django.utils import timezone
        now = timezone.now()

        if self.valid_from and now < self.valid_from:
            return False

        if self.valid_until and now > self.valid_until:
            return False

        return True


class ResourcePermission(TenantOwnedModel):
    """
    Resource-level permissions (advanced feature).

    Allows granting permissions on specific resources.

    Example:
    - User X can view Invoice #123
    - User Y can edit Product #456
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    # Resource identification
    resource_type = models.CharField(max_length=50)  # e.g., 'invoice', 'product'
    resource_id = models.IntegerField()

    # Grant/Revoke
    granted = models.BooleanField(default=True)

    # Audit
    granted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='granted_permissions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'erp'
        db_table = 'kernel_resource_permission'
        unique_together = [['tenant', 'user', 'permission', 'resource_type', 'resource_id']]
        indexes = [
            models.Index(fields=['tenant', 'user', 'resource_type', 'resource_id']),
        ]

    def __str__(self):
        return f"{self.user} - {self.permission.code} on {self.resource_type}#{self.resource_id}"
