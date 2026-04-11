"""
Product Grouping Models — Dual Grouping Architecture.

InventoryGroup:   Stock intelligence, substitution, origin variant tracking.
                  Example: "Persil Small" groups Turkey 180ml, France 200ml, Lebanon 190ml
GroupingRule:      Dynamic auto-generation engine for InventoryGroups.
                  Scans products and auto-creates groups based on matching dimensions.

ProductGroup (existing) is evolved for pricing — see product_models.py.
"""
from django.db import models
from decimal import Decimal
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


# ═══════════════════════════════════════════════════════════════════
#  GROUPING RULE — Auto-generation engine
# ═══════════════════════════════════════════════════════════════════

class GroupingRule(AuditLogMixin, TenantOwnedModel):
    """
    Dynamic rule engine for auto-generating InventoryGroups.

    Each rule defines a set of matching dimensions. When executed, the system
    scans all products and creates groups for products sharing the same values
    across all active dimensions.

    Example rule: "Match Brand + Attribute(Fragrance) + Packaging Family"
    → Creates groups like "Persil Rose Small", "Persil Blue Large", etc.
    """
    name = models.CharField(max_length=200, help_text='Rule display name')
    description = models.TextField(null=True, blank=True)

    # ── Matching Dimensions (active ones form the grouping key) ──
    match_brand = models.BooleanField(
        default=True,
        help_text='Group by same brand'
    )
    match_category = models.BooleanField(
        default=False,
        help_text='Group by same product category'
    )
    match_parfum = models.BooleanField(
        default=False,
        help_text='Group by same parfum/fragrance (Parfum model)'
    )
    match_attribute = models.ForeignKey(
        'inventory.ProductAttribute', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='grouping_rules',
        help_text='Specific attribute to match on (e.g. "Size", "Color")'
    )
    match_packaging_family = models.BooleanField(
        default=False,
        help_text='Group products with same/similar packaging structure'
    )
    match_packaging_name_pattern = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Packaging name pattern to match, e.g. "Carton", "Pack%"'
    )
    match_size_range = models.BooleanField(
        default=False,
        help_text='Group products within similar size ranges'
    )
    size_tolerance_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('10.00'),
        help_text='Size tolerance percentage for SIMILAR grouping (e.g. 10 = ±10%)'
    )

    # ── Group Creation Behavior ──
    GROUP_TYPE_CHOICES = (
        ('EXACT', 'Exact Twins'),
        ('SIMILAR', 'Similar Substitute'),
        ('FAMILY', 'Product Family'),
    )
    default_group_type = models.CharField(
        max_length=10, choices=GROUP_TYPE_CHOICES, default='EXACT',
        help_text='Type assigned to auto-generated groups'
    )
    auto_approve = models.BooleanField(
        default=False,
        help_text='Auto-approve generated groups (vs queue for manual approval)'
    )
    auto_name_template = models.CharField(
        max_length=300, blank=True, default='{brand} {attribute} {size}',
        help_text='Template for auto-generated group names. Vars: {brand}, {attribute}, {category}, {parfum}, {size}'
    )

    # ── Status ──
    is_active = models.BooleanField(default=True)
    last_executed_at = models.DateTimeField(null=True, blank=True)
    groups_created_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'product_grouping_rule'
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'organization'],
                name='unique_grouping_rule_name_tenant'
            )
        ]
        ordering = ['-is_active', 'name']

    def __str__(self):
        dims = []
        if self.match_brand: dims.append('Brand')
        if self.match_category: dims.append('Category')
        if self.match_parfum: dims.append('Parfum')
        if self.match_attribute_id: dims.append(f'Attr:{self.match_attribute_id}')
        if self.match_packaging_family: dims.append('Packaging')
        if self.match_size_range: dims.append('Size')
        return f"{self.name} [{'+'.join(dims) or 'No dims'}]"


# ═══════════════════════════════════════════════════════════════════
#  INVENTORY GROUP — Stock intelligence & substitution tracking
# ═══════════════════════════════════════════════════════════════════

class InventoryGroup(AuditLogMixin, TenantOwnedModel):
    """
    Group products for stock aggregation, substitution intelligence,
    and origin variant tracking.

    Use cases:
    - Same product from different countries (Persil Small TR/FR/LB)
    - Substitute products (different brands, same purpose)
    - Product family grouping (all Persil sizes for analytics)

    ⚠️ Stock is NEVER merged physically — only computed virtually for decisions.
    """
    GROUP_TYPES = (
        ('EXACT', 'Exact Twins'),          # Same product, different origin/supplier
        ('SIMILAR', 'Similar Substitute'),  # Commercially interchangeable
        ('FAMILY', 'Product Family'),       # Broader grouping for analytics
    )

    APPROVAL_STATUS = (
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    name = models.CharField(max_length=255, help_text='e.g. "Persil Small", "Rice 5kg Equivalent"')
    group_type = models.CharField(max_length=10, choices=GROUP_TYPES, default='EXACT')
    brand = models.ForeignKey(
        'inventory.Brand', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='inventory_groups',
        help_text='Optional brand filter for this group'
    )
    commercial_size_label = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Commercial size tier: Small / Medium / Large / etc.'
    )
    description = models.TextField(null=True, blank=True)

    # ── Auto-generation metadata ──
    grouping_rule = models.ForeignKey(
        GroupingRule, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='generated_groups',
        help_text='Rule that auto-generated this group (null = manual)'
    )
    is_auto_generated = models.BooleanField(
        default=False,
        help_text='Whether this group was created by a GroupingRule'
    )
    approval_status = models.CharField(
        max_length=10, choices=APPROVAL_STATUS, default='APPROVED',
        help_text='Approval workflow for auto-generated groups'
    )
    approved_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_inventory_groups',
        help_text='Who approved this auto-generated group'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'inventory_group'
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'organization'],
                name='unique_invgroup_name_tenant'
            )
        ]
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_group_type_display()})"


class InventoryGroupMember(AuditLogMixin, TenantOwnedModel):
    """
    Link a product to an InventoryGroup with substitution metadata.

    Each member retains its own stock, cost, barcode, supplier — the group
    only provides virtual aggregation and intelligence overlays.
    """
    SUBSTITUTION_ROLES = (
        ('PRIMARY', 'Primary Reference'),    # The "default" or preferred variant
        ('TWIN', 'Exact Twin'),              # Identical to primary, different source
        ('SUBSTITUTE', 'Acceptable Substitute'),  # Not identical but interchangeable
        ('NOT_SUB', 'Not Substitutable'),    # In group for analytics only
    )

    group = models.ForeignKey(
        InventoryGroup, on_delete=models.CASCADE, related_name='members'
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE, related_name='inventory_group_memberships'
    )
    substitution_role = models.CharField(
        max_length=10, choices=SUBSTITUTION_ROLES, default='TWIN'
    )
    substitution_priority = models.PositiveIntegerField(
        default=10,
        help_text='Lower = more preferred substitute. Primary reference should be 1.'
    )
    origin_label = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Display label: "Turkey 180ml", "France 200ml". Auto-generated if blank.'
    )
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'inventory_group_member'
        constraints = [
            models.UniqueConstraint(
                fields=['group', 'product', 'organization'],
                name='unique_invgroup_member_tenant'
            )
        ]
        ordering = ['substitution_priority', 'substitution_role']

    def __str__(self):
        return f"{self.product.name} in {self.group.name} ({self.get_substitution_role_display()})"

    def save(self, *args, **kwargs):
        # Auto-generate origin_label from product country + size if blank
        if not self.origin_label and self.product_id:
            try:
                product = self.product
                parts = []
                if product.country_of_origin:
                    parts.append(product.country_of_origin.name)
                elif product.country:
                    parts.append(str(product.country))
                if product.size and product.size_unit:
                    parts.append(f"{product.size}{product.size_unit.short_name or product.size_unit.code}")
                self.origin_label = ' '.join(parts) if parts else None
            except Exception:
                pass
        super().save(*args, **kwargs)
