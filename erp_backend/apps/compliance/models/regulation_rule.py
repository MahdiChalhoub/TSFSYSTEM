"""
RegulationRule Model
====================
Auto-matching criteria that link products to regulations.
When a product is created/updated, the system scans all active rules
to find the best match (highest specificity + priority).

Matching criteria: category, country, brand(s), unit, size, parfum.
All criteria are optional — null = wildcard (matches anything).

Specificity scoring:
  - category match: +10
  - country match: +10
  - brand match: +10
  - unit match: +5
  - size_exact match: +15
  - size_range match: +10
  - parfum match: +5
  - priority field: added as bonus
"""
from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from erp.mixins import AuditLogMixin


class RegulationRule(AuditLogMixin, TenantOwnedModel):
    """Criteria for auto-matching products to a regulation."""

    regulation = models.ForeignKey(
        'compliance.PriceRegulation',
        on_delete=models.CASCADE,
        related_name='rules',
        help_text='The regulation this rule enrolls products into'
    )

    # ── Matching Criteria (all nullable = wildcard) ─────────────────
    category = models.ForeignKey(
        'inventory.Category', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
        help_text='Product category to match (e.g., "Huile")'
    )
    product_country = models.ForeignKey(
        'reference.Country', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
        help_text='Product country of origin to match (not regulation jurisdiction)'
    )
    brands = models.ManyToManyField(
        'inventory.Brand', blank=True, related_name='+',
        help_text='Brands to match. Empty = any brand'
    )
    unit = models.ForeignKey(
        'inventory.Unit', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
        help_text='Product unit to match (e.g., Liter, Kg)'
    )
    parfum = models.ForeignKey(
        'inventory.Parfum', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
        help_text='Product parfum/variant to match'
    )

    # ── Size Matching ───────────────────────────────────────────────
    size_exact = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Exact size to match (e.g., 1.00 for 1L)'
    )
    size_min = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Minimum size for range match'
    )
    size_max = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Maximum size for range match'
    )

    # ── Auto Actions ────────────────────────────────────────────────
    auto_create_group = models.BooleanField(
        default=False,
        help_text='Automatically create/link a ProductGroup for matched products'
    )
    price_group = models.ForeignKey(
        'inventory.ProductGroup', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='regulation_rules',
        help_text='ProductGroup to auto-enroll matched products into'
    )

    # ── Priority ────────────────────────────────────────────────────
    priority = models.IntegerField(
        default=0,
        help_text='Higher priority rules are checked first when specificity ties'
    )

    # ── Status ──────────────────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'compliance'
        db_table = 'compliance_regulation_rule'
        ordering = ['-priority', '-id']
        indexes = [
            models.Index(
                fields=['organization', 'is_active'],
                name='rule_active_idx'
            ),
        ]

    def __str__(self):
        parts = []
        if self.category:
            parts.append(f'Cat:{self.category}')
        if self.product_country:
            parts.append(f'Country:{self.product_country}')
        if self.unit:
            parts.append(f'Unit:{self.unit}')
        if self.size_exact is not None:
            parts.append(f'Size={self.size_exact}')
        elif self.size_min or self.size_max:
            parts.append(f'Size:{self.size_min or "?"}-{self.size_max or "?"}')
        criteria = ', '.join(parts) or 'All products'
        return f'Rule → {self.regulation.code}: {criteria}'

    def compute_specificity(self):
        """
        Calculate how specific this rule is.
        Higher specificity = more criteria matched = better match.
        """
        score = 0
        if self.category_id:
            score += 10
        if self.product_country_id:
            score += 10
        if self.brands.exists():
            score += 10
        if self.unit_id:
            score += 5
        if self.size_exact is not None:
            score += 15
        elif self.size_min is not None or self.size_max is not None:
            score += 10
        if self.parfum_id:
            score += 5
        return score + self.priority

    def matches_product(self, product):
        """
        Check if a product matches ALL criteria of this rule.
        Returns False on first non-match.
        """
        # Category
        if self.category_id and product.category_id != self.category_id:
            return False

        # Country of origin
        if self.product_country_id and product.country_id != self.product_country_id:
            return False

        # Brands (M2M — must match one of the listed brands)
        brand_ids = list(self.brands.values_list('id', flat=True))
        if brand_ids and product.brand_id not in brand_ids:
            return False

        # Unit
        if self.unit_id and product.unit_id != self.unit_id:
            return False

        # Size — exact
        if self.size_exact is not None:
            product_size = product.size or 0
            if product_size != self.size_exact:
                return False

        # Size — range
        if self.size_min is not None:
            product_size = product.size or 0
            if product_size < self.size_min:
                return False
        if self.size_max is not None:
            product_size = product.size or 0
            if product_size > self.size_max:
                return False

        # Parfum
        if self.parfum_id and product.parfum_id != self.parfum_id:
            return False

        return True
