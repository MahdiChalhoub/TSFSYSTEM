"""
Feature Gate Utility — erp/feature_gate.py
===========================================
Centralized utility for checking whether an organization has access to
a specific feature. Features are gated at TWO levels:

1. **Plan Level** — the org's SubscriptionPlan.limits must allow the feature
2. **Org Level** — the org.settings must have the feature enabled

Usage:
    from erp.feature_gate import has_feature, get_feature_status

    # Simple check
    if has_feature(org, 'multi_currency'):
        # proceed with multi-currency logic

    # Get full status (for UI rendering)
    status = get_feature_status(org, 'multi_currency')
    # → {'enabled': True, 'plan_allows': True, 'plan_name': 'Enterprise'}
"""


# ─── Feature Registry ────────────────────────────────────────────────────────
# Each feature has:
#   - plan_key: key in SubscriptionPlan.limits (bool or int)
#   - org_key: key in Organization.settings (bool)
#   - label: human-readable name
#   - description: what the feature does

FEATURE_REGISTRY = {
    'multi_currency': {
        'plan_key': 'allow_multi_currency',
        'org_key': 'multi_currency_enabled',
        'label': 'Multi-Currency',
        'description': 'Enter transactions in foreign currencies with exchange rate conversion',
        'icon': 'banknote',
    },
    'multi_country': {
        'plan_key': 'allow_multi_country',
        'org_key': 'multi_country_enabled',
        'label': 'Multi-Country Branches',
        'description': 'Assign branches to different countries with per-country tax regimes',
        'icon': 'globe',
    },
    'dual_scope': {
        'plan_key': 'allow_dual_scope',
        'org_key': 'dual_scope_enabled',
        'label': 'Dual View (Official + Internal)',
        'description': 'Maintain parallel official and internal accounting scopes',
        'icon': 'eye',
    },
    'encryption': {
        'plan_key': 'allow_encryption',
        'org_key': 'encryption_enabled',
        'label': 'AES-256 Encryption',
        'description': 'Field-level encryption for sensitive data at rest',
        'icon': 'shield',
    },
}


def _get_plan_limits(org):
    """Extract limits dict from org's subscription plan. Returns {} if no plan."""
    plan = getattr(org, 'current_plan', None)
    if not plan:
        return {}
    return plan.limits if isinstance(plan.limits, dict) else {}


def _get_org_settings(org):
    """Extract settings dict from org. Returns {} if not set."""
    settings = getattr(org, 'settings', None)
    if not settings or not isinstance(settings, dict):
        return {}
    return settings


def _is_super_org(org):
    """Check if org is the SaaS platform owner or on a top-tier plan."""
    # SaaS super-admin org (slug = 'saas' or similar platform owner)
    slug = getattr(org, 'slug', '')
    if slug in ('saas', 'tsf-global', 'platform'):
        return True

    # Top-tier plans unlock everything
    plan = getattr(org, 'current_plan', None)
    if plan:
        plan_name = (getattr(plan, 'name', '') or '').lower()
        if any(tier in plan_name for tier in ('ultimate', 'enterprise', 'unlimited')):
            return True

    return False


def plan_allows(org, feature_key):
    """
    Check if the org's plan allows a feature.
    Returns True if:
      - Org is a super-admin / platform owner / Ultimate plan
      - Feature is in FEATURE_REGISTRY and plan limits has the plan_key set to True/truthy
      - OR the feature key is not in the registry (permissive for unknown features)
    """
    # Super-admin orgs bypass all plan checks
    if _is_super_org(org):
        return True

    feature = FEATURE_REGISTRY.get(feature_key)
    if not feature:
        return True  # Unknown features are allowed by default

    limits = _get_plan_limits(org)
    plan_key = feature['plan_key']

    # If key not present in limits, feature is NOT allowed (restrictive default)
    return bool(limits.get(plan_key, False))


def org_enabled(org, feature_key):
    """Check if the org has enabled the feature in its settings."""
    feature = FEATURE_REGISTRY.get(feature_key)
    if not feature:
        return False

    settings = _get_org_settings(org)
    org_key = feature['org_key']
    return bool(settings.get(org_key, False))


def has_feature(org, feature_key):
    """
    Main gate: returns True only if BOTH:
    1. The plan allows the feature
    2. The org has enabled it in settings
    """
    return plan_allows(org, feature_key) and org_enabled(org, feature_key)


def get_feature_status(org, feature_key):
    """
    Get full status for a feature (for UI rendering).
    Returns dict with: enabled, plan_allows, plan_name, label, description, icon
    """
    feature = FEATURE_REGISTRY.get(feature_key, {})
    plan = getattr(org, 'current_plan', None)

    _plan_allows = plan_allows(org, feature_key)
    _org_enabled = org_enabled(org, feature_key)

    return {
        'key': feature_key,
        'enabled': _plan_allows and _org_enabled,
        'plan_allows': _plan_allows,
        'org_enabled': _org_enabled,
        'plan_name': plan.name if plan else None,
        'label': feature.get('label', feature_key),
        'description': feature.get('description', ''),
        'icon': feature.get('icon', 'settings'),
    }


def get_all_feature_statuses(org):
    """Get status for ALL registered features. Used by the settings page."""
    return {key: get_feature_status(org, key) for key in FEATURE_REGISTRY}


# Maps addon_type to the corresponding key in plan.limits
ADDON_TYPE_TO_LIMIT_KEY = {
    'users': 'max_users',
    'sites': 'max_sites',
    'products': 'max_products',
    'storage': 'max_storage',
    'invoices': 'max_invoices',
    'customers': 'max_customers',
}


def get_plan_resource_limit(org, resource_key, default=None):
    """
    Compute the EFFECTIVE resource limit for an org.
    Effective limit = plan base limit + purchased add-on quantities.
    Always reads from the database — never hardcoded.
    Returns None if no plan is found.
    Returns -1 if unlimited (including super orgs).
    """
    # Super-admin orgs bypass all resource limits
    if _is_super_org(org):
        return -1

    limits = _get_plan_limits(org)
    base_limit = limits.get(resource_key, default)

    if base_limit is None:
        return None  # No plan or key not set
    if base_limit == -1:
        return -1    # Unlimited — add-ons irrelevant

    # Sum purchased add-on quantities for this resource type
    addon_type = None
    for atype, lkey in ADDON_TYPE_TO_LIMIT_KEY.items():
        if lkey == resource_key:
            addon_type = atype
            break

    addon_extra = 0
    if addon_type:
        try:
            from erp.models_saas import OrganizationAddon
            from django.db.models import Sum, F
            addon_extra = OrganizationAddon.objects.filter(
                organization=org,
                addon__addon_type=addon_type,
                status='active',
            ).aggregate(
                total=Sum(F('quantity') * F('addon__quantity'))
            )['total'] or 0
        except Exception:
            pass  # Don't fail if add-on tables missing

    return base_limit + addon_extra


def check_resource_limit(org, resource_key, current_count, default_limit=None):
    """
    Check if the org is within a numeric resource limit.
    Returns (allowed: bool, limit: int|None, current: int)
    -1 means unlimited.
    """
    limit = get_plan_resource_limit(org, resource_key, default_limit)
    if limit is None or limit == -1:
        return True, None, current_count  # No limit or -1 = unlimited
    return current_count < limit, limit, current_count
