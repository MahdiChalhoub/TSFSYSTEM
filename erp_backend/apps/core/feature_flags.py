"""
Core Feature Flags — Enterprise Feature Gate Registry
======================================================
Defines all available feature flags and their default states.

Feature flags are per-tenant and stored in the FeatureFlag model.
They are checked at runtime via:

    from kernel.config import is_feature_enabled

    if is_feature_enabled('crm.compliance_engine'):
        # Run compliance checks

Architecture ref: kernel/config/config_manager.py
"""

import logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE FLAG DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════
# Each entry: (key, description, default_enabled)
# These are seeded for new tenants and can be toggled via admin or API.

FEATURE_FLAGS = [
    # ── Finance ──
    ('finance.auto_journal_posting', 'Automatically post journal entries on order confirmation', True),
    ('finance.vat_settlement', 'Enable VAT settlement workspace and periodic accruals', True),
    ('finance.multi_currency', 'Enable multi-currency support for invoices and payments', False),
    ('finance.advanced_reporting', 'Enable advanced financial reporting dashboards', False),

    # ── POS ──
    ('pos.intelligence_grid', 'Enable the 11-zone Intelligence Grid on purchase orders', True),
    ('pos.barcode_scanning', 'Enable mobile barcode scanning in POS terminal', True),
    ('pos.auto_reconciliation', 'Auto-reconcile POS sessions at close', False),
    ('pos.loyalty_rewards', 'Enable loyalty points earning and redemption at POS', False),

    # ── Inventory ──
    ('inventory.auto_reorder', 'Enable automatic reorder alerts when stock falls below min', True),
    ('inventory.expiry_tracking', 'Enable product expiry date tracking and alerts', True),
    ('inventory.batch_tracking', 'Enable batch/lot number tracking for products', False),
    ('inventory.multi_warehouse_transfers', 'Enable inter-warehouse transfer workflows', True),

    # ── CRM ──
    ('crm.compliance_engine', 'Enable document compliance engine with escalation chains', True),
    ('crm.customer_scoring', 'Enable automatic customer tier scoring', False),
    ('crm.duplicate_detection', 'Enable automatic duplicate contact detection', False),
    ('crm.followup_automation', 'Enable automated follow-up task generation', True),

    # ── HR / Workforce ──
    ('hr.attendance_tracking', 'Enable clock-in/clock-out attendance tracking', True),
    ('hr.workforce_scoring', 'Enable WISE (Workforce Intelligence & Scoring Engine)', False),
    ('hr.leave_management', 'Enable leave request and approval workflows', True),

    # ── Procurement ──
    ('procurement.smart_receiving', 'Enable intelligent receiving with shelf pressure analytics', True),
    ('procurement.supplier_performance', 'Enable supplier performance scoring', True),
    ('procurement.auto_replenishment', 'Enable automatic purchase order generation from stock alerts', False),

    # ── eCommerce ──
    ('ecommerce.storefront', 'Enable the customer-facing online storefront', False),
    ('ecommerce.promotions', 'Enable promotional campaigns and coupon engine', False),

    # ── Platform ──
    ('platform.mcp_chat', 'Enable the MCP Intelligence chat interface', False),
    ('platform.audit_forensics', 'Enable forensic audit trail on all mutations', True),
    ('platform.observability', 'Enable performance metrics collection and Sentry reporting', False),
]


def seed_feature_flags(organization, force_reset=False):
    """
    Seed default feature flags for an organization.

    Called during:
    - Organization creation
    - Management command: python manage.py seed_feature_flags

    Args:
        organization: Organization instance
        force_reset: If True, resets all flags to defaults (destructive)

    Returns:
        dict with counts: {created, updated, skipped}
    """
    from kernel.config.models import FeatureFlag

    created = 0
    updated = 0
    skipped = 0

    for key, description, default_enabled in FEATURE_FLAGS:
        flag, was_created = FeatureFlag.objects.get_or_create(
            organization=organization,
            key=key,
            defaults={
                'is_enabled': default_enabled,
                'description': description,
                'rollout_percentage': 100,
            }
        )

        if was_created:
            created += 1
        elif force_reset:
            flag.is_enabled = default_enabled
            flag.description = description
            flag.save(update_fields=['is_enabled', 'description'])
            updated += 1
        else:
            skipped += 1

    logger.info(
        f"✅ Feature flags seeded for {organization.name}: "
        f"{created} created, {updated} updated, {skipped} skipped"
    )
    return {'created': created, 'updated': updated, 'skipped': skipped}


def get_feature_status(organization):
    """
    Get the current status of all feature flags for an organization.
    Returns a dict: {flag_key: bool}
    """
    from kernel.config.models import FeatureFlag

    flags = FeatureFlag.objects.filter(organization=organization).values_list('key', 'is_enabled')
    return dict(flags)
