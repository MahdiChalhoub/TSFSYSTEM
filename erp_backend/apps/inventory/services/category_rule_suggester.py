"""
Phase 7 of the AI assistant feature — category creation-rule suggester.

For every category that doesn't yet have a `CategoryCreationRule`, this
module derives a candidate rule by observing the products already
inside the category. The pattern mirrors the Phase 3 scope-suggester:

    Deterministic pass            (this module — services.category_rule_suggester)
        ↓
    AI ranker (Phase 7)           (services.category_rule_ai_ranker)
        ↓
    Operator wizard               (UI: /inventory/categories/rule-wizard)
        ↓
    Apply → CategoryCreationRule  (one row per accepted suggestion)

Heuristic
─────────
For each category C with N >= 3 products and no existing rule:

  • requires_barcode  := every product in C has a barcode
  • requires_brand    := every product in C has a brand FK set
  • requires_unit     := every product in C has a unit FK set
  • requires_photo    := every product in C has an image_url
  • requires_supplier := every product in C has at least one linked supplier

Each `requires_*` flag flips ON only when the observation is unanimous.
We never suggest flipping a flag OFF, because that's a less-actionable
recommendation (operator already knows policy is too strict; the
deterministic pass can't tell *why* a single product lacks a barcode).

A small completeness score (% of `requires_*` flags that triggered)
sorts the wizard so the most opinionated suggestions float to the top.
"""
from __future__ import annotations

import logging
from typing import Iterable

from django.apps import apps as django_apps


logger = logging.getLogger(__name__)


# How many products a category needs before we'll suggest a rule. With
# fewer than this, "every product has a barcode" is too easy to satisfy
# and would emit noisy false positives.
MIN_PRODUCTS_FOR_SUGGESTION = 3


def suggest_category_rules(organization, *, category_ids: Iterable[int] | None = None) -> list[dict]:
    """
    Walk every rule-less category in the organization, observe its
    products, and emit a candidate `CategoryCreationRule` payload that
    the wizard can present for accept/skip.

    Args:
        organization: tenant Organization instance
        category_ids: optional id whitelist — useful when refreshing a
                      single suggestion after a bulk import

    Returns:
        List of suggestion dicts ordered by completeness_score desc:

          {
            'category_id':   12,
            'category_name': 'Soft Drinks',
            'product_count': 27,
            'products_sample': [{'id': ..., 'name': ...}, ...],   # up to 8
            'products_sample_truncated': bool,
            'suggested_rule': {
                'requires_barcode':  True,
                'requires_brand':    True,
                'requires_unit':     True,
                'requires_photo':    False,
                'requires_supplier': False,
            },
            'completeness_score': 0.6,   # 3 of 5 requires_* flipped on
          }
    """
    Category = django_apps.get_model('inventory', 'Category')
    Product = django_apps.get_model('inventory', 'Product')

    # Scoping policy: only categories that don't already have a rule.
    cats_qs = Category.objects.filter(organization=organization, creation_rule__isnull=True)
    if category_ids is not None:
        cats_qs = cats_qs.filter(id__in=list(category_ids))

    # Pull names in bulk so we don't N+1 inside the loop.
    cat_rows = list(cats_qs.values('id', 'name'))
    if not cat_rows:
        return []

    cat_ids = [c['id'] for c in cat_rows]

    # Pull only the columns we need from products. `image_url` may not
    # exist on every deployment — wrap in a try.
    product_fields = ['id', 'name', 'category_id', 'barcode', 'brand_id', 'base_unit_id', 'image_url']
    try:
        prod_rows = list(
            Product.objects
            .filter(organization=organization, is_active=True, category_id__in=cat_ids)
            .values(*product_fields)
        )
    except Exception:
        # Older deployments may lack base_unit_id; degrade gracefully.
        product_fields = ['id', 'name', 'category_id', 'barcode', 'brand_id', 'image_url']
        prod_rows = list(
            Product.objects
            .filter(organization=organization, is_active=True, category_id__in=cat_ids)
            .values(*product_fields)
        )

    # Group products by category for the observation pass.
    by_cat: dict[int, list[dict]] = {}
    for r in prod_rows:
        by_cat.setdefault(r['category_id'], []).append(r)

    # Suppliers M2M lookup is heavier — only check it when we have
    # enough products to consider the category. Fetch in bulk.
    SupplierLink = None
    try:
        SupplierLink = Product.suppliers.through
    except Exception:
        SupplierLink = None

    supplier_counts: dict[int, set[int]] = {}
    if SupplierLink is not None:
        try:
            for row in SupplierLink.objects.filter(product__in=[p['id'] for p in prod_rows]).values_list('product_id', flat=True):
                supplier_counts.setdefault(row, set()).add(row)
        except Exception as e:  # noqa: BLE001 — defensive: m2m may differ
            logger.warning('category_rule_suggester: supplier link probe failed: %s', e)

    suggestions: list[dict] = []
    for c in cat_rows:
        prods = by_cat.get(c['id'], [])
        if len(prods) < MIN_PRODUCTS_FOR_SUGGESTION:
            continue

        # Observation pass — flag flips ON only when unanimous.
        has_barcode  = all(bool(p.get('barcode')) for p in prods)
        has_brand    = all(p.get('brand_id') is not None for p in prods)
        has_unit     = all(p.get('base_unit_id') is not None for p in prods) if 'base_unit_id' in product_fields else False
        has_photo    = all(bool(p.get('image_url')) for p in prods)
        has_supplier = all(p['id'] in supplier_counts for p in prods)

        rule = {
            'requires_barcode':  has_barcode,
            'requires_brand':    has_brand,
            'requires_unit':     has_unit,
            'requires_photo':    has_photo,
            'requires_supplier': has_supplier,
        }
        on_count = sum(rule.values())
        if on_count == 0:
            # Nothing actionable — the category isn't opinionated enough
            # to produce a useful rule yet.
            continue

        sample = sorted(
            [{'id': p['id'], 'name': p['name'] or f"#{p['id']}"} for p in prods[:8]],
            key=lambda x: x['name'].lower(),
        )

        suggestions.append({
            'category_id': c['id'],
            'category_name': c['name'],
            'product_count': len(prods),
            'products_sample': sample,
            'products_sample_truncated': len(prods) > len(sample),
            'suggested_rule': rule,
            'completeness_score': round(on_count / 5.0, 2),
        })

    suggestions.sort(key=lambda s: s['completeness_score'], reverse=True)
    return suggestions


def apply_category_rule_suggestion(category, *, rule_fields: dict) -> dict:
    """
    Create the CategoryCreationRule from an accepted suggestion. Idempotent
    on re-apply — if a rule already exists, returns it without overwriting.
    """
    CategoryCreationRule = django_apps.get_model('inventory', 'CategoryCreationRule')
    existing = CategoryCreationRule.objects.filter(category=category).first()
    if existing:
        return {'applied': False, 'reason': 'rule already exists', 'rule_id': existing.id}

    safe_fields = {
        k: bool(rule_fields.get(k, False))
        for k in ('requires_barcode', 'requires_brand', 'requires_unit',
                  'requires_photo', 'requires_supplier')
    }
    rule = CategoryCreationRule.objects.create(
        organization=category.organization,
        category=category,
        **safe_fields,
    )
    return {'applied': True, 'rule_id': rule.id, 'fields': safe_fields}
