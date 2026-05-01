from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from decimal import Decimal
from django.utils.translation import gettext_lazy as _
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from erp.mixins import ReferenceCodeMixin


class Warehouse(ReferenceCodeMixin, AuditLogMixin, TenantOwnedModel):
    """
    Unified location model — replaces both Site and Warehouse.
    A Warehouse can be a Branch/Site (top-level), a Store, a Warehouse, or Virtual.
    Hierarchy: parent → children (e.g., Branch → Store → Warehouse)
    """
    SEQUENCE_KEY = 'WAREHOUSE'
    SEQUENCE_PREFIX = 'WH-'
    SEQUENCE_PADDING = 5
    LOCATION_TYPES = (
        ('BRANCH', 'Branch / Site'),   # Top-level, replaces old "Site"
        ('STORE', 'Store'),            # Retail point of sale
        ('WAREHOUSE', 'Warehouse'),     # Pure storage
        ('VIRTUAL', 'Virtual'),         # Virtual / transit
    )

    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children',
        help_text='Parent location (e.g., a branch contains warehouses)'
    )

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    location_type = models.CharField(max_length=20, choices=LOCATION_TYPES, default='WAREHOUSE')

    # ── Physical address (from old Site model) ──
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    country = models.ForeignKey(
        'reference.Country', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='warehouses',
        help_text='Country this location operates in (multi-country feature)'
    )
    vat_number = models.CharField(max_length=100, null=True, blank=True)

    # ── Tax engine override (Phase 2) ──
    TAX_POLICY_MODES = (
        ('INHERIT', 'Inherit from Organization'),
        ('CUSTOM', 'Custom Tax Policy'),
    )
    tax_policy_mode = models.CharField(
        max_length=20, choices=TAX_POLICY_MODES, default='INHERIT',
        help_text='Whether this branch uses the org default tax policy or a custom one'
    )
    tax_policy = models.ForeignKey(
        'finance.OrgTaxPolicy', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='branch_overrides',
        help_text='Custom tax policy for this branch. Only used when tax_policy_mode=CUSTOM.'
    )

    # ── Product sharing rules (Phase 2) ──
    SHARING_SCOPES = (
        ('NONE', 'No Sharing'),
        ('SAME_COUNTRY', 'Same Country Branches'),
        ('SELECTED', 'Selected Branches Only'),
        ('ALL', 'All Branches in Organization'),
    )
    product_sharing_scope = models.CharField(
        max_length=20, choices=SHARING_SCOPES, default='NONE',
        help_text='Controls which other branches can see/sell products from this location'
    )
    product_sharing_targets = models.ManyToManyField(
        'self', blank=True, symmetrical=False,
        related_name='shared_product_sources',
        help_text='Specific branches that can access this location\'s products (for SELECTED scope)'
    )

    # ── Operational flags ──
    can_sell = models.BooleanField(default=True,
        help_text='Can products be sold directly from this location?')
    is_active = models.BooleanField(default=True)
    legacy_id = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'warehouse'
        unique_together = ('code', 'organization')

    def __str__(self):
        prefix = dict(self.LOCATION_TYPES).get(self.location_type, '')
        return f"{self.name} ({prefix})" if prefix else self.name

    @property
    def is_branch(self):
        return self.location_type == 'BRANCH'

    @property
    def is_store(self):
        return self.location_type == 'STORE'

    @property
    def site_name(self):
        """Backward compat: return the branch/parent name."""
        if self.parent:
            return self.parent.name
        return self.name

    def clean(self):
        """Enforce hierarchy constraints."""
        from django.core.exceptions import ValidationError
        errors = {}

        # Rule: STORE / WAREHOUSE / VIRTUAL must have a parent (branch)
        if self.location_type in ('STORE', 'WAREHOUSE', 'VIRTUAL') and not self.parent:
            errors['parent'] = f'{self.get_location_type_display()} must belong to a Branch.'

        # Rule: parent of non-BRANCH must be a BRANCH (strict 2-level tree)
        if self.parent and self.location_type != 'BRANCH':
            if self.parent.location_type != 'BRANCH':
                errors['parent'] = 'Locations can only be placed directly under a Branch.'

        # Rule: BRANCH cannot be nested under another BRANCH
        if self.location_type == 'BRANCH' and self.parent:
            errors['parent'] = 'Branches are top-level and cannot be nested under another location.'

        # Rule: no self-referencing
        if self.parent_id and self.pk and self.parent_id == self.pk:
            errors['parent'] = 'A location cannot be its own parent.'

        # Rule: BRANCH cannot have can_sell=True
        if self.location_type == 'BRANCH' and self.can_sell:
            self.can_sell = False  # silently fix instead of erroring

        # Rule: BRANCH must have a country
        if self.location_type == 'BRANCH' and not self.country_id:
            errors['country'] = 'Branches must have a country assigned.'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # ── Auto-default country from org's default OrgCountry (BRANCH only) ──
        if self.location_type == 'BRANCH' and not self.country_id and self.organization_id:
            try:
                from erp.connector_registry import connector
                OrgCountry = connector.require(
                    'reference.org_country.get_model', org_id=self.organization_id
                )
                if OrgCountry is not None:
                    default_oc = OrgCountry.objects.filter(
                        organization_id=self.organization_id,
                        is_default=True,
                        is_enabled=True,
                    ).select_related('country').first()
                    if default_oc and default_oc.country_id:
                        self.country_id = default_oc.country_id
            except Exception:
                pass
        # ── Children ALWAYS inherit country from parent branch ──
        if self.parent_id:
            self.country_id = self.parent.country_id
        # ── Validate AFTER defaults resolve ──
        self.clean()
        super().save(*args, **kwargs)
        # ── Cascade country to all children when a BRANCH saves ──
        if self.location_type == 'BRANCH' and self.country_id:
            self._cascade_country_to_children()

    def _cascade_country_to_children(self):
        """Bulk-update all direct children to match this branch's country."""
        updated = self.children.exclude(country_id=self.country_id).update(
            country_id=self.country_id
        )
        if updated:
            import logging
            logging.getLogger('inventory').info(
                f'Cascade country {self.country_id} to {updated} child(ren) of "{self.name}"'
            )

    def get_branch(self):
        """Walk up the parent chain to find the root Branch."""
        node = self
        while node:
            if node.location_type == 'BRANCH':
                return node
            node = node.parent
        return None

    def get_all_children(self):
        """Return all descendant locations (flat queryset)."""
        return Warehouse.objects.filter(parent=self)

    def get_all_descendant_ids(self):
        """Return IDs of self + all descendants (recursive)."""
        ids = [self.id]
        for child in self.children.all():
            ids.extend(child.get_all_descendant_ids())
        return ids



# NOTE: auto_create_branch_children signal removed.
# Branches are created standalone — users add Store/Warehouse children
# manually via the UI, since tenants have location limits.


class Inventory(AuditLogMixin, TenantOwnedModel):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    branch = models.ForeignKey(
        Warehouse, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='branch_inventory', limit_choices_to={'location_type': 'BRANCH'},
        help_text='Auto-derived from warehouse'
    )
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='inventory')
    variant = models.ForeignKey('inventory.ProductVariant', on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_stock')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    expiry_date = models.DateField(null=True, blank=True)
    is_consignment = models.BooleanField(default=False)
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, 
        limit_choices_to={'type': 'SUPPLIER'},
        related_name='consignment_stock'
    )
    consignment_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    batch = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_batches')

    class Meta:
        db_table = 'inventory'
        unique_together = ('warehouse', 'product', 'variant', 'organization')
        indexes = [
            models.Index(fields=['organization', 'branch'], name='inv_tenant_branch_idx'),
        ]


class InventoryMovement(AuditLogMixin, TenantOwnedModel):
    MOVEMENT_TYPES = (
        ('IN', 'Stock In'),
        ('OUT', 'Stock Out'),
        ('ADJUSTMENT', 'Adjustment'),
        ('TRANSFER', 'Transfer'),
    )
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    branch = models.ForeignKey(
        Warehouse, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='branch_movements', limit_choices_to={'location_type': 'BRANCH'},
        help_text='Auto-derived from warehouse'
    )
    type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    reference = models.CharField(max_length=100, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    reason = models.TextField(null=True, blank=True)
    cost_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'inventorymovement'
        indexes = [
            models.Index(fields=['organization', 'branch'], name='invmov_tenant_branch_idx'),
        ]


# ─── Auto-derive branch from warehouse on save ──────────────────────────────

from django.db.models.signals import pre_save  # noqa: E402


def _derive_branch_from_warehouse(instance, warehouse_field='warehouse', branch_field='branch'):
    """Resolve and stamp the branch FK from the warehouse's parent chain."""
    wh = getattr(instance, warehouse_field, None)
    if wh:
        branch = wh.get_branch() if wh.location_type != 'BRANCH' else wh
        setattr(instance, branch_field, branch)


@receiver(pre_save, sender=Inventory)
def derive_inventory_branch(sender, instance, **kwargs):
    _derive_branch_from_warehouse(instance)


@receiver(pre_save, sender=InventoryMovement)
def derive_movement_branch(sender, instance, **kwargs):
    _derive_branch_from_warehouse(instance)
