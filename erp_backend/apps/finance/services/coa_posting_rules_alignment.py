"""
COA Migration Posting Rules Alignment Service

After migrating from Template A → Template B, posting rules must be
recomputed to point to the correct target accounts. This service uses
system_role resolution — it is fully deterministic and requires zero
hardcoded account codes.

Usage:
    from apps.finance.services.coa_posting_rules_alignment import apply_smart_posting_rules
    result = apply_smart_posting_rules(migration_session)
"""
import logging
from django.db import transaction

logger = logging.getLogger(__name__)


def apply_smart_posting_rules(migration_session):
    """
    Recompute PostingRules for an organization after COA migration.

    Algorithm:
    1. Load all posting rules from the TARGET template
    2. For each rule, find the live org account with matching system_role
    3. Update (or create) the org's PostingRule to point to that account

    Args:
        migration_session: COAMigrationSession instance (must be APPROVED or EXECUTING)

    Returns:
        dict with 'created', 'updated', 'skipped', 'errors' counts
    """
    from apps.finance.models.coa_template import COATemplatePostingRule, COATemplateAccount
    from apps.finance.models.posting_rule import PostingRule
    from apps.finance.models.coa import ChartOfAccount

    org = migration_session.organization
    target_tpl = migration_session.target_template

    # 1. Load target template posting rules
    template_rules = list(
        COATemplatePostingRule.objects
        .filter(template=target_tpl)
        .select_related('template')
    )

    if not template_rules:
        logger.warning(f"No posting rules on target template {target_tpl.key}")
        return {'created': 0, 'updated': 0, 'skipped': 0, 'errors': [], 'total': 0}

    # 2. Build a lookup: event_code → target template account
    template_accounts_by_code = {
        a.code: a
        for a in COATemplateAccount.objects.filter(template=target_tpl)
    }

    # 3. Build a lookup: system_role → live org account
    live_accounts_by_role = {}
    for acct in ChartOfAccount.objects.filter(organization=org, is_active=True):
        if acct.system_role:
            live_accounts_by_role[acct.system_role] = acct

    # 4. Also build: code → live org account (for direct code matching)
    live_accounts_by_code = {
        acct.code: acct
        for acct in ChartOfAccount.objects.filter(organization=org, is_active=True)
    }

    stats = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': [], 'total': len(template_rules)}

    with transaction.atomic():
        for rule in template_rules:
            try:
                # Find the template account for this rule
                tpl_acct = template_accounts_by_code.get(rule.account_code)
                target_live_acct = None

                # Strategy 1: Resolve by system_role (primary — deterministic)
                if tpl_acct and tpl_acct.system_role:
                    target_live_acct = live_accounts_by_role.get(tpl_acct.system_role)

                # Strategy 2: Fall back to direct code match
                if not target_live_acct:
                    target_live_acct = live_accounts_by_code.get(rule.account_code)

                if not target_live_acct:
                    stats['skipped'] += 1
                    stats['errors'].append(
                        f"{rule.event_code}: no live account for code={rule.account_code} "
                        f"(role={tpl_acct.system_role if tpl_acct else 'N/A'})"
                    )
                    continue

                # Upsert the org's PostingRule
                obj, created = PostingRule.objects.update_or_create(
                    organization=org,
                    event_code=rule.event_code,
                    defaults={
                        'account': target_live_acct,
                        'description': rule.description or f"Auto-aligned from {target_tpl.key}",
                        'module': rule.module,
                    }
                )

                if created:
                    stats['created'] += 1
                else:
                    stats['updated'] += 1

            except Exception as e:
                stats['errors'].append(f"{rule.event_code}: {str(e)}")
                logger.error(f"PostingRule alignment error for {rule.event_code}: {e}")

    logger.info(
        f"PostingRule alignment for org={org.id}: "
        f"created={stats['created']} updated={stats['updated']} "
        f"skipped={stats['skipped']} errors={len(stats['errors'])}"
    )

    return stats
