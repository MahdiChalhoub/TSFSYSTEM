"""
COA Migration Dry-Run Engine
=============================
Populates COAMigrationAccountPlan rows with usage metrics and
auto-assigns migration modes using the decision tree:

  A. No balance, no transactions, no children, no refs → DELETE_UNUSED
  B. No balance, no transactions, but has children → migrate children first, archive parent
  C. Has transactions or balance → preserve history (RENAME/MERGE/SPLIT per mapping)
  D. Referenced by PostingRule/FinancialAccount but no journals → REPOINT_AND_ARCHIVE
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone

logger = logging.getLogger(__name__)


def run_dry_run(session):
    """
    Populate account plans for a migration session.

    Queries every COA account in the org, computes usage metrics,
    matches against template mappings, and assigns migration_mode.

    Args:
        session: COAMigrationSession instance (status must be DRAFT or DRY_RUN)

    Returns:
        dict: dry-run report summary
    """
    from apps.finance.models.coa_models import ChartOfAccount, FinancialAccount
    from apps.finance.models.posting_rule import PostingRule
    from apps.finance.models.ledger_models import JournalEntryLine
    from apps.finance.models.coa_template import (
        COATemplateMigrationMap, COAMigrationAccountPlan,
    )

    if session.status not in ('DRAFT', 'DRY_RUN'):
        raise ValueError(f"Cannot run dry-run on session with status={session.status}")

    org = session.organization
    migration_date = session.migration_date or timezone.now()

    # ── Step 1: Get all org COA accounts ──
    org_accounts = list(ChartOfAccount.objects.filter(organization=org).select_related('parent'))

    # ── Step 2: Get template mappings ──
    template_maps = list(COATemplateMigrationMap.objects.filter(
        source_template=session.source_template,
        target_template=session.target_template,
    ).values(
        'source_account_code', 'target_account_code', 'mapping_type',
        'group_key', 'allocation_percent', 'mapping_reason',
    ))

    # Index: source_code → list of mappings
    maps_by_source = {}
    for m in template_maps:
        maps_by_source.setdefault(m['source_account_code'], []).append(m)

    # ── Step 3: Compute usage metrics per account ──
    # Journal line counts per account
    jl_counts = dict(
        JournalEntryLine.objects.filter(organization=org)
        .values('account_id')
        .annotate(cnt=Count('id'))
        .values_list('account_id', 'cnt')
    )

    # Balances per account (net = sum(debit) - sum(credit))
    balances = {}
    bal_qs = (
        JournalEntryLine.objects.filter(
            organization=org,
            journal_entry__status='POSTED',
            journal_entry__transaction_date__lte=migration_date,
        )
        .values('account_id')
        .annotate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
        )
    )
    for row in bal_qs:
        d = row['total_debit'] or Decimal('0')
        c = row['total_credit'] or Decimal('0')
        balances[row['account_id']] = d - c

    # PostingRule counts per account
    pr_counts = dict(
        PostingRule.objects.filter(organization=org)
        .values('account_id')
        .annotate(cnt=Count('id'))
        .values_list('account_id', 'cnt')
    )

    # FinancialAccount counts per ledger_account
    fa_counts = dict(
        FinancialAccount.objects.filter(organization=org)
        .exclude(ledger_account__isnull=True)
        .values('ledger_account_id')
        .annotate(cnt=Count('id'))
        .values_list('ledger_account_id', 'cnt')
    )

    # Children counts per parent
    children_counts = dict(
        ChartOfAccount.objects.filter(organization=org)
        .exclude(parent__isnull=True)
        .values('parent_id')
        .annotate(cnt=Count('id'))
        .values_list('parent_id', 'cnt')
    )

    # ── Step 4: Delete old plans and create new ones ──
    with transaction.atomic():
        session.account_plans.all().delete()

        plans = []
        stats = {
            'RENAME_IN_PLACE': 0, 'REPOINT_AND_ARCHIVE': 0,
            'MERGE_FORWARD': 0, 'SPLIT_BY_OPENING_ENTRY': 0,
            'DELETE_UNUSED': 0, 'MANUAL_REVIEW': 0,
            'total': 0, 'with_balance': 0, 'historically_locked_count': 0,
        }

        for acct in org_accounts:
            jl_count = jl_counts.get(acct.id, 0)
            balance = balances.get(acct.id, Decimal('0'))
            pr_count = pr_counts.get(acct.id, 0)
            fa_count = fa_counts.get(acct.id, 0)
            ch_count = children_counts.get(acct.id, 0)

            has_journals = jl_count > 0
            has_balance = balance != Decimal('0')
            has_refs = pr_count > 0 or fa_count > 0
            has_children = ch_count > 0

            # ── Step 5: Find template mapping ──
            mappings = maps_by_source.get(acct.code, [])
            if not mappings:
                # No template mapping for this account code
                mapping_type = 'NO_DIRECT_MATCH'
                target_code = ''
                target_name = ''
                group_key = ''
                alloc_pct = None
            elif len(mappings) == 1 and mappings[0]['mapping_type'] == 'ONE_TO_ONE':
                mapping_type = 'ONE_TO_ONE'
                target_code = mappings[0]['target_account_code']
                target_name = ''  # Will be enriched from template data
                group_key = ''
                alloc_pct = None
            elif mappings[0]['mapping_type'] == 'MANY_TO_ONE':
                mapping_type = 'MANY_TO_ONE'
                target_code = mappings[0]['target_account_code']
                target_name = ''
                group_key = mappings[0].get('group_key', '')
                alloc_pct = None
            elif mappings[0]['mapping_type'] == 'ONE_TO_MANY':
                mapping_type = 'ONE_TO_MANY'
                target_code = mappings[0]['target_account_code']
                target_name = ''
                group_key = mappings[0].get('group_key', '')
                alloc_pct = mappings[0].get('allocation_percent')
            else:
                mapping_type = mappings[0]['mapping_type']
                target_code = mappings[0]['target_account_code']
                target_name = ''
                group_key = mappings[0].get('group_key', '')
                alloc_pct = mappings[0].get('allocation_percent')

            # ── Step 6: Apply decision tree ──
            # Priority 1: Mapping type determines structural intent
            if mapping_type == 'ONE_TO_MANY':
                # Template says SPLIT — always honor, even if unused
                mode = 'SPLIT_BY_OPENING_ENTRY'
            elif mapping_type == 'MANY_TO_ONE':
                # Template says MERGE — always honor
                mode = 'MERGE_FORWARD'
            # Priority 2: Usage-based decisions for 1:1 and unmapped
            elif not has_journals and not has_balance and not has_children and not has_refs:
                # A. Truly unused → delete (unless critical role)
                if acct.system_role and acct.system_role in CRITICAL_ROLES:
                    mode = 'REPOINT_AND_ARCHIVE'  # Critical role — never delete
                else:
                    mode = 'DELETE_UNUSED'
            elif not has_journals and not has_balance and has_children:
                # B. No transactions but has children → archive parent
                mode = 'REPOINT_AND_ARCHIVE'
            elif has_journals or has_balance:
                # C. Has history → preserve based on mapping type
                if mapping_type == 'ONE_TO_ONE':
                    mode = 'RENAME_IN_PLACE'
                else:
                    mode = 'MANUAL_REVIEW'
            elif has_refs:
                # D. Referenced but no journals → repoint
                mode = 'REPOINT_AND_ARCHIVE'
            else:
                mode = 'MANUAL_REVIEW'

            historically_locked = has_journals

            plan = COAMigrationAccountPlan(
                session=session,
                source_account=acct,
                target_account_code=target_code,
                target_account_name=target_name,
                migration_mode=mode,
                balance_at_migration=balance,
                journal_line_count=jl_count,
                posting_rule_count=pr_count,
                financial_account_count=fa_count,
                children_count=ch_count,
                historically_locked=historically_locked,
                has_posting_rules=pr_count > 0,
                has_financial_accounts=fa_count > 0,
                allocation_percent=alloc_pct,
                group_key=group_key,
            )
            plans.append(plan)

            # Stats
            stats['total'] += 1
            stats[mode] = stats.get(mode, 0) + 1
            if has_balance:
                stats['with_balance'] += 1
            if historically_locked:
                stats['historically_locked_count'] += 1

        COAMigrationAccountPlan.objects.bulk_create(plans)

        # ── Step 7: Handle 1:N split groups (create additional rows) ──
        # For ONE_TO_MANY: the first mapping was used above.
        # Additional split targets need their own plan rows.
        split_extras = []
        for acct in org_accounts:
            mappings = maps_by_source.get(acct.code, [])
            if len(mappings) > 1 and mappings[0]['mapping_type'] == 'ONE_TO_MANY':
                for extra in mappings[1:]:  # Skip first, already created
                    split_extras.append(COAMigrationAccountPlan(
                        session=session,
                        source_account=acct,
                        target_account_code=extra['target_account_code'],
                        target_account_name='',
                        migration_mode='SPLIT_BY_OPENING_ENTRY',
                        balance_at_migration=balances.get(acct.id, Decimal('0')),
                        journal_line_count=jl_counts.get(acct.id, 0),
                        posting_rule_count=pr_counts.get(acct.id, 0),
                        financial_account_count=fa_counts.get(acct.id, 0),
                        children_count=children_counts.get(acct.id, 0),
                        historically_locked=jl_counts.get(acct.id, 0) > 0,
                        has_posting_rules=pr_counts.get(acct.id, 0) > 0,
                        has_financial_accounts=fa_counts.get(acct.id, 0) > 0,
                        allocation_percent=extra.get('allocation_percent'),
                        group_key=extra.get('group_key', ''),
                    ))
        if split_extras:
            COAMigrationAccountPlan.objects.bulk_create(split_extras)
            stats['split_extra_rows'] = len(split_extras)

        # ── Step 8: Enrich target names from template ──
        from apps.finance.models.coa_template import COATemplateAccount
        tgt_accts = {
            a.code: a.name
            for a in COATemplateAccount.objects.filter(template=session.target_template)
        }
        enriched = 0
        for plan in session.account_plans.filter(target_account_code__gt=''):
            name = tgt_accts.get(plan.target_account_code, '')
            if name and plan.target_account_name != name:
                plan.target_account_name = name
                plan.save(update_fields=['target_account_name'])
                enriched += 1
        stats['target_names_enriched'] = enriched

        # ── Step 9: Build dry-run report ──
        report = {
            'migration_date': migration_date.isoformat(),
            'source_template': session.source_template.key,
            'target_template': session.target_template.key,
            'stats': stats,
            'generated_at': timezone.now().isoformat(),
        }
        session.dry_run_report = report
        session.status = 'DRY_RUN'
        session.save(update_fields=['dry_run_report', 'status', 'updated_at'])

    logger.info(
        "Dry-run complete for session %s: %s accounts analyzed, %s",
        session.id, stats['total'], stats,
    )
    return report


# ═══════════════════════════════════════════════════════════════
#  6.5 — Pre-Execution Blocker Checks
# ═══════════════════════════════════════════════════════════════

CRITICAL_ROLES = {
    'CASH_ACCOUNT', 'BANK_ACCOUNT', 'RECEIVABLE', 'PAYABLE',
    'REVENUE', 'COGS', 'P_L_SUMMARY', 'RETAINED_EARNINGS',
    'INVENTORY_ASSET', 'INPUT_VAT', 'OUTPUT_VAT',
}


def run_blocker_checks(session):
    """
    Detect blockers that must be resolved before execution.
    Returns list of blocker dicts. Empty list = safe to proceed.
    """
    from apps.finance.models.coa_template import COAMigrationAccountPlan

    blockers = []
    plans = list(session.account_plans.select_related('source_account').all())

    # 1. MANUAL_REVIEW accounts must be resolved
    manual = [p for p in plans if p.migration_mode == 'MANUAL_REVIEW']
    if manual:
        blockers.append({
            'type': 'UNRESOLVED_MANUAL_REVIEW',
            'severity': 'BLOCKER',
            'count': len(manual),
            'accounts': [p.source_account.code for p in manual if p.source_account],
            'message': f"{len(manual)} account(s) still in MANUAL_REVIEW mode",
        })

    # 2. Duplicate target codes (two sources mapping to same target leaf)
    target_codes = {}
    for p in plans:
        if p.target_account_code and p.migration_mode not in ('DELETE_UNUSED', 'MANUAL_REVIEW'):
            target_codes.setdefault(p.target_account_code, []).append(p)
    dupes = {k: v for k, v in target_codes.items() if len(v) > 1}
    # Filter out split groups (same source) — those are expected
    real_dupes = {}
    for code, plist in dupes.items():
        # Exclude MERGE groups — multiple sources merging to same target is by design
        non_merge = [p for p in plist if p.migration_mode not in ('MERGE_FORWARD', 'SPLIT_BY_OPENING_ENTRY')]
        sources = set(p.source_account_id for p in non_merge if p.source_account_id)
        if len(sources) > 1:
            real_dupes[code] = plist
    if real_dupes:
        blockers.append({
            'type': 'DUPLICATE_TARGET_CODES',
            'severity': 'BLOCKER',
            'count': len(real_dupes),
            'targets': list(real_dupes.keys()),
            'message': f"{len(real_dupes)} target code(s) claimed by multiple sources",
        })

    # 3. Allocation errors on split groups
    split_groups = {}
    for p in plans:
        if p.migration_mode == 'SPLIT_BY_OPENING_ENTRY' and p.group_key:
            split_groups.setdefault(p.group_key, []).append(p)
    for gk, group in split_groups.items():
        total_pct = sum(float(p.allocation_percent or 0) for p in group)
        if abs(total_pct - 100.0) > 0.1:
            blockers.append({
                'type': 'ALLOCATION_ERROR',
                'severity': 'BLOCKER',
                'group_key': gk,
                'total_percent': total_pct,
                'message': f"Split group {gk} allocation = {total_pct}% (must be 100%)",
            })
        if any(float(p.allocation_percent or 0) < 0 for p in group):
            blockers.append({
                'type': 'NEGATIVE_ALLOCATION',
                'severity': 'BLOCKER',
                'group_key': gk,
                'message': f"Split group {gk} has negative allocation",
            })

    # 4. Unmapped critical roles
    from apps.finance.models.coa_models import ChartOfAccount
    org_accounts = ChartOfAccount.objects.filter(organization=session.organization)
    mapped_account_ids = set(p.source_account_id for p in plans if p.source_account_id and p.migration_mode != 'DELETE_UNUSED')
    # Check if any critical-role accounts are being deleted
    for acct in org_accounts.filter(id__in=[p.source_account_id for p in plans if p.migration_mode == 'DELETE_UNUSED']):
        if acct.system_role in CRITICAL_ROLES:
            blockers.append({
                'type': 'CRITICAL_ROLE_DELETION',
                'severity': 'BLOCKER',
                'account': acct.code,
                'role': acct.system_role,
                'message': f"Account {acct.code} ({acct.system_role}) marked DELETE but has critical role",
            })

    # 5. Historically locked accounts marked for DELETE_UNUSED
    locked_deletes = [p for p in plans if p.migration_mode == 'DELETE_UNUSED' and p.historically_locked]
    if locked_deletes:
        blockers.append({
            'type': 'LOCKED_ACCOUNT_DELETE',
            'severity': 'BLOCKER',
            'count': len(locked_deletes),
            'accounts': [p.source_account.code for p in locked_deletes if p.source_account],
            'message': f"{len(locked_deletes)} historically locked account(s) marked for deletion",
        })

    # 6. Idempotency: check for prior completed session
    from apps.finance.models.coa_template import COAMigrationSession
    prior = COAMigrationSession.objects.filter(
        organization=session.organization,
        source_template=session.source_template,
        target_template=session.target_template,
        status__in=['COMPLETED', 'PARTIAL'],
    ).exclude(id=session.id).first()
    if prior:
        blockers.append({
            'type': 'PRIOR_SESSION_EXISTS',
            'severity': 'WARNING',
            'prior_session_id': prior.id,
            'prior_status': prior.status,
            'message': f"Prior migration session {prior.id} already {prior.status}",
        })

    # 7. Children of SPLIT_BY_OPENING_ENTRY parents must have their own mapping
    split_parent_ids = set(
        p.source_account_id for p in plans
        if p.migration_mode == 'SPLIT_BY_OPENING_ENTRY' and p.source_account_id
    )
    if split_parent_ids:
        planned_ids = set(p.source_account_id for p in plans if p.source_account_id)
        children_of_splits = ChartOfAccount.objects.filter(
            organization=session.organization,
            parent_id__in=split_parent_ids,
        )
        orphaned_kids = [c for c in children_of_splits if c.id not in planned_ids]
        if orphaned_kids:
            blockers.append({
                'type': 'SPLIT_CHILDREN_UNMAPPED',
                'severity': 'BLOCKER',
                'count': len(orphaned_kids),
                'accounts': [c.code for c in orphaned_kids[:10]],
                'message': f"{len(orphaned_kids)} children of SPLIT accounts have no migration plan",
            })

    return blockers


# ═══════════════════════════════════════════════════════════════
#  6.6 — Org Finance Freeze
# ═══════════════════════════════════════════════════════════════

def freeze_org(session):
    """Set org into MIGRATION_IN_PROGRESS state."""
    session.is_locked = True
    session.save(update_fields=['is_locked', 'updated_at'])
    logger.info("Org %s frozen for migration session %s", session.organization_id, session.id)


def unfreeze_org(session):
    """Release org from migration freeze."""
    session.is_locked = False
    session.save(update_fields=['is_locked', 'updated_at'])
    logger.info("Org %s unfrozen after migration session %s", session.organization_id, session.id)


# ═══════════════════════════════════════════════════════════════
#  6.7 — Execution Pipeline
# ═══════════════════════════════════════════════════════════════

def execute_migration(session, user=None):
    """
    Execute the full migration for an approved session.

    Phase A: Structural remap (single atomic transaction)
    Phase B: Split journal creation (separate controlled transaction)

    Returns:
        dict: execution report
    """
    from apps.finance.models.coa_models import ChartOfAccount, FinancialAccount
    from apps.finance.models.posting_rule import PostingRule
    from apps.finance.models.ledger_models import JournalEntry, JournalEntryLine
    from apps.finance.models.coa_template import COAMigrationAccountPlan, COATemplateAccount

    if session.status not in ('APPROVED', 'PARTIAL'):
        raise ValueError(f"Cannot execute session with status={session.status}")

    # Run blocker checks first
    blockers = run_blocker_checks(session)
    real_blockers = [b for b in blockers if b['severity'] == 'BLOCKER']
    if real_blockers:
        session.error_report = {'blockers': blockers}
        session.status = 'FAILED'
        session.save(update_fields=['error_report', 'status', 'updated_at'])
        raise ValueError(f"Cannot execute: {len(real_blockers)} blocker(s) found")

    session.status = 'EXECUTING'
    session.executed_by = user
    session.executed_at = timezone.now()
    session.save(update_fields=['status', 'executed_by', 'executed_at', 'updated_at'])

    org = session.organization
    report = {
        'renamed': 0, 'archived': 0, 'merged': 0,
        'split_journals_created': 0, 'deleted': 0,
        'posting_rules_remapped': 0, 'financial_accounts_remapped': 0,
        'errors': [], 'audit_log': [],
    }

    # Build target template account index
    tgt_template_accts = {
        a.code: a for a in COATemplateAccount.objects.filter(template=session.target_template)
    }

    freeze_org(session)

    try:
        # ═══════════════════════════════════════════════════════════
        #  PHASE A — Structural Remap (atomic transaction)
        # ═══════════════════════════════════════════════════════════
        if session.status != 'PARTIAL':  # Skip Phase A if already done (PARTIAL = retry Phase B)
            with transaction.atomic():
                plans = list(session.account_plans.select_related('source_account').all())

                for plan in plans:
                    if plan.is_executed or not plan.source_account:
                        continue

                    acct = plan.source_account
                    old_code = acct.code
                    old_name = acct.name

                    if plan.migration_mode == 'RENAME_IN_PLACE':
                        # Same DB row — update code + name
                        tgt_info = tgt_template_accts.get(plan.target_account_code)
                        if tgt_info:
                            acct.code = tgt_info.code
                            acct.name = tgt_info.name
                            acct.save(update_fields=['code', 'name'])
                            plan.is_executed = True
                            plan.execution_notes = f"Renamed: {old_code} → {tgt_info.code}"
                            plan.save(update_fields=['is_executed', 'execution_notes'])
                            report['renamed'] += 1
                            report['audit_log'].append({
                                'action': 'RENAME', 'old_code': old_code,
                                'new_code': tgt_info.code, 'old_name': old_name,
                                'new_name': tgt_info.name,
                            })

                    elif plan.migration_mode == 'REPOINT_AND_ARCHIVE':
                        # Archive old account (mark inactive)
                        acct.is_active = False
                        acct.save(update_fields=['is_active'])
                        plan.is_executed = True
                        plan.execution_notes = f"Archived: {old_code}"
                        plan.save(update_fields=['is_executed', 'execution_notes'])
                        report['archived'] += 1
                        report['audit_log'].append({
                            'action': 'ARCHIVE', 'code': old_code,
                            'reason': 'REPOINT_AND_ARCHIVE',
                        })

                    elif plan.migration_mode == 'MERGE_FORWARD':
                        # Archive source, keep for history
                        acct.is_active = False
                        acct.save(update_fields=['is_active'])
                        plan.is_executed = True
                        plan.execution_notes = f"Merged forward: {old_code} → archived"
                        plan.save(update_fields=['is_executed', 'execution_notes'])
                        report['merged'] += 1
                        report['audit_log'].append({
                            'action': 'MERGE_ARCHIVE', 'code': old_code,
                            'target': plan.target_account_code,
                        })

                    elif plan.migration_mode == 'DELETE_UNUSED':
                        # Only delete if truly no references
                        if not plan.historically_locked and plan.journal_line_count == 0:
                            acct.delete()
                            plan.is_executed = True
                            plan.execution_notes = f"Deleted: {old_code}"
                            plan.save(update_fields=['is_executed', 'execution_notes'])
                            report['deleted'] += 1
                            report['audit_log'].append({
                                'action': 'DELETE', 'code': old_code,
                            })

                    elif plan.migration_mode == 'SPLIT_BY_OPENING_ENTRY':
                        # Mark for Phase B — archive the original
                        # Don't delete, splits happen in Phase B
                        if not plan.is_executed:
                            plan.execution_notes = "Pending split journal (Phase B)"
                            plan.save(update_fields=['execution_notes'])

                # ── Remap PostingRules ──
                for plan in plans:
                    if plan.migration_mode in ('RENAME_IN_PLACE',) and plan.source_account:
                        # Already remapped implicitly (same FK, code changed)
                        continue
                    if plan.migration_mode in ('REPOINT_AND_ARCHIVE', 'MERGE_FORWARD') and plan.target_account_code:
                        # Find or create target COA account
                        target_acct = ChartOfAccount.objects.filter(
                            organization=org, code=plan.target_account_code,
                        ).first()
                        if target_acct and plan.source_account:
                            # Remap posting rules from old → new
                            updated = PostingRule.objects.filter(
                                organization=org, account=plan.source_account,
                            ).update(account=target_acct)
                            if updated:
                                report['posting_rules_remapped'] += updated
                                report['audit_log'].append({
                                    'action': 'REMAP_POSTING_RULE',
                                    'from_code': plan.source_account.code,
                                    'to_code': target_acct.code,
                                    'count': updated,
                                })

                            # Remap financial accounts
                            fa_updated = FinancialAccount.objects.filter(
                                organization=org, ledger_account=plan.source_account,
                            ).update(ledger_account=target_acct)
                            if fa_updated:
                                report['financial_accounts_remapped'] += fa_updated
                                report['audit_log'].append({
                                    'action': 'REMAP_FINANCIAL_ACCOUNT',
                                    'from_code': plan.source_account.code,
                                    'to_code': target_acct.code,
                                    'count': fa_updated,
                                })

                # ── Reparent children of MERGE_FORWARD / REPOINT_AND_ARCHIVE ──
                report['children_reparented'] = 0
                for plan in plans:
                    if plan.migration_mode in ('MERGE_FORWARD', 'REPOINT_AND_ARCHIVE') and plan.target_account_code and plan.source_account:
                        target_acct = ChartOfAccount.objects.filter(
                            organization=org, code=plan.target_account_code,
                        ).first()
                        if target_acct:
                            # Reparent active children from archived source to target
                            reparented = ChartOfAccount.objects.filter(
                                organization=org,
                                parent=plan.source_account,
                                is_active=True,
                            ).update(parent=target_acct)
                            if reparented:
                                report['children_reparented'] += reparented
                                report['audit_log'].append({
                                    'action': 'REPARENT_CHILDREN',
                                    'from_parent': plan.source_account.code,
                                    'to_parent': target_acct.code,
                                    'count': reparented,
                                })

                session.phase_a_completed_at = timezone.now()
                session.save(update_fields=['phase_a_completed_at', 'updated_at'])
                logger.info("Phase A complete for session %s", session.id)

        # ═══════════════════════════════════════════════════════════
        #  PHASE B — Split Journals (controlled posting transaction)
        # ═══════════════════════════════════════════════════════════
        with transaction.atomic():
            # Get split groups
            split_plans = session.account_plans.filter(
                migration_mode='SPLIT_BY_OPENING_ENTRY',
                is_executed=False,
            ).select_related('source_account')

            # Group by source account
            split_groups = {}
            for p in split_plans:
                if p.source_account:
                    split_groups.setdefault(p.source_account_id, []).append(p)

            for acct_id, group_plans in split_groups.items():
                source_acct = group_plans[0].source_account
                balance = group_plans[0].balance_at_migration or Decimal('0')

                if balance == Decimal('0'):
                    # No balance to split — just mark executed
                    for p in group_plans:
                        p.is_executed = True
                        p.execution_notes = "No balance to split"
                        p.save(update_fields=['is_executed', 'execution_notes'])
                    continue

                # Check for duplicate split JE (idempotency)
                existing_je = JournalEntry.objects.filter(
                    organization=org,
                    source_module='coa_migration',
                    source_model='COAMigrationSession',
                    source_id=session.id,
                    reference=f"SPLIT-{source_acct.code}-S{session.id}",
                ).first()
                if existing_je:
                    for p in group_plans:
                        p.is_executed = True
                        p.execution_notes = f"Split JE already exists: {existing_je.reference}"
                        p.save(update_fields=['is_executed', 'execution_notes'])
                    continue

                # Calculate allocation amounts with remainder-absorb rounding
                total_pct = sum(float(p.allocation_percent or 0) for p in group_plans)
                if abs(total_pct - 100.0) > 0.1:
                    report['errors'].append({
                        'type': 'ALLOCATION_ERROR',
                        'account': source_acct.code,
                        'total_pct': total_pct,
                    })
                    continue

                amounts = []
                running_total = Decimal('0')
                for i, p in enumerate(group_plans):
                    pct = Decimal(str(p.allocation_percent or 0))
                    if i == len(group_plans) - 1:
                        # Last account absorbs remainder (precision fix)
                        amt = abs(balance) - running_total
                    else:
                        amt = (abs(balance) * pct / Decimal('100')).quantize(Decimal('0.01'))
                        running_total += amt
                    amounts.append(amt)

                # Create opening split journal entry
                is_debit_normal = balance > Decimal('0')
                je = JournalEntry.objects.create(
                    organization=org,
                    transaction_date=session.migration_date or timezone.now(),
                    description=f"COA Migration Split: {source_acct.code} {source_acct.name}",
                    journal_type='OPENING',
                    source_module='coa_migration',
                    source_model='COAMigrationSession',
                    source_id=session.id,
                    reference=f"SPLIT-{source_acct.code}-S{session.id}",
                    status='DRAFT',
                    scope='OFFICIAL',
                    created_by=user,
                )

                # Credit (or debit) the source account for the full balance
                JournalEntryLine.objects.create(
                    organization=org,
                    journal_entry=je,
                    account=source_acct,
                    debit=Decimal('0') if is_debit_normal else abs(balance),
                    credit=abs(balance) if is_debit_normal else Decimal('0'),
                    description=f"Migration split out from {source_acct.code}",
                )

                # Debit (or credit) each target for its share
                for p, amt in zip(group_plans, amounts):
                    target_acct = ChartOfAccount.objects.filter(
                        organization=org, code=p.target_account_code,
                    ).first()
                    if not target_acct:
                        report['errors'].append({
                            'type': 'TARGET_NOT_FOUND',
                            'code': p.target_account_code,
                        })
                        continue

                    JournalEntryLine.objects.create(
                        organization=org,
                        journal_entry=je,
                        account=target_acct,
                        debit=amt if is_debit_normal else Decimal('0'),
                        credit=Decimal('0') if is_debit_normal else amt,
                        description=f"Migration split: {p.allocation_percent}% of {source_acct.code}",
                    )

                    p.is_executed = True
                    p.execution_notes = f"Split JE {je.reference}: {amt}"
                    p.save(update_fields=['is_executed', 'execution_notes'])

                report['split_journals_created'] += 1
                report['audit_log'].append({
                    'action': 'SPLIT_JOURNAL',
                    'source': source_acct.code,
                    'je_reference': je.reference,
                    'balance': str(balance),
                    'targets': [
                        {'code': p.target_account_code, 'pct': str(p.allocation_percent), 'amt': str(a)}
                        for p, a in zip(group_plans, amounts)
                    ],
                })

            session.phase_b_completed_at = timezone.now()
            session.save(update_fields=['phase_b_completed_at', 'updated_at'])
            logger.info("Phase B complete for session %s", session.id)

        # ═══════════════════════════════════════════════════════════
        #  6.9 — Post-Execution Validation
        # ═══════════════════════════════════════════════════════════
        validation = run_post_validation(session)
        report['validation'] = validation

        session.execution_report = report
        session.validation_report = validation
        session.status = 'COMPLETED'
        session.save(update_fields=[
            'execution_report', 'validation_report', 'status', 'updated_at',
        ])

    except Exception as e:
        logger.error("Migration execution failed for session %s: %s", session.id, e)
        session.error_report = {
            'error': str(e),
            'partial_report': report,
        }
        # If Phase A completed, mark as PARTIAL for retry
        if session.phase_a_completed_at:
            session.status = 'PARTIAL'
        else:
            session.status = 'FAILED'
        session.save(update_fields=['error_report', 'status', 'updated_at'])
        raise
    finally:
        unfreeze_org(session)

    logger.info("Migration session %s COMPLETED: %s", session.id, report)
    return report


# ═══════════════════════════════════════════════════════════════
#  6.9 — Post-Execution Validation (4 Categories)
# ═══════════════════════════════════════════════════════════════

def run_post_validation(session):
    """
    Run 4-category validation after execution.
    Returns dict with results per category.
    """
    from apps.finance.models.coa_models import ChartOfAccount, FinancialAccount
    from apps.finance.models.posting_rule import PostingRule

    org = session.organization
    issues = []

    # A. Referential — no orphan refs
    orphan_prs = PostingRule.objects.filter(
        organization=org, account__is_active=False,
    ).count()
    if orphan_prs:
        issues.append({
            'category': 'REFERENTIAL', 'type': 'ORPHAN_POSTING_RULES',
            'count': orphan_prs,
            'message': f"{orphan_prs} posting rule(s) point to archived accounts",
        })

    orphan_fas = FinancialAccount.objects.filter(
        organization=org, ledger_account__is_active=False,
    ).count()
    if orphan_fas:
        issues.append({
            'category': 'REFERENTIAL', 'type': 'ORPHAN_FINANCIAL_ACCOUNTS',
            'count': orphan_fas,
            'message': f"{orphan_fas} financial account(s) linked to archived COA accounts",
        })

    broken_parents = ChartOfAccount.objects.filter(
        organization=org, parent__is_active=False, is_active=True,
    ).count()
    if broken_parents:
        issues.append({
            'category': 'REFERENTIAL', 'type': 'BROKEN_PARENT_LINKS',
            'count': broken_parents,
            'message': f"{broken_parents} active account(s) have archived parents",
        })

    # B. Accounting — check split JEs balance
    from apps.finance.models.ledger_models import JournalEntry
    split_jes = JournalEntry.objects.filter(
        organization=org,
        source_module='coa_migration',
        source_id=session.id,
    )
    for je in split_jes:
        lines = je.lines.all()
        total_dr = sum(l.debit for l in lines)
        total_cr = sum(l.credit for l in lines)
        if abs(total_dr - total_cr) > Decimal('0.01'):
            issues.append({
                'category': 'ACCOUNTING', 'type': 'UNBALANCED_SPLIT_JE',
                'je_ref': je.reference,
                'debit': str(total_dr), 'credit': str(total_cr),
                'message': f"Split JE {je.reference} is unbalanced: DR={total_dr} CR={total_cr}",
            })

    # C. Functional — check POS-critical accounts exist
    # (Simple check: at least one active CASH and BANK account)
    active_cash = ChartOfAccount.objects.filter(
        organization=org, system_role='CASH_ACCOUNT', is_active=True,
    ).exists()
    if not active_cash:
        issues.append({
            'category': 'FUNCTIONAL', 'type': 'NO_ACTIVE_CASH',
            'message': 'No active CASH_ACCOUNT found — POS may not function',
        })

    active_bank = ChartOfAccount.objects.filter(
        organization=org, system_role='BANK_ACCOUNT', is_active=True,
    ).exists()
    if not active_bank:
        issues.append({
            'category': 'FUNCTIONAL', 'type': 'NO_ACTIVE_BANK',
            'message': 'No active BANK_ACCOUNT found',
        })

    # D. Governance — check plan completion
    unexecuted = session.account_plans.filter(
        is_executed=False,
    ).exclude(migration_mode='MANUAL_REVIEW').count()
    if unexecuted:
        issues.append({
            'category': 'GOVERNANCE', 'type': 'INCOMPLETE_EXECUTION',
            'count': unexecuted,
            'message': f"{unexecuted} plan(s) not executed",
        })

    return {
        'passed': len(issues) == 0,
        'issue_count': len(issues),
        'issues': issues,
        'validated_at': timezone.now().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
#  Approve session (transition from DRY_RUN → APPROVED)
# ═══════════════════════════════════════════════════════════════

def approve_session(session, user=None):
    """Mark a dry-run session as approved for execution."""
    if session.status != 'DRY_RUN':
        raise ValueError(f"Cannot approve session with status={session.status}")

    blockers = run_blocker_checks(session)
    real_blockers = [b for b in blockers if b['severity'] == 'BLOCKER']
    if real_blockers:
        raise ValueError(f"Cannot approve: {len(real_blockers)} blocker(s): {real_blockers}")

    session.status = 'APPROVED'
    session.approved_by = user
    session.approved_at = timezone.now()
    session.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
    return {'status': 'APPROVED', 'blockers': blockers}
