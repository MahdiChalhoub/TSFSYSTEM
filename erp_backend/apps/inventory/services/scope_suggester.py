"""
Phase 3 of the scoped-attribute-values feature.

Scans every leaf attribute value and proposes scopes (categories,
countries, brands) based on the observed usage pattern across the
tenant's products.

Heuristic
─────────
For each value V (a leaf ProductAttribute), gather every Product P that
already has V in P.attribute_values. Then:

  • categories observed = { P.category_id for P in products }
  • countries  observed = { P.country_id  for P in products }
  • brands     observed = { P.brand_id    for P in products }

If a value's observed set on an axis is non-empty AND smaller than the
total set of categories / countries / brands the org uses (i.e. the
value isn't already universal in practice), suggest scoping it to the
observed set.

A "confidence" score per axis lets operators sort or filter the
suggestion list:

    confidence = used_count / max(used_count + 5, 5)

The +5 smoothing prevents tiny samples (1 product) from looking like
strong signals. A value used by 50 products in a single category gives
~0.91 confidence; one used by 1 product gives ~0.17.

Output
──────
A list of dicts ready to render in the operator review wizard:

  {
    'value_id': 42,
    'value_name': 'Mango',
    'group_id':   12,
    'group_name': 'Flavor',
    'product_count': 27,
    'current_scope': {
        'categories': [...], 'countries': [...], 'brands': [...]
    },
    'suggested_scope': {
        'categories': [{'id': 5, 'name': 'Juice'}, {'id': 9, 'name': 'Smoothie'}],
        'countries':  [...],
        'brands':     [...],
    },
    'confidence':   {'categories': 0.83, 'countries': 0.45, 'brands': 0.0},
  }

The wizard PATCHes accepted suggestions back via the dedicated
add-scope / remove-scope endpoints (Phase 5 also surfaces an audit
diff for each change).
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Iterable

from django.apps import apps as django_apps


logger = logging.getLogger(__name__)


def suggest_scopes(organization, *, value_ids: Iterable[int] | None = None) -> list[dict]:
    """
    Run the suggestion analysis for one tenant.

    Args:
        organization: the tenant Organization instance.
        value_ids:    optional filter — only analyse these value ids.
                      Useful to refresh suggestions for a single value
                      after a bulk import.

    Returns:
        List of suggestion dicts ordered by total confidence descending
        so the most actionable suggestions float to the top of the
        wizard.
    """
    ProductAttribute = django_apps.get_model('inventory', 'ProductAttribute')
    Product = django_apps.get_model('inventory', 'Product')

    # Pre-migration safety: if scope_categories doesn't exist yet, the
    # scope-reading code paths short-circuit and we treat current scope
    # as universal everywhere. The suggestions still work — they just
    # default to an empty current_scope.
    has_scope_fields = all(
        any(f.name == n for f in ProductAttribute._meta.get_fields())
        for n in ('scope_categories', 'scope_countries', 'scope_brands')
    )

    # All leaf values for the tenant.
    values_qs = ProductAttribute.objects.filter(
        organization=organization, parent__isnull=False,
    ).select_related('parent')
    if value_ids is not None:
        values_qs = values_qs.filter(id__in=list(value_ids))

    # Build product-keyed lookup once: {value_id -> [(category_id, country_id, brand_id, product_id, product_name), ...]}
    # via the Product.attribute_values M2M through table. Pull the
    # product id+name too so each suggestion can show a sample of which
    # products actually use the value — operators won't accept a
    # suggestion they can't verify.
    M2M = Product.attribute_values.through
    rows = (
        M2M.objects
        .filter(product__organization=organization, productattribute__organization=organization)
        .values_list(
            'productattribute_id',
            'product__category_id',
            'product__country_of_origin_id',
            'product__brand_id',
            'product_id',
            'product__name',
        )
    )
    usage: dict[int, list[tuple]] = defaultdict(list)
    for value_id, cat_id, cou_id, bra_id, prod_id, prod_name in rows:
        usage[value_id].append((cat_id, cou_id, bra_id, prod_id, prod_name))

    # Resolve names in bulk — single query per axis instead of N+1.
    Category = django_apps.get_model('inventory', 'Category')
    try:
        Country = django_apps.get_model('reference', 'Country')
    except LookupError:
        Country = django_apps.get_model('erp', 'Country')  # legacy fallback
    Brand = django_apps.get_model('inventory', 'Brand')

    cat_names = dict(Category.objects.filter(organization=organization).values_list('id', 'name'))
    cou_names = dict(Country.objects.values_list('id', 'name'))
    bra_names = dict(Brand.objects.filter(organization=organization).values_list('id', 'name'))

    suggestions: list[dict] = []

    for value in values_qs:
        records = usage.get(value.id, [])
        if not records:
            continue  # No products use this value yet → no signal to suggest from.

        cats_used = {r[0] for r in records if r[0] is not None}
        cous_used = {r[1] for r in records if r[1] is not None}
        bras_used = {r[2] for r in records if r[2] is not None}

        product_count = len(records)
        # First 8 products that use this value, ordered by name for a
        # stable preview. The wizard renders these in an expandable
        # details element so the operator can verify which products
        # they're actually scoping before clicking Accept.
        seen_pids: set[int] = set()
        products_sample: list[dict] = []
        for r in records:
            pid = r[3]
            if pid in seen_pids:
                continue
            seen_pids.add(pid)
            products_sample.append({'id': pid, 'name': r[4] or f'#{pid}'})
            if len(products_sample) >= 8:
                break
        products_sample.sort(key=lambda p: p['name'].lower())

        # Read current scope (post-migration only). Pre-migration → empty
        # everywhere means "universal", suggestion has the most to add.
        cur_cats = set(value.scope_categories.values_list('id', flat=True)) if has_scope_fields else set()
        cur_cous = set(value.scope_countries.values_list('id', flat=True)) if has_scope_fields else set()
        cur_bras = set(value.scope_brands.values_list('id', flat=True))    if has_scope_fields else set()

        # Confidence smoothing — see module docstring.
        conf_cats = len(cats_used) and product_count / max(product_count + 5, 5) or 0.0
        conf_cous = len(cous_used) and product_count / max(product_count + 5, 5) or 0.0
        conf_bras = len(bras_used) and product_count / max(product_count + 5, 5) or 0.0

        # Don't suggest scopes that match what's already there.
        sug_cats = cats_used - cur_cats
        sug_cous = cous_used - cur_cous
        sug_bras = bras_used - cur_bras

        # If nothing new on any axis, skip — value is already accurate.
        if not (sug_cats or sug_cous or sug_bras):
            continue

        suggestions.append({
            'value_id':    value.id,
            'value_name':  value.name,
            'group_id':    value.parent_id,
            'group_name':  value.parent.name if value.parent else '',
            'product_count': product_count,
            'products_sample': products_sample,
            'products_sample_truncated': product_count > len(products_sample),
            'current_scope': {
                'categories': [{'id': i, 'name': cat_names.get(i, '?')} for i in sorted(cur_cats)],
                'countries':  [{'id': i, 'name': cou_names.get(i, '?')} for i in sorted(cur_cous)],
                'brands':     [{'id': i, 'name': bra_names.get(i, '?')} for i in sorted(cur_bras)],
            },
            'suggested_scope': {
                'categories': [{'id': i, 'name': cat_names.get(i, '?')} for i in sorted(sug_cats)],
                'countries':  [{'id': i, 'name': cou_names.get(i, '?')} for i in sorted(sug_cous)],
                'brands':     [{'id': i, 'name': bra_names.get(i, '?')} for i in sorted(sug_bras)],
            },
            'confidence': {
                'categories': round(conf_cats, 2),
                'countries':  round(conf_cous, 2),
                'brands':     round(conf_bras, 2),
            },
        })

    # Highest confidence suggestions first.
    suggestions.sort(
        key=lambda s: (
            s['confidence']['categories']
            + s['confidence']['countries']
            + s['confidence']['brands']
        ),
        reverse=True,
    )
    return suggestions


def apply_scope_suggestion(value, *, add_categories=None, add_countries=None, add_brands=None) -> dict:
    """
    Apply an accepted suggestion. Adds the listed ids to the value's
    scope M2Ms (idempotent — already-linked ids are no-ops).

    Phase 5: also writes an audit_log entry per axis describing the
    before / after state, so operators can see in the audit trail
    exactly which categories / countries / brands were added to a
    value's scope, and by whom.

    Returns a small audit dict describing what changed so the wizard can
    surface a confirmation toast.
    """
    if not all(hasattr(value, n) for n in ('scope_categories', 'scope_countries', 'scope_brands')):
        # Migration not applied — silently skip rather than crash.
        return {'applied': False, 'reason': 'migration not applied'}

    diff = {'added': {'categories': [], 'countries': [], 'brands': []}, 'before': {}, 'after': {}}

    # Snapshot before — used for the audit log diff.
    diff['before'] = {
        'categories': sorted(value.scope_categories.values_list('id', flat=True)),
        'countries':  sorted(value.scope_countries.values_list('id', flat=True)),
        'brands':     sorted(value.scope_brands.values_list('id', flat=True)),
    }

    if add_categories:
        existing = set(diff['before']['categories'])
        new_ids = [i for i in add_categories if i not in existing]
        if new_ids:
            value.scope_categories.add(*new_ids)
            diff['added']['categories'] = new_ids
    if add_countries:
        existing = set(diff['before']['countries'])
        new_ids = [i for i in add_countries if i not in existing]
        if new_ids:
            value.scope_countries.add(*new_ids)
            diff['added']['countries'] = new_ids
    if add_brands:
        existing = set(diff['before']['brands'])
        new_ids = [i for i in add_brands if i not in existing]
        if new_ids:
            value.scope_brands.add(*new_ids)
            diff['added']['brands'] = new_ids

    diff['applied'] = any(diff['added'].values())

    if diff['applied']:
        diff['after'] = {
            'categories': sorted(value.scope_categories.values_list('id', flat=True)),
            'countries':  sorted(value.scope_countries.values_list('id', flat=True)),
            'brands':     sorted(value.scope_brands.values_list('id', flat=True)),
        }
        # Phase 5: audit log entry. Best-effort — never block the apply
        # on an audit failure (the logger has its own fallback).
        try:
            from kernel.audit.audit_logger import audit_log
            audit_log(
                action='attribute_value.scope_changed',
                resource_type='product_attribute',
                resource_id=value.pk,
                resource_repr=f'{value.parent.name if value.parent else "?"}: {value.name}',
                details={
                    'before': diff['before'],
                    'after':  diff['after'],
                    'added':  diff['added'],
                },
                severity='INFO',
            )
        except Exception as e:  # noqa: BLE001 — audit must never break the operation
            logger.warning('attribute_value.scope_changed audit log failed: %s', e)

    return diff


def impact_of_scope(value, *, add_categories=None, remove_categories=None,
                    add_countries=None, remove_countries=None,
                    add_brands=None,  remove_brands=None) -> dict:
    """
    Phase 5: preview "what would change" before applying a scope edit.

    Returns:
      {
        'products_currently_using_value':  N,
        'products_that_would_lose_access': N,   # because newly out-of-scope
        'losers_sample': [{id, name}, ...],     # first 10 affected products
      }

    Operator UI shows this in a confirm dialog so a destructive scope
    narrowing surfaces its blast radius before the click.
    """
    from django.apps import apps as django_apps
    from django.db.models import Q

    Product = django_apps.get_model('inventory', 'Product')

    # Current set on each axis (post-edit prediction).
    cur_cats = set(value.scope_categories.values_list('id', flat=True))
    cur_cous = set(value.scope_countries.values_list('id', flat=True))
    cur_bras = set(value.scope_brands.values_list('id', flat=True))

    new_cats = (cur_cats | set(add_categories or [])) - set(remove_categories or [])
    new_cous = (cur_cous | set(add_countries or []))  - set(remove_countries or [])
    new_bras = (cur_bras | set(add_brands or []))     - set(remove_brands or [])

    using = Product.objects.filter(attribute_values=value)
    total = using.count()

    # A product loses access when, for any axis where the new scope is
    # NON-empty, the product's matching field id is NOT in the new set.
    losers = using
    if new_cats:
        losers = losers.exclude(category_id__in=new_cats).exclude(category_id__isnull=True) | losers.filter(category_id__isnull=True).none()
        # Above: products whose category isn't in the new categorical
        # scope are losers. Products with NULL category fall through to
        # universal-by-axis behaviour — they would still match.
        losers = using.filter(~Q(category_id__in=new_cats) & Q(category_id__isnull=False))
    if new_cous:
        losers = losers | using.filter(~Q(country_of_origin_id__in=new_cous) & Q(country_of_origin_id__isnull=False))
    if new_bras:
        losers = losers | using.filter(~Q(brand_id__in=new_bras) & Q(brand_id__isnull=False))

    losers = losers.distinct()
    sample = list(losers.values('id', 'name')[:10])

    return {
        'products_currently_using_value':  total,
        'products_that_would_lose_access': losers.count(),
        'losers_sample': sample,
    }
