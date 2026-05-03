"""
Phase 1 + 4 of the scoped-attribute-values feature.

Single source of truth for picking which attribute VALUES are offered
to a given product, and for validating that an assignment respects the
configured scopes.

Philosophy
──────────
- Scope lives on the VALUE (leaf ProductAttribute), not on the GROUP
  (root ProductAttribute) and not on a separate scoped-value table.
- Each scope is a M2M (categories / countries / brands). Empty = universal
  (default for every existing row), populated = restricted.
- Filter logic is "OR with null" — a value is offered when either the
  scope is empty (universal) OR it includes the product's matching field.
- This module is the ONLY place those rules live; pickers, validators,
  imports, reports all read from here so no two consumers can disagree.

Compatibility shim
──────────────────
The model fields (scope_categories / scope_countries / scope_brands) ship
in inventory.0004_attribute_value_scopes. Until that migration applies,
the M2M descriptors won't exist on instances; every helper here checks
for the attribute first and gracefully no-ops (returns the unscoped set,
allows every assignment) so this module is safe to deploy ahead of the
schema change.
"""
from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from typing import Optional

from django.db.models import Q, QuerySet


logger = logging.getLogger(__name__)

# Sentinel — used to detect "field doesn't exist yet" (migration not applied)
_NO_FIELD = object()


# ── Internal helpers ─────────────────────────────────────────────────

def _has_scope_fields(value) -> bool:
    """True if the model has the scope fields (migration applied)."""
    return all(hasattr(value, f) for f in ('scope_categories', 'scope_countries', 'scope_brands'))


def _scope_ids(value, attr: str) -> Optional[set]:
    """
    Returns the set of scope ids on a value for `attr`, or None if the
    field doesn't exist yet (migration not applied) or the M2M is empty
    (== universal). Distinguishing "field missing" vs "field empty" lets
    the caller short-circuit cleanly.
    """
    field = getattr(value, attr, _NO_FIELD)
    if field is _NO_FIELD:
        return None  # Migration not applied yet → treat as universal.
    try:
        ids = set(field.values_list('id', flat=True))
    except Exception:  # pragma: no cover — defensive
        logger.warning('attribute_scope: failed to read %s on value %s', attr, getattr(value, 'pk', '?'))
        return None
    return ids if ids else None  # empty = universal too


# ── Public API ───────────────────────────────────────────────────────

def values_for_product(group, product) -> QuerySet:
    """
    Return the queryset of attribute VALUES (children of `group`) that are
    OFFERED for `product` given its category, country, and brand.

    A value is offered when, for each scope axis, either:
      • the scope M2M is empty (universal value), OR
      • the scope M2M contains the product's matching field id.

    Pass either a saved Product (any model with .category_id / .country_id /
    .brand_id) or a draft dict with those keys. Group is a root
    ProductAttribute (parent=null).

    The query is org-scoped via the inherited TenantOwnedModel manager
    (`group.children` already restricts to the group's tenant).
    """
    qs = group.children.all()  # children of a root attribute group

    # Extract scope keys. dict-like or model instance.
    cat_id = _read(product, 'category_id') or _read(product, 'category')
    cou_id = _read(product, 'country_of_origin_id') or _read(product, 'country_id') or _read(product, 'country')
    bra_id = _read(product, 'brand_id') or _read(product, 'brand')

    # If the model doesn't have the scope fields yet (migration not applied)
    # the .filter calls will raise FieldError. Detect by inspecting the
    # model class once.
    Model = qs.model
    has_fields = all(
        any(f.name == n for f in Model._meta.get_fields())
        for n in ('scope_categories', 'scope_countries', 'scope_brands')
    )
    if not has_fields:
        return qs  # Pre-migration → behave as before (no scope filtering).

    # Standard "OR with null" — empty M2M means universal.
    qs = qs.filter(Q(scope_categories__isnull=True) | Q(scope_categories=cat_id) if cat_id is not None else Q(scope_categories__isnull=True))
    qs = qs.filter(Q(scope_countries__isnull=True)  | Q(scope_countries=cou_id) if cou_id is not None else Q(scope_countries__isnull=True))
    qs = qs.filter(Q(scope_brands__isnull=True)     | Q(scope_brands=bra_id)    if bra_id is not None else Q(scope_brands__isnull=True))

    return qs.distinct()


# ── Phase 4: thread-local override flag for the m2m_changed signal ──
# When assign_attribute_value(force=True) runs the underlying .add(), the
# pre_add receiver in apps.inventory.signals checks this flag to know it
# was a sanctioned override and shouldn't raise. We use a thread-local so
# concurrent requests on the same gunicorn worker don't share the flag.
_local = threading.local()


@contextmanager
def _scope_override():
    """Mark the current thread as inside a sanctioned scope override."""
    setattr(_local, 'override', True)
    try:
        yield
    finally:
        setattr(_local, 'override', False)


def is_scope_override_active() -> bool:
    """True when the current thread is inside an assign_attribute_value(force=True)."""
    return bool(getattr(_local, 'override', False))


def assign_attribute_value(product, value, *, force: bool = False) -> None:
    """
    Add `value` to product.attribute_values, validating the scope first.

    Raises ScopeViolation when the value's scope excludes the product's
    category / country / brand — unless force=True is passed (the
    operator explicitly overrode in the UI). Force-overrides are logged
    so audit can surface them.

    This is the ONLY supported way to assign a value. Bare
    `product.attribute_values.add(value)` calls also go through the
    pre_add m2m signal (Phase 4), which calls check_scope and raises
    ScopeViolation unless the thread-local override flag is active —
    so the protection holds even if a caller bypasses this helper.
    """
    violations = check_scope(product, value)
    if violations and not force:
        raise ScopeViolation(product, value, violations)

    if violations and force:
        logger.info(
            'attribute_scope: FORCE override — product=%s value=%s violations=%s',
            getattr(product, 'pk', '?'), getattr(value, 'pk', '?'), violations,
        )

    # Wrap in the override context so the m2m_changed pre_add signal
    # knows this .add() call already went through validation.
    with _scope_override():
        product.attribute_values.add(value)


def check_scope(product, value) -> list[str]:
    """
    Return a list of human-readable scope violations for assigning
    `value` to `product`. Empty list = clean.

    Each entry names the axis that failed (e.g. "category", "country",
    "brand") so callers can render a precise error message.
    """
    if not _has_scope_fields(value):
        return []  # Pre-migration → no validation possible, allow.

    violations = []

    cat_scope = _scope_ids(value, 'scope_categories')
    if cat_scope is not None:
        cat_id = _read(product, 'category_id') or _read(product, 'category')
        if cat_id not in cat_scope:
            violations.append('category')

    cou_scope = _scope_ids(value, 'scope_countries')
    if cou_scope is not None:
        cou_id = _read(product, 'country_of_origin_id') or _read(product, 'country_id') or _read(product, 'country')
        if cou_id not in cou_scope:
            violations.append('country')

    bra_scope = _scope_ids(value, 'scope_brands')
    if bra_scope is not None:
        bra_id = _read(product, 'brand_id') or _read(product, 'brand')
        if bra_id not in bra_scope:
            violations.append('brand')

    return violations


def scope_label(value) -> str:
    """
    Render the scope as a one-line chip-friendly string. Used by the
    Attribute Values manager and the product picker.

    Examples:
      'Universal'                              (no scopes set)
      'Juice · Smoothie'                       (categories only)
      'EU · Juice'                             (countries + categories)
      'Coca-Cola brand'                        (brand only)
    """
    if not _has_scope_fields(value):
        return 'Universal'

    parts = []
    cats = list(getattr(value, 'scope_categories').values_list('name', flat=True)) if hasattr(value, 'scope_categories') else []
    cous = list(getattr(value, 'scope_countries').values_list('name', flat=True)) if hasattr(value, 'scope_countries') else []
    bras = list(getattr(value, 'scope_brands').values_list('name', flat=True))    if hasattr(value, 'scope_brands') else []

    if cats: parts.append(' · '.join(cats[:3]) + (f' +{len(cats) - 3}' if len(cats) > 3 else ''))
    if cous: parts.append(' · '.join(cous[:3]) + (f' +{len(cous) - 3}' if len(cous) > 3 else ''))
    if bras: parts.append(' · '.join(bras[:3]) + (f' +{len(bras) - 3}' if len(bras) > 3 else ''))

    return ' / '.join(parts) if parts else 'Universal'


# ── Exceptions ───────────────────────────────────────────────────────

class ScopeViolation(Exception):
    """Raised by assign_attribute_value when a value's scope rejects the product."""
    def __init__(self, product, value, violations: list[str]):
        self.product = product
        self.value = value
        self.violations = violations
        super().__init__(
            f'Attribute value {getattr(value, "pk", "?")} cannot be assigned to '
            f'product {getattr(product, "pk", "?")} — scope mismatch on: {", ".join(violations)}'
        )


# ── Internal: tolerant attribute reader ──────────────────────────────

def _read(obj, attr: str):
    """Read attr from a model OR a dict, returning None if absent."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        v = obj.get(attr)
    else:
        v = getattr(obj, attr, None)
    # FK to-instance — pull pk
    if v is not None and hasattr(v, 'pk'):
        return v.pk
    return v
