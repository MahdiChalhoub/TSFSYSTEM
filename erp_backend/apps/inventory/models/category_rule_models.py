"""
Category Creation Rules — per-category defaults and requirements for product creation.

Governs:
- Required fields per category
- Default barcode policy overrides
- Packaging requirements
- Completeness overrides
- Print/label behavior
"""
from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class CategoryCreationRule(AuditLogMixin, TenantOwnedModel):
    """
    Per-category product creation policy.
    Singleton per category — governs what happens when a product is created in this category.
    """
    category = models.OneToOneField(
        'inventory.Category', on_delete=models.CASCADE,
        related_name='creation_rule',
    )

    # ── Required Fields ──────────────────────────────────────────────
    requires_barcode = models.BooleanField(default=False,
        help_text='Product must have a barcode before saving')
    requires_brand = models.BooleanField(default=False,
        help_text='Brand is mandatory for this category')
    requires_unit = models.BooleanField(default=True,
        help_text='Unit of measure is mandatory')
    requires_packaging = models.BooleanField(default=False,
        help_text='At least one packaging level required')
    requires_photo = models.BooleanField(default=False,
        help_text='Product image is mandatory')
    requires_supplier = models.BooleanField(default=False,
        help_text='At least one supplier must be linked')

    # ── Barcode Policy Override ──────────────────────────────────────
    barcode_prefix = models.CharField(max_length=10, blank=True, default='',
        help_text='Category-specific barcode prefix (overrides org policy)')
    barcode_mode_override = models.CharField(max_length=15, blank=True, default='',
        choices=(
            ('', 'Use org default'),
            ('INTERNAL_AUTO', 'Always auto-generate'),
            ('SUPPLIER', 'Supplier barcode required'),
            ('MANUAL', 'Manual entry only'),
        ),
        help_text='Override org barcode mode for this category')

    # ── Defaults ─────────────────────────────────────────────────────
    default_product_type = models.CharField(max_length=20, blank=True, default='',
        choices=(
            ('', 'Use form selection'),
            ('STANDARD', 'Standard Product'),
            ('COMBO', 'Combo / Bundle'),
            ('SERVICE', 'Service'),
            ('BLANK', 'Blank / Internal'),
            ('FRESH', 'Fresh / Variable Weight'),
        ),
        help_text='Auto-set product_type when category is selected')
    default_unit_id = models.ForeignKey(
        'inventory.Unit', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='default_for_categories',
        help_text='Default unit of measure for products in this category')
    default_tva_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Default TVA rate for products in this category')

    # ── Packaging Templates ──────────────────────────────────────────
    auto_create_packaging = models.BooleanField(default=False,
        help_text='Auto-create packaging levels on product creation')
    packaging_template = models.JSONField(default=list, blank=True,
        help_text='Template for auto-created packaging. Format: [{name, ratio, unit_id}]')

    # ── Completeness Overrides ───────────────────────────────────────
    completeness_profile_override = models.CharField(max_length=20, blank=True, default='',
        choices=(
            ('', 'Use product_type default'),
            ('STANDARD', 'Full L0-L7'),
            ('COMBO', 'L0-L4'),
            ('SERVICE', 'L0-L2'),
        ),
        help_text='Override completeness profile for this category')

    # ── Print / Label ────────────────────────────────────────────────
    auto_print_label = models.BooleanField(default=True,
        help_text='Auto-create print label task on product creation')
    label_template = models.CharField(max_length=50, blank=True, default='',
        help_text='Label template to use (e.g. shelf_label, packaging_label)')
    shelf_placement_required = models.BooleanField(default=True,
        help_text='Auto-create shelf placement task')

    class Meta:
        db_table = 'category_creation_rule'

    def __str__(self):
        return f'Rules for {self.category.name}'
