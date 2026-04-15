import uuid
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Sum
from apps.finance.services.audit_service import ForensicAuditService

from apps.finance.models import JournalEntry, JournalEntryLine, ChartOfAccount, FinancialEvent


class LedgerCOAMixin:

    @staticmethod
    def create_linked_account(organization, name, type, sub_type, parent_id):
        from apps.finance.models import ChartOfAccount
        parent = ChartOfAccount.objects.get(id=parent_id)
        count = ChartOfAccount.objects.filter(parent=parent).count()
        code = f"{parent.code}-{(count + 1):04d}"
        return ChartOfAccount.objects.create(
            organization=organization,
            code=code,
            name=name,
            type=type,
            sub_type=sub_type,
            parent=parent
        )


    @staticmethod
    def apply_coa_template(organization, template_key, reset=False):
        """
        Enterprise-grade COA implementation.
        Populates system roles, financial sections, and performs validation.
        """
        from apps.finance.models import ChartOfAccount
        from erp.coa_templates import TEMPLATES
        from erp.services import ConfigurationService

        template = TEMPLATES.get(template_key)
        if not template:
            raise ValidationError(f"Template {template_key} not found")

        accounts_data = template.get('accounts', [])
        if not accounts_data:
            raise ValidationError(f"Template {template_key} has no accounts")

        # ── Check if structure is locked (will unlock inside transaction) ──
        was_locked = getattr(organization, 'finance_setup_completed', False)

        # ── Smart Registry: Enterprise Role & Section Detection ──────────
        ROLE_MAP = {
            'RECEIVABLE': 'RECEIVABLE',
            'PAYABLE': 'PAYABLE',
            'CASH': 'CASH_ACCOUNT',
            'BANK': 'BANK_ACCOUNT',
            'INVENTORY': 'INVENTORY',
        }
        # Ordered list: checked top-to-bottom, first match wins.
        # Longer/more-specific patterns MUST come before shorter ones.
        NAME_ROLE_MAP = [
            # ── Equity ──
            ('RETAINED EARNINGS', 'RETAINED_EARNINGS'),
            ('CURRENT YEAR PROFIT', 'P_L_SUMMARY'),
            ('RESULTAT', 'P_L_SUMMARY'),  # French COA
            ('OWNER CAPITAL', 'CAPITAL'),
            ('CAPITAL SOCIAL', 'CAPITAL'),  # French/OHADA
            ('DRAWS', 'WITHDRAWAL'),
            ('WITHDRAWAL', 'WITHDRAWAL'),
            # ── Revenue / COGS ──
            ('SALES REVENUE', 'REVENUE'),
            ('VENTES DE MARCHANDISES', 'REVENUE'),  # French/OHADA
            ('COST OF GOODS', 'COGS'),
            ('COGS', 'COGS'),
            # ── Tax ──
            ('VAT COLLECTED', 'VAT_OUTPUT'),
            ('TVA COLLECTEE', 'VAT_OUTPUT'),  # French
            ('TVA FACTUREE', 'VAT_OUTPUT'),   # OHADA
            ('VAT PAYABLE', 'VAT_OUTPUT'),
            ('VAT DEDUCTIBLE', 'VAT_INPUT'),
            ('TVA DEDUCTIBLE', 'VAT_INPUT'),  # French
            ('VAT RECOVERABLE', 'VAT_INPUT'),
            ('TVA RECUPERABLE', 'VAT_INPUT'),  # OHADA
            ('VAT REFUND', 'VAT_INPUT'),
            ('VAT SUSPENSE', 'VAT_OUTPUT'),
            ('AIRSI', 'WITHHOLDING'),
            ('WITHHOLDING', 'WITHHOLDING'),
            ('REVERSE CHARGE', 'VAT_OUTPUT'),
            # ── Financial ──
            ('FOREIGN EXCHANGE GAIN', 'FX_GAIN'),
            ('FOREIGN EXCHANGE LOSS', 'FX_LOSS'),
            ('EXCHANGE GAIN', 'FX_GAIN'),
            ('EXCHANGE LOSS', 'FX_LOSS'),
            ('GAINS DE CHANGE', 'FX_GAIN'),  # French/OHADA
            ('PERTES DE CHANGE', 'FX_LOSS'),  # French/OHADA
            ('BAD DEBT', 'BAD_DEBT'),
            ('ROUNDING', 'ROUNDING_DIFF'),
            # ── Inventory ──
            ('GOODS RECEIVED NOT INVOICED', 'GRNI'),
            # ── Assets ──
            ('ACCUMULATED DEPRECIATION', 'ACCUM_DEPRECIATION'),
            ('ACCUMULATED AMORTIZATION', 'ACCUM_DEPRECIATION'),
            ('AMORTISSEMENTS', 'ACCUM_DEPRECIATION'),  # French
            # ── Other ──
            ('DISCOUNT RECEIVED', 'DISCOUNT_RECEIVED'),
            ('FREIGHT', 'DELIVERY_FEES'),
        ]

        # Patterns that should NOT match broader terms above
        ROLE_EXCLUSIONS = {
            'REVENUE': {'DEFERRED REVENUE', 'UNEARNED REVENUE', 'PRODUITS CONSTATES'},
            'CAPITAL': {'PRIMES LIEES AU CAPITAL', 'CAPITAL GAIN', 'WORKING CAPITAL'},
        }
        
        SECTION_MAP = {
            'ASSET': 'BS_ASSET',
            'LIABILITY': 'BS_LIABILITY',
            'EQUITY': 'BS_EQUITY',
            'INCOME': 'IS_REVENUE',
            'EXPENSE': 'IS_EXPENSE',
        }

        parent_codes = {item.get('parent_code') for item in accounts_data if item.get('parent_code')}

        with transaction.atomic():
            # ── Temporarily unlock structure for template import ─────
            # ChartOfAccount.save() blocks parent changes when locked.
            # Unlock inside the transaction so it rolls back on failure.
            if was_locked:
                organization.finance_setup_completed = False
                organization.save(update_fields=['finance_setup_completed'])

            if reset:
                ChartOfAccount.objects.filter(organization=organization).update(is_active=False)

            # ── High Performance First Pass ──
            # For simplicity in multi-tenancy we still use update_or_create to handle re-runs gracefully
            code_to_account = {}
            for item in accounts_data:
                sub_type = item.get('subType') or item.get('sub_type')
                name_upper = item['name'].upper()
                is_header = item['code'] in parent_codes
                
                # Resolve System Role: 1. From JSON 2. From subType 3. Heuristic
                system_role = item.get('system_role') or item.get('systemRole')
                if not system_role:
                    system_role = ROLE_MAP.get(sub_type)
                if not system_role:
                    for pattern, role in NAME_ROLE_MAP:
                        if pattern in name_upper:
                            # Check exclusions: skip if an exclusion pattern also matches
                            exclusions = ROLE_EXCLUSIONS.get(role, set())
                            if exclusions and any(excl in name_upper for excl in exclusions):
                                continue
                            system_role = role
                            break


                defaults = {
                    "name": item['name'],
                    "type": item['type'],
                    "sub_type": sub_type,
                    "syscohada_code": item.get('syscohadaCode') or item.get('syscohada_code'),
                    "syscohada_class": item.get('syscohadaClass') or item.get('syscohada_class'),
                    "is_active": True,
                    "is_system_only": item.get('isSystemOnly', False) or item.get('is_system_only', False),
                    "is_hidden": item.get('isHidden', False) or item.get('is_hidden', False),
                    "requires_zero_balance": item.get('requiresZeroBalance', False) or item.get('requires_zero_balance', False),
                    # ── Enterprise Metadata ──
                    "system_role": system_role,
                    "financial_section": SECTION_MAP.get(item['type']),
                    "template_origin": template_key,
                    "template_version": "2.2",
                    "allow_posting": item.get('allow_posting', not is_header),
                    "is_control_account": item.get('is_control_account', sub_type in ['RECEIVABLE', 'PAYABLE']),
                    "subledger_type": item.get('subledger_type', 'CUSTOMER' if sub_type == 'RECEIVABLE' else 'SUPPLIER' if sub_type == 'PAYABLE' else None),
                    "allow_reconciliation": item.get('allow_reconciliation', sub_type in ['RECEIVABLE', 'PAYABLE', 'BANK']),
                    "currency": item.get('currency'),
                }

                acc, created = ChartOfAccount.objects.update_or_create(
                    organization=organization, code=item['code'], defaults=defaults
                )
                code_to_account[item['code']] = acc

            # ── Link Parents ──
            for item in accounts_data:
                if item.get('parent_code') and item['parent_code'] in code_to_account:
                    acc = code_to_account[item['code']]
                    acc.parent = code_to_account[item['parent_code']]
                    acc.save(update_fields=['parent'])

            # ── Rebuild Paths (Root First) ──
            def rebuild_paths_recursive(accounts, parent_path=None):
                for acc in accounts:
                    acc.path = f"{parent_path}.{acc.code}" if parent_path else acc.code
                    acc.save(update_fields=['path'])
                    children = [a for a in code_to_account.values() if a.parent_id == acc.id]
                    if children: rebuild_paths_recursive(children, acc.path)
            
            rebuild_paths_recursive([a for a in code_to_account.values() if not a.parent_id])

            # ── Post-Import Cleanup ──────────────────────────────────────
            # After a reset+import, ensure ONLY the new template's accounts are active.
            # Accounts from other templates must be deactivated.
            # Never delete — PROTECT constraints on dozens of FK references
            # will poison the PostgreSQL transaction and roll back everything.
            if reset:
                new_template_codes = set(item['code'] for item in accounts_data)
                stale_qs = ChartOfAccount.objects.filter(
                    organization=organization,
                    is_active=True,
                ).exclude(code__in=new_template_codes)
                stale_deactivated = stale_qs.update(is_active=False)
                if stale_deactivated:
                    logging.getLogger(__name__).info(
                        f"Deactivated {stale_deactivated} accounts not in template {template_key}"
                    )

            # Apply Smart Posting Rules (savepoint-protected so a DB error
            # inside doesn't poison the outer transaction)
            try:
                sid = transaction.savepoint()
                ConfigurationService.apply_smart_posting_rules(organization)
                transaction.savepoint_commit(sid)
            except Exception:
                transaction.savepoint_rollback(sid)

            # Mark COA setup as COMPLETED
            try:
                sid2 = transaction.savepoint()
                from django.utils import timezone as tz
                ConfigurationService.save_setting(organization, 'coa_setup', {
                    'status': 'COMPLETED',
                    'selectedTemplate': template_key,
                    'postingRulesConfigured': True,
                    'completedAt': tz.now().isoformat(),
                })
                transaction.savepoint_commit(sid2)
            except Exception:
                transaction.savepoint_rollback(sid2)

            # ── Re-lock structure if it was locked before import ──
            if was_locked:
                organization.finance_setup_completed = True
                organization.save(update_fields=['finance_setup_completed'])

            return True

    @staticmethod
    def validate_finance_readiness(organization):
        """
        Verify that all critical enterprise roles are mapped to active accounts.
        Mandatory for 'COMPLETED' status in the wizard.
        """
        from apps.finance.models import ChartOfAccount
        MANDATORY_ROLES = [
            'RECEIVABLE', 'PAYABLE', 'CASH_ACCOUNT', 
            'REVENUE', 'COGS', 'INVENTORY',
            'RETAINED_EARNINGS', 'P_L_SUMMARY'
        ]
        
        missing = []
        for role in MANDATORY_ROLES:
            if not ChartOfAccount.objects.filter(organization=organization, system_role=role, is_active=True).exists():
                missing.append(role)
        
        if missing:
            raise ValidationError(f"Missing mandatory accounts for roles: {', '.join(missing)}")
        
        # Mark Org Setup as Completed
        organization.finance_setup_completed = True
        organization.save(update_fields=['finance_setup_completed'])
        return True


    @staticmethod
    def migrate_coa(organization, mappings, description, all_source_ids=None,
                    target_template_key=None, target_template_accounts=None):
        """
        V2 COA Migration — In-Place Rename Architecture.
        
        Instead of creating new accounts and transferring balances via JEs,
        this approach RENAMES existing accounts to match the target template.
        JE lines keep pointing to the same account IDs → balances preserved automatically.
        
        Account categories:
        1. With balance → RENAME (code, name, type, template_origin)
        2. Custom sub-account → UPDATE parent_id
        3. Zero balance WITH JE activity → RENAME
        4. Zero balance WITHOUT activity → DELETE
        
        After mapped accounts are renamed, any remaining target template accounts
        that weren't mapped to are CREATED as new accounts.
        """
        from apps.finance.models import ChartOfAccount
        from erp.services import ConfigurationService
        logger = logging.getLogger(__name__)

        if not target_template_key:
            raise ValidationError("target_template_key is required for V2 migration")

        was_locked = getattr(organization, 'finance_setup_completed', False)

        with transaction.atomic():
            # ── Temporarily unlock structure for migration ───────────
            if was_locked:
                organization.finance_setup_completed = False
                organization.save(update_fields=['finance_setup_completed'])

            # ── Load target template accounts into a lookup ──
            target_lookup = {}  # code → {name, type, sub_type, parent_code, ...}
            if target_template_accounts:
                for t in target_template_accounts:
                    target_lookup[t['code']] = t

            # ── Get all current accounts with their JE activity ──
            all_accounts = ChartOfAccount.objects.filter(
                organization=organization, is_active=True
            )
            account_map = {acc.id: acc for acc in all_accounts}
            
            # Check which accounts have JE line activity
            from django.db.models import Count
            activity_map = dict(
                JournalEntryLine.objects.filter(
                    organization=organization
                ).values('account_id').annotate(
                    line_count=Count('id')
                ).values_list('account_id', 'line_count')
            )

            # ── Phase 1: Prefix ALL current account codes to avoid collisions ──
            # Target codes may overlap with existing IFRS codes (e.g., IFRS "15" exists, 
            # Lebanese PCN also uses "15"). Prefixing eliminates UNIQUE constraint violations.
            for acc in all_accounts:
                acc.code = f"_MIG_{acc.id}_{acc.code}"
                acc.save(update_fields=['code'])

            # ── Phase 2: Rename mapped accounts to target codes ──
            mapped_source_ids = set()
            mapped_target_codes = set()
            
            for m in mappings:
                source_id = m.get('sourceId')
                target_code = m.get('targetCode')
                
                if not source_id or not target_code:
                    continue
                    
                acc = account_map.get(source_id)
                if not acc:
                    continue
                
                target_info = target_lookup.get(target_code)
                if not target_info:
                    logger.warning(f"Target code {target_code} not found in template for account {acc.code}")
                    continue
                
                # RENAME: update code, name, type, template_origin
                acc.code = target_info['code']
                acc.name = target_info['name']
                acc.type = target_info.get('type', acc.type)
                acc.sub_type = target_info.get('sub_type') or target_info.get('subType') or acc.sub_type
                acc.template_origin = target_template_key
                acc.template_version = "2.2"
                acc.financial_section = {
                    'ASSET': 'BS_ASSET', 'LIABILITY': 'BS_LIABILITY',
                    'EQUITY': 'BS_EQUITY', 'INCOME': 'IS_REVENUE', 'EXPENSE': 'IS_EXPENSE'
                }.get(acc.type, acc.financial_section)
                
                acc.save(update_fields=[
                    'code', 'name', 'type', 'sub_type', 'template_origin',
                    'template_version', 'financial_section'
                ])
                
                mapped_source_ids.add(source_id)
                mapped_target_codes.add(target_code)
                logger.info(f"Migrated account {source_id}: → {target_code} ({target_info['name']})")

            # ── Phase 3: Handle unmapped accounts (still prefixed) ──
            unmapped_accounts = [
                acc for acc in all_accounts 
                if acc.id not in mapped_source_ids
            ]
            
            deleted_count = 0
            deactivated_count = 0
            
            # Deactivate ALL unmapped accounts in a single bulk operation
            # We don't delete them to avoid FK constraint issues with PostingRules,
            # OpeningBalances, etc. Deactivated accounts are hidden from the UI.
            unmapped_ids = [acc.id for acc in unmapped_accounts]
            if unmapped_ids:
                deactivated_count = ChartOfAccount.objects.filter(
                    id__in=unmapped_ids
                ).update(is_active=False)

            # ── Step 3: Create missing target template accounts ──
            # Any target code that wasn't mapped to an existing account
            created_count = 0
            code_to_new_acc = {}
            for code, info in sorted(target_lookup.items()):
                if code in mapped_target_codes:
                    continue
                # Check if account with this code already exists (from a previous import)
                existing = ChartOfAccount.objects.filter(
                    organization=organization, code=code
                ).first()
                if existing:
                    # Reactivate and update
                    existing.is_active = True
                    existing.name = info['name']
                    existing.type = info.get('type', existing.type)
                    existing.template_origin = target_template_key
                    existing.save(update_fields=['is_active', 'name', 'type', 'template_origin'])
                    code_to_new_acc[code] = existing
                    continue
                    
                acc = ChartOfAccount.objects.create(
                    organization=organization,
                    code=code,
                    name=info['name'],
                    type=info.get('type', 'ASSET'),
                    sub_type=info.get('sub_type') or info.get('subType'),
                    template_origin=target_template_key,
                    template_version="2.2",
                    is_active=True,
                    allow_posting=info.get('allow_posting', True),
                    financial_section={
                        'ASSET': 'BS_ASSET', 'LIABILITY': 'BS_LIABILITY',
                        'EQUITY': 'BS_EQUITY', 'INCOME': 'IS_REVENUE', 'EXPENSE': 'IS_EXPENSE'
                    }.get(info.get('type', 'ASSET')),
                )
                code_to_new_acc[code] = acc
                created_count += 1

            # ── Step 4: Resolve parent_ids based on target template hierarchy ──
            all_active = {
                a.code: a for a in 
                ChartOfAccount.objects.filter(organization=organization, is_active=True)
            }
            for code, info in target_lookup.items():
                parent_code = info.get('parent_code')
                if parent_code and code in all_active and parent_code in all_active:
                    acc = all_active[code]
                    new_parent = all_active[parent_code]
                    if acc.parent_id != new_parent.id:
                        acc.parent = new_parent
                        acc.path = f"{new_parent.path}.{acc.code}" if new_parent.path else acc.code
                        acc.save(update_fields=['parent', 'path'])

            # ── Step 5: Rebuild paths for root accounts ──
            for acc in ChartOfAccount.objects.filter(
                organization=organization, is_active=True, parent__isnull=True
            ):
                if acc.path != acc.code:
                    acc.path = acc.code
                    acc.save(update_fields=['path'])

            # ── Step 6: Apply smart posting rules ──
            try:
                ConfigurationService.apply_smart_posting_rules(organization)
            except Exception:
                pass

            # ── Step 7: Mark COA setup as COMPLETED ──
            try:
                from django.utils import timezone as tz
                ConfigurationService.save_setting(organization, 'coa_setup', {
                    'status': 'COMPLETED',
                    'selectedTemplate': target_template_key,
                    'postingRulesConfigured': True,
                    'migrationCompleted': True,
                    'completedAt': tz.now().isoformat(),
                })
            except Exception:
                pass

            # ── Re-lock structure if it was locked before migration ──
            if was_locked:
                organization.finance_setup_completed = True
                organization.save(update_fields=['finance_setup_completed'])

            logger.info(
                f"Migration complete: {len(mapped_source_ids)} renamed, "
                f"{deleted_count} deleted, {created_count} created"
            )

            return {
                'renamed': len(mapped_source_ids),
                'deleted': deleted_count,
                'created': created_count,
            }


    @staticmethod
    def get_chart_of_accounts(organization, scope='OFFICIAL', include_inactive=False):
        from apps.finance.models import ChartOfAccount, JournalEntryLine
        qs = ChartOfAccount.objects.filter(organization=organization).order_by('code')
        if not include_inactive:
            qs = qs.filter(is_active=True)
        
        # SQL Aggregation (Massive speed gain over manual mapping)
        balance_qs = JournalEntryLine.objects.filter(
            organization=organization, 
            journal_entry__status='POSTED'
        )
        if scope == 'OFFICIAL':
            balance_qs = balance_qs.filter(journal_entry__scope='OFFICIAL')
        
        balance_map = {
            b['account_id']: Decimal(str(b['net'] or '0')) 
            for b in balance_qs.values('account_id').annotate(net=Sum('debit') - Sum('credit'))
        }
        
        accounts = list(qs)
        account_map = {acc.id: acc for acc in accounts}
        for acc in accounts: 
            acc.temp_balance = balance_map.get(acc.id, Decimal('0'))
            acc.temp_children = []
            
        roots = []
        for acc in accounts:
            if acc.parent_id and acc.parent_id in account_map: 
                account_map[acc.parent_id].temp_children.append(acc)
            else: 
                roots.append(acc)
                
        def rollup(node):
            node.rollup_balance = node.temp_balance + sum(rollup(child) for child in node.temp_children)
            return node.rollup_balance
            
        for root in roots: rollup(root)
        
        return accounts


    @staticmethod
    def get_trial_balance(organization, as_of_date=None, scope='INTERNAL'):
        from apps.finance.models import ChartOfAccount, JournalEntryLine
        accounts_qs = ChartOfAccount.objects.filter(organization=organization, is_active=True).order_by('code')
        
        lines_qs = JournalEntryLine.objects.filter(organization=organization, journal_entry__status='POSTED')
        if as_of_date:
            lines_qs = lines_qs.filter(journal_entry__transaction_date__lte=as_of_date)
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
            
        balance_map = {
            b['account_id']: Decimal(str(b['net'] or '0')) 
            for b in lines_qs.values('account_id').annotate(net=Sum('debit') - Sum('credit'))
        }
        
        accounts = list(accounts_qs)
        account_map = {acc.id: acc for acc in accounts}
        for acc in accounts: 
            acc.temp_balance = balance_map.get(acc.id, Decimal('0'))
            acc.temp_children = []
        
        roots = []
        for acc in accounts:
            if acc.parent_id and acc.parent_id in account_map:
                account_map[acc.parent_id].temp_children.append(acc)
            else:
                roots.append(acc)
                
        def rollup(node):
            node.rollup_balance = node.temp_balance + sum(rollup(child) for child in node.temp_children)
            return node.rollup_balance
            
        for root in roots: rollup(root)
        return accounts


    @staticmethod
    def get_profit_loss(organization, start_date=None, end_date=None, scope='INTERNAL'):
        accounts = LedgerCOAMixin.get_trial_balance(organization, as_of_date=end_date, scope=scope)
        income_accs = [a for a in accounts if a.type == 'INCOME']
        expense_accs = [a for a in accounts if a.type == 'EXPENSE']
        total_income = abs(sum((a.rollup_balance for a in income_accs if a.parent is None), Decimal('0')))
        total_expenses = sum((a.rollup_balance for a in expense_accs if a.parent is None), Decimal('0'))
        return {"scope": scope, "revenue": total_income, "expenses": total_expenses, "net_income": total_income - total_expenses}


    @staticmethod
    def get_balance_sheet(organization, as_of_date=None, scope='INTERNAL'):
        accounts = LedgerCOAMixin.get_trial_balance(organization, as_of_date=as_of_date, scope=scope)
        assets = [a for a in accounts if a.type == 'ASSET']
        liabilities = [a for a in accounts if a.type == 'LIABILITY']
        equity = [a for a in accounts if a.type == 'EQUITY']
        total_assets = sum((a.rollup_balance for a in assets if a.parent is None), Decimal('0'))
        total_liabilities = abs(sum((a.rollup_balance for a in liabilities if a.parent is None), Decimal('0')))
        total_equity = abs(sum((a.rollup_balance for a in equity if a.parent is None), Decimal('0')))
        cur_earnings = LedgerCOAMixin.get_profit_loss(organization, end_date=as_of_date, scope=scope)['net_income']
        return {"scope": scope, "assets": total_assets, "liabilities": total_liabilities, "equity": total_equity, "current_earnings": cur_earnings, "total_liabilities_and_equity": total_liabilities + total_equity + cur_earnings, "is_balanced": abs(total_assets - (total_liabilities + total_equity + cur_earnings)) < Decimal('0.01')}


    @staticmethod
    def validate_closure(organization, fiscal_period=None, fiscal_year=None):
        """
        Validates that all control accounts (requires_zero_balance=True) 
        have a zero balance before closure.
        """
        from apps.finance.models import ChartOfAccount
        control_accounts = ChartOfAccount.objects.filter(
            organization=organization, 
            requires_zero_balance=True,
            is_active=True
        )
        for acc in control_accounts:
            if abs(acc.balance) > Decimal('0.001'):
                raise ValidationError(f"Control account {acc.code} ({acc.name}) must have zero balance before closure. Current balance: {acc.balance}")
        return True


    @staticmethod
    def get_account_statement(organization, account_id, start_date=None, end_date=None, scope='INTERNAL'):
        from apps.finance.models import ChartOfAccount, JournalEntryLine
        account = ChartOfAccount.objects.get(id=account_id, organization=organization)
        
        opening_qs = JournalEntryLine.objects.filter(
            organization=organization,
            account=account,
            journal_entry__status='POSTED'
        )
        if start_date:
            opening_qs = opening_qs.filter(journal_entry__transaction_date__lt=start_date)
        if scope == 'OFFICIAL':
            opening_qs = opening_qs.filter(journal_entry__scope='OFFICIAL')
            
        opening_balance = opening_qs.aggregate(net=Sum('debit') - Sum('credit'))['net'] or Decimal('0')
        
        lines_qs = JournalEntryLine.objects.filter(
            organization=organization,
            account=account,
            journal_entry__status='POSTED'
        ).select_related('journal_entry').order_by('journal_entry__transaction_date')
        
        if start_date:
            lines_qs = lines_qs.filter(journal_entry__transaction_date__gte=start_date)
        if end_date:
            lines_qs = lines_qs.filter(journal_entry__transaction_date__lte=end_date)
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
            
        return {
            "account": account,
            "opening_balance": opening_balance,
            "lines": lines_qs
        }

