"""
ChartOfAccountViewSet mixin — Apply a COA template (with mapping-based
journal-line / posting-rule / financial-account remap + auto-sync of
posting rules from the template). Inherited by `ChartOfAccountViewSet`.
"""
from .base import (
    status, Response, action,
    get_current_tenant_id, Organization,
)
from apps.finance.services import LedgerService


class COAApplyTemplateMixin:
    """@action method that applies a template and remaps existing data."""

    @action(detail=False, methods=['post'])
    def apply_template(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        template_key = request.data.get('template_key')
        reset = request.data.get('reset', False)
        account_mapping = request.data.get('account_mapping', {})
        # account_mapping: { "old_code": "new_target_code", ... }
        # Used to remap journal entries from source accounts to target accounts

        if not template_key:
            return Response({"error": "template_key is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from apps.finance.models import ChartOfAccount, PostingRule
            from apps.finance.models.coa_template import COATemplate, COATemplatePostingRule
            from django.db import transaction as db_transaction
            import logging
            logger = logging.getLogger(__name__)

            # ── Phase 1: Snapshot old accounts before import ──
            old_accounts_by_code = {}
            if account_mapping:
                old_accounts_by_code = {
                    a.code: a for a in ChartOfAccount.objects.filter(
                        organization=organization, is_active=True
                    )
                }

            # ── Phase 2: Apply the new template ──
            LedgerService.apply_coa_template(organization, template_key, reset)

            # ── Phase 3: Remap references using account_mapping ──
            remapped_count = 0
            financial_accounts_remapped = 0
            remap_errors = []
            if account_mapping:
                with db_transaction.atomic():
                    from apps.finance.models import JournalEntryLine, FinancialAccount

                    # Build new code→account lookup (after import)
                    new_accounts_by_code = {
                        a.code: a for a in ChartOfAccount.objects.filter(
                            organization=organization, is_active=True
                        )
                    }

                    for source_code, target_code in account_mapping.items():
                        if not target_code or source_code == target_code:
                            continue  # skip unmapped or same-code entries

                        # Find the target account in the new COA
                        target_account = new_accounts_by_code.get(target_code)
                        if not target_account:
                            remap_errors.append(
                                f"Target account {target_code} not found for source {source_code}"
                            )
                            continue

                        # Find the source account (may be deactivated after import)
                        source_account = old_accounts_by_code.get(source_code)
                        if not source_account:
                            # Try by code in current DB (might still exist as inactive)
                            source_account = ChartOfAccount.objects.filter(
                                organization=organization, code=source_code
                            ).first()

                        if not source_account:
                            remap_errors.append(
                                f"Source account {source_code} not found"
                            )
                            continue

                        # Remap journal entry lines
                        updated = JournalEntryLine.objects.filter(
                            organization=organization,
                            account=source_account,
                        ).update(account=target_account)

                        if updated > 0:
                            remapped_count += updated
                            logger.info(
                                f"Remapped {updated} journal lines: "
                                f"{source_code} → {target_code}"
                            )

                        # Remap posting rules
                        PostingRule.objects.filter(
                            organization=organization,
                            account=source_account,
                        ).update(account=target_account)

                        # Remap financial accounts (bank, cash, etc.)
                        fa_updated = FinancialAccount.objects.filter(
                            organization=organization,
                            ledger_account=source_account,
                        ).update(ledger_account=target_account)
                        if fa_updated > 0:
                            financial_accounts_remapped += fa_updated
                            logger.info(
                                f"Remapped {fa_updated} financial accounts: "
                                f"{source_code} → {target_code}"
                            )

            # ── Phase 3b: Auto-remap orphaned PostingRules & FinancialAccounts ──
            # PostingRules/FinancialAccounts pointing to deactivated accounts
            # that weren't covered by account_mapping get auto-remapped by
            # matching system_role or code in the new active COA.
            orphan_fixed = 0
            try:
                from apps.finance.models import FinancialAccount
                new_active = {
                    a.code: a for a in ChartOfAccount.objects.filter(
                        organization=organization, is_active=True
                    )
                }
                new_by_role = {}
                for a in new_active.values():
                    if a.system_role:
                        new_by_role[a.system_role] = a

                # Fix PostingRules pointing to inactive accounts
                orphan_rules = PostingRule.objects.filter(
                    organization=organization,
                    account__is_active=False,
                )
                for rule in orphan_rules:
                    old_acct = rule.account
                    # Try: same code in new COA → same system_role → deactivate rule
                    new_acct = new_active.get(old_acct.code)
                    if not new_acct and old_acct.system_role:
                        new_acct = new_by_role.get(old_acct.system_role)
                    if new_acct:
                        rule.account = new_acct
                        rule.save(update_fields=['account'])
                        orphan_fixed += 1
                    else:
                        rule.is_active = False
                        rule.save(update_fields=['is_active'])

                # Fix FinancialAccounts pointing to inactive ledger accounts
                orphan_fas = FinancialAccount.objects.filter(
                    organization=organization,
                    ledger_account__isnull=False,
                    ledger_account__is_active=False,
                )
                for fa in orphan_fas:
                    old_acct = fa.ledger_account
                    new_acct = new_active.get(old_acct.code)
                    if not new_acct and old_acct.system_role:
                        new_acct = new_by_role.get(old_acct.system_role)
                    if new_acct:
                        fa.ledger_account = new_acct
                        fa.save(update_fields=['ledger_account'])
                        financial_accounts_remapped += 1
            except Exception as exc:
                logger.warning("Orphan remap warning (non-fatal): %s", exc)

            # ── Phase 4: Auto-sync posting rules from the template ──
            posting_synced = 0
            try:
                tpl = COATemplate.objects.filter(key=template_key).first()
                if tpl:
                    tpl_rules = COATemplatePostingRule.objects.filter(template=tpl)
                    org_accts = {a.code: a for a in ChartOfAccount.objects.filter(organization=organization, is_active=True)}

                    for rule in tpl_rules:
                        acct = org_accts.get(rule.account_code)
                        if not acct:
                            # Try fuzzy: strip dots / leading zeros
                            norm = rule.account_code.lstrip('0').replace('.', '')
                            for code, a in org_accts.items():
                                if code.lstrip('0').replace('.', '') == norm:
                                    acct = a
                                    break
                        if acct:
                            _, created = PostingRule.objects.update_or_create(
                                organization=organization,
                                event_code=rule.event_code,
                                defaults={
                                    'account': acct,
                                    'module': rule.module or rule.event_code.split('.', 1)[0],
                                    'source': 'SEED',
                                    'description': rule.description,
                                    'is_active': True,
                                },
                            )
                            if created:
                                posting_synced += 1
            except Exception as exc:
                logger.warning("Posting rules auto-sync warning: %s", exc)

            return Response({
                "message": f"Template applied successfully. {posting_synced} posting rules synced. {remapped_count} journal lines remapped. {financial_accounts_remapped} financial accounts remapped. {orphan_fixed} orphan rules fixed.",
                "posting_rules_synced": posting_synced,
                "journal_lines_remapped": remapped_count,
                "financial_accounts_remapped": financial_accounts_remapped,
                "orphan_rules_fixed": orphan_fixed,
                "remap_errors": remap_errors,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
