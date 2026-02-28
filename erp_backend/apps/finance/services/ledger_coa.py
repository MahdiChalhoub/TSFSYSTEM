import uuid
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Sum
from .audit_service import ForensicAuditService

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
        from apps.finance.models import ChartOfAccount, JournalEntry
        from erp.coa_templates import TEMPLATES
        from erp.services import ConfigurationService

        template = TEMPLATES.get(template_key)
        if not template:
            raise ValidationError(f"Template {template_key} not found")

        accounts_data = template.get('accounts', [])
        if not accounts_data:
            raise ValidationError(f"Template {template_key} has no accounts")

        with transaction.atomic():
            has_journal_entries = JournalEntry.objects.filter(organization=organization).exists()

            if reset:
                if has_journal_entries:
                    # Deactivate old accounts instead of deleting (journal entries reference them)
                    ChartOfAccount.objects.filter(organization=organization).update(is_active=False)
                else:
                    # Safe to delete \u2014 no transactions reference these accounts
                    ChartOfAccount.objects.filter(organization=organization).delete()

            # Collect all codes from the new template
            new_template_codes = set()
            for item in accounts_data:
                new_template_codes.add(item['code'])

            # Build accounts from template \u2014 supports flat (parent_code) format
            code_to_account = {}

            # First pass: create/update all accounts without parent relationships
            for item in accounts_data:
                defaults = {
                    "name": item['name'],
                    "type": item['type'],
                    "sub_type": item.get('subType') or item.get('sub_type'),
                    "syscohada_code": item.get('syscohadaCode') or item.get('syscohada_code'),
                    "syscohada_class": item.get('syscohadaClass') or item.get('syscohada_class'),
                    "is_active": True,
                    "is_system_only": item.get('isSystemOnly', False) or item.get('is_system_only', False),
                    "is_hidden": item.get('isHidden', False) or item.get('is_hidden', False),
                    "requires_zero_balance": item.get('requiresZeroBalance', False) or item.get('requires_zero_balance', False),
                }

                acc, created = ChartOfAccount.objects.update_or_create(
                    organization=organization,
                    code=item['code'],
                    defaults=defaults
                )
                code_to_account[item['code']] = acc

            # Second pass: set parent relationships using parent_code
            for item in accounts_data:
                parent_code = item.get('parent_code')
                if parent_code and parent_code in code_to_account:
                    acc = code_to_account[item['code']]
                    acc.parent = code_to_account[parent_code]
                    acc.save(update_fields=['parent'])

            # If reset but couldn't delete, deactivate accounts NOT in the new template
            if reset and has_journal_entries:
                ChartOfAccount.objects.filter(
                    organization=organization,
                    is_active=True
                ).exclude(
                    code__in=new_template_codes
                ).update(is_active=False)

            try:
                ConfigurationService.apply_smart_posting_rules(organization)
            except (AttributeError, Exception):
                pass  # Smart posting rules not available yet
            return True


    @staticmethod
    def migrate_coa(organization, mappings, description):
        from apps.finance.models import ChartOfAccount
        from erp.services import ConfigurationService

        with transaction.atomic():
            source_ids = [m['sourceId'] for m in mappings]
            target_ids = [m['targetId'] for m in mappings]
            
            source_accounts = ChartOfAccount.objects.filter(id__in=source_ids, organization=organization)
            target_accounts = ChartOfAccount.objects.filter(id__in=target_ids, organization=organization)
            
            src_map = {acc.id: acc for acc in source_accounts}
            tgt_map = {acc.id: acc for acc in target_accounts}
            
            official_lines = []
            internal_only_lines = []
            
            for m in mappings:
                src_acc = src_map.get(m['sourceId'])
                tgt_acc = tgt_map.get(m['targetId'])
                
                if not src_acc or not tgt_acc: continue
                
                bal_official = src_acc.balance_official
                bal_total = src_acc.balance
                bal_internal_diff = bal_total - bal_official
                
                if abs(bal_official) > Decimal('0.0001'):
                    if bal_official > 0:
                        official_lines.append({"account_id": src_acc.id, "debit": 0, "credit": bal_official, "description": f"Migration: {description} (Out)"})
                        official_lines.append({"account_id": tgt_acc.id, "debit": bal_official, "credit": 0, "description": f"Migration: {description} (In)"})
                    else:
                        abs_val = abs(bal_official)
                        official_lines.append({"account_id": src_acc.id, "debit": abs_val, "credit": 0, "description": f"Migration: {description} (Out)"})
                        official_lines.append({"account_id": tgt_acc.id, "debit": 0, "credit": abs_val, "description": f"Migration: {description} (In)"})

                if abs(bal_internal_diff) > Decimal('0.0001'):
                    if bal_internal_diff > 0:
                        internal_only_lines.append({"account_id": src_acc.id, "debit": 0, "credit": bal_internal_diff, "description": "Internal Migration (Out)"})
                        internal_only_lines.append({"account_id": tgt_acc.id, "debit": bal_internal_diff, "credit": 0, "description": "Internal Migration (In)"})
                    else:
                        abs_val = abs(bal_internal_diff)
                        internal_only_lines.append({"account_id": src_acc.id, "debit": abs_val, "credit": 0, "description": "Internal Migration (Out)"})
                        internal_only_lines.append({"account_id": tgt_acc.id, "debit": 0, "credit": abs_val, "description": "Internal Migration (In)"})
                
                src_acc.is_active = False
                src_acc.save()

            now = timezone.now()
            
            if official_lines:
                from .ledger_service import LedgerService
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=now,
                    description=description,
                    reference=f"MIG-OFF-{uuid.uuid4().hex[:6].upper()}",
                    status='POSTED',
                    scope='OFFICIAL',
                    lines=official_lines
                )

            if internal_only_lines:
                from .ledger_service import LedgerService
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=now,
                    description=f"{description} (Internal Only Adjustment)",
                    reference=f"MIG-INT-{uuid.uuid4().hex[:6].upper()}",
                    status='POSTED',
                    scope='INTERNAL',
                    lines=internal_only_lines
                )
            
            ConfigurationService.apply_smart_posting_rules(organization)
            
            return True


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

