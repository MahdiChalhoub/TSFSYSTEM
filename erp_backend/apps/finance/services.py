"""
Finance Module Services
Canonical home for all finance/accounting business logic.

Cross-module imports are gated with try/except to prevent crashes
when dependent modules are removed or disabled.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum, F
import uuid
import math
import logging

logger = logging.getLogger(__name__)


class ForensicAuditService:
    @staticmethod
    def log_mutation(organization, user, model_name, object_id, change_type, payload=None):
        from apps.finance.models import ForensicAuditLog
        try:
            ForensicAuditLog.objects.create(
                organization=organization,
                actor=user,
                model_name=model_name,
                object_id=str(object_id),
                change_type=change_type,
                payload=payload
            )
        except Exception as e:
            # Audit logging should not crash the main transaction, but we log it
            logger.error(f"Audit Logging Failed: {str(e)}")


class LedgerService:
    @staticmethod
    def create_journal_entry(organization, transaction_date, description, lines, reference=None, status='DRAFT', scope='OFFICIAL', site_id=None, user=None, **kwargs):
        from apps.finance.models import FiscalPeriod, JournalEntry, JournalEntryLine
        from apps.finance.services import SequenceService
        
        total_debit = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
        total_credit = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
        if abs(total_debit - total_credit) > Decimal('0.001'): 
            raise ValidationError("Journal entry is out of balance.")

        with transaction.atomic():
            fp = FiscalPeriod.objects.filter(organization=organization, start_date__lte=transaction_date, end_date__gte=transaction_date).first()
            if not fp: raise ValidationError(f"No fiscal period found for date {transaction_date}")
            if fp.is_closed: raise ValidationError(f"Fiscal period {fp.name} is closed. Cannot post transactions.")
            if fp.fiscal_year.is_hard_locked: raise ValidationError(f"Fiscal year {fp.fiscal_year.name} is hard-locked.")
            
            # Use gapless sequence for references if none provided
            if not reference:
                reference = SequenceService.get_next_number(organization, f"JOURNAL_{scope}")
            
            # Enforcement: System-only accounts check
            internal_bypass = kwargs.get('internal_bypass', False)
            if not internal_bypass:
                from apps.finance.models import ChartOfAccount
                account_ids = [l['account_id'] for l in lines]
                system_accounts = ChartOfAccount.objects.filter(id__in=account_ids, is_system_only=True)
                if system_accounts.exists():
                    codes = ", ".join([acc.code for acc in system_accounts])
                    raise ValidationError(f"Manual posting to system-only accounts is forbidden: {codes}")
            
            entry = JournalEntry.objects.create(
                organization=organization, 
                transaction_date=transaction_date, 
                description=description, 
                reference=reference, 
                fiscal_year=fp.fiscal_year, 
                fiscal_period=fp, 
                status='DRAFT', # Always create as DRAFT initially
                scope=scope, 
                site_id=site_id,
                created_by=user
            )
            for l in lines: 
                JournalEntryLine.objects.create(
                    organization=organization, 
                    journal_entry=entry, 
                    account_id=l['account_id'], 
                    debit=Decimal(str(l['debit'])), 
                    credit=Decimal(str(l['credit'])), 
                    description=l.get('description', description)
                )
            
            if status == 'POSTED': 
                LedgerService.post_journal_entry(entry, user=user)

            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="JournalEntry",
                object_id=entry.id,
                change_type="CREATE",
                payload={"reference": reference, "total_amount": str(total_debit)}
            )
            return entry

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
    def post_journal_entry(entry):
        from apps.finance.models import JournalEntry
        if entry.status == 'POSTED' and entry.posted_at: return
        with transaction.atomic():
            lines = entry.lines.select_related('account').all()
            for line in lines:
                net = line.debit - line.credit
                if entry.scope == 'OFFICIAL' or entry.scope == 'INTERNAL':
                    line.account.__class__.objects.filter(id=line.account_id).update(
                        balance=F('balance') + net,
                        balance_official=F('balance_official') + net if entry.scope == 'OFFICIAL' else F('balance_official')
                    )
                else:
                    line.account.__class__.objects.filter(id=line.account_id).update(
                        balance=F('balance') + net
                    )

            # Quantum Audit: Secure the cryptographic chain
            # 1. Fetch the hash of the last POSTED entry in this organization
            last_entry = JournalEntry.objects.filter(
                organization=entry.organization,
                status='POSTED'
            ).exclude(id=entry.id).order_by('-posted_at', '-id').first()
            
            entry.previous_hash = last_entry.entry_hash if last_entry else "GENESIS"
            
            # 2. Transition status (required for hash calculation context)
            entry.status = 'POSTED'
            entry.posted_at = timezone.now()
            
            # 3. Calculate and seal the entry's unique SHA-256 signature
            entry.entry_hash = entry.calculate_hash()
            
            # 4. Save with immutability bypass (since we are THE posting service)
            entry.save(force_audit_bypass=True)

            ForensicAuditService.log_mutation(
                organization=entry.organization,
                user=entry.posted_by,
                model_name="JournalEntry",
                object_id=entry.id,
                change_type="POST",
                payload={"reference": entry.reference, "hash": entry.entry_hash}
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
                    # Safe to delete — no transactions reference these accounts
                    ChartOfAccount.objects.filter(organization=organization).delete()

            # Collect all codes from the new template
            new_template_codes = set()
            for item in accounts_data:
                new_template_codes.add(item['code'])

            # Build accounts from template — supports flat (parent_code) format
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
        from apps.finance.models import ChartOfAccount, JournalEntry, JournalEntryLine, FiscalYear, FiscalPeriod
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
                        internal_only_lines.append({"account_id": src_acc.id, "debit": 0, "credit": bal_internal_diff, "description": f"Internal Migration (Out)"})
                        internal_only_lines.append({"account_id": tgt_acc.id, "debit": bal_internal_diff, "credit": 0, "description": f"Internal Migration (In)"})
                    else:
                        abs_val = abs(bal_internal_diff)
                        internal_only_lines.append({"account_id": src_acc.id, "debit": abs_val, "credit": 0, "description": f"Internal Migration (Out)"})
                        internal_only_lines.append({"account_id": tgt_acc.id, "debit": 0, "credit": abs_val, "description": f"Internal Migration (In)"})
                
                src_acc.is_active = False
                src_acc.save()

            now = timezone.now()
            
            if official_lines:
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
        accounts = LedgerService.get_trial_balance(organization, as_of_date=end_date, scope=scope)
        income_accs = [a for a in accounts if a.type == 'INCOME']
        expense_accs = [a for a in accounts if a.type == 'EXPENSE']
        total_income = abs(sum((a.rollup_balance for a in income_accs if a.parent is None), Decimal('0')))
        total_expenses = sum((a.rollup_balance for a in expense_accs if a.parent is None), Decimal('0'))
        return {"scope": scope, "revenue": total_income, "expenses": total_expenses, "net_income": total_income - total_expenses}

    @staticmethod
    def get_balance_sheet(organization, as_of_date=None, scope='INTERNAL'):
        accounts = LedgerService.get_trial_balance(organization, as_of_date=as_of_date, scope=scope)
        assets = [a for a in accounts if a.type == 'ASSET']
        liabilities = [a for a in accounts if a.type == 'LIABILITY']
        equity = [a for a in accounts if a.type == 'EQUITY']
        total_assets = sum((a.rollup_balance for a in assets if a.parent is None), Decimal('0'))
        total_liabilities = abs(sum((a.rollup_balance for a in liabilities if a.parent is None), Decimal('0')))
        total_equity = abs(sum((a.rollup_balance for a in equity if a.parent is None), Decimal('0')))
        cur_earnings = LedgerService.get_profit_loss(organization, end_date=as_of_date, scope=scope)['net_income']
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
    def post_journal_entry(entry, user=None):
        if entry.status == 'POSTED' and entry.posted_at: return 
        
        from django.db.models import Sum
        from apps.finance.models import ChartOfAccount
        
        with transaction.atomic():
            # Final integrity check: Double-Entry Proof
            totals = entry.lines.aggregate(
                total_debit=Sum('debit'),
                total_credit=Sum('credit')
            )
            debit = totals.get('total_debit') or Decimal('0')
            credit = totals.get('total_credit') or Decimal('0')
            
            if abs(debit - credit) > Decimal('0.001'):
                raise ValidationError(f"Cannot post unbalanced journal entry (Dr: {debit}, Cr: {credit})")

            # Final check: Period lockdown on post bit
            if entry.fiscal_period.is_closed:
                raise ValidationError(f"Cannot post to closed period {entry.fiscal_period.name}.")

            # Professional Audit: Serializability via select_for_update
            # We lock all affected accounts in a consistent order (by ID) to prevent deadlocks
            account_ids = entry.lines.values_list('account_id', flat=True).distinct().order_by('id')
            accounts_map = {acc.id: acc for acc in ChartOfAccount.objects.select_for_update().filter(id__in=account_ids)}

            lines = entry.lines.all()
            for line in lines:
                acc = accounts_map.get(line.account_id)
                if not acc: continue
                
                net = line.debit - line.credit
                
                # Update account instance (in-memory lock and subsequent save)
                acc.balance += net
                if entry.scope == 'OFFICIAL':
                    acc.balance_official += net
                acc.save()

            entry.status = 'POSTED'
            entry.posted_at = timezone.now()
            entry.posted_by = user
            entry.save()

            ForensicAuditService.log_mutation(
                organization=entry.organization,
                user=user,
                model_name="JournalEntry",
                object_id=entry.id,
                change_type="POST"
            )

    @staticmethod
    def update_journal_entry(organization, entry_id, transaction_date=None, description=None, status=None, lines=None, user=None):
        from apps.finance.models import JournalEntry, JournalEntryLine, FiscalPeriod
        with transaction.atomic():
            entry = JournalEntry.objects.get(id=entry_id, organization=organization)
            if entry.is_locked: raise ValidationError("Cannot update a locked journal entry")
            
            # Period enforcement
            if transaction_date:
                fp = FiscalPeriod.objects.filter(organization=organization, start_date__lte=transaction_date, end_date__gte=transaction_date).first()
                if not fp: raise ValidationError("No fiscal period found for new date")
                if fp.is_closed: raise ValidationError(f"Target fiscal period {fp.name} is closed.")
                if fp.fiscal_year.is_hard_locked: raise ValidationError("Target fiscal year is hard-locked.")
                entry.transaction_date = transaction_date
                entry.fiscal_period = fp
                entry.fiscal_year = fp.fiscal_year

            if description: entry.description = description
            if status:
                if entry.status == 'POSTED' and status != 'POSTED':
                    raise ValidationError("Cannot un-post a journal entry. Use reverse instead.")
                entry.status = status
            
            if lines is not None:
                # Basic balance check for new lines
                total_debit = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
                total_credit = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
                if abs(total_debit - total_credit) > Decimal('0.001'): raise ValidationError("Journal entry is out of balance.")
                
                entry.lines.all().delete()
                for l in lines:
                    JournalEntryLine.objects.create(
                        organization=organization,
                        journal_entry=entry,
                        account_id=l['account_id'],
                        debit=Decimal(str(l['debit'])),
                        credit=Decimal(str(l['credit'])),
                        description=l.get('description', entry.description)
                    )
            
            entry.save()
            if entry.status == 'POSTED' and not entry.posted_at:
                LedgerService.post_journal_entry(entry, user=user)
            
            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="JournalEntry",
                object_id=entry.id,
                change_type="UPDATE",
                payload={"updated_fields": list(filter(None, [
                    "date" if transaction_date else None,
                    "desc" if description else None,
                    "status" if status else None,
                    "lines" if lines else None
                ]))}
            )
            return entry

    @staticmethod
    def reverse_journal_entry(organization, entry_id, user=None):
        from apps.finance.models import JournalEntry, JournalEntryLine, FiscalPeriod
        from apps.finance.services import SequenceService
        
        with transaction.atomic():
            original = JournalEntry.objects.get(id=entry_id, organization=organization)
            if original.status != 'POSTED': 
                raise ValidationError("Only POSTED entries can be reversed")
            
            # Period enforcement for reversal
            now = timezone.now()
            fp = FiscalPeriod.objects.filter(organization=organization, start_date__lte=now, end_date__gte=now).first()
            if not fp or fp.is_closed:
                # If current date is closed, try the original entry's period if it's still open
                if not original.fiscal_period.is_closed:
                    fp = original.fiscal_period
                else:
                    raise ValidationError("Current fiscal period is closed and original period is closed. Cannot reverse.")

            reversal_ref = SequenceService.get_next_number(organization, "JOURNAL_REVERSAL")
            
            reversal = JournalEntry.objects.create(
                organization=organization,
                transaction_date=now,
                description=f"Reversal of {original.description}",
                reference=reversal_ref,
                fiscal_year=fp.fiscal_year,
                fiscal_period=fp,
                status='POSTED',
                scope=original.scope,
                site=original.site,
                created_by=user
            )
            
            for line in original.lines.all():
                JournalEntryLine.objects.create(
                    organization=organization,
                    journal_entry=reversal,
                    account_id=line.account_id,
                    debit=line.credit,
                    credit=line.debit,
                    description=f"Reversal Line: {line.description}"
                )
            
            LedgerService.post_journal_entry(reversal, user=user)
            original.is_locked = True
            original.save()

            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="JournalEntry",
                object_id=original.id,
                change_type="REVERSE",
                payload={"reversal_id": reversal.id}
            )
            return reversal

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

    @staticmethod
    def recalculate_balances(organization):
        from apps.finance.models import ChartOfAccount, JournalEntry
        with transaction.atomic():
            ChartOfAccount.objects.filter(organization=organization).update(balance=Decimal('0'), balance_official=Decimal('0'))
            entries = JournalEntry.objects.filter(organization=organization, status='POSTED').order_by('posted_at')
            for entry in entries:
                old_posted_at = entry.posted_at
                entry.posted_at = None
                LedgerService.post_journal_entry(entry)
                entry.posted_at = old_posted_at
                entry.save()
        return True

    @staticmethod
    def clear_all_data(organization):
        from apps.finance.models import JournalEntry, Transaction, FinancialEvent, Loan, ChartOfAccount
        with transaction.atomic():
            JournalEntry.objects.filter(organization=organization).delete()
            Transaction.objects.filter(organization=organization).delete()
            FinancialEvent.objects.filter(organization=organization).delete()
            Loan.objects.filter(organization=organization).delete()
            ChartOfAccount.objects.filter(organization=organization).update(balance=Decimal('0'), balance_official=Decimal('0'))
        return True


class FinancialAccountService:
    @staticmethod
    def create_account(organization, name, type, currency, site_id=None):
        from apps.finance.models import ChartOfAccount, FinancialAccount
        parent = ChartOfAccount.objects.filter(organization=organization, sub_type=type).first()
        if not parent: raise ValidationError(f"No parent for {type}")
        with transaction.atomic():
            last = ChartOfAccount.objects.filter(organization=organization, code__startswith=f"{parent.code}.").order_by('-code').first()
            suffix = (int(last.code.split('.')[-1]) + 1) if last else 1
            code = f"{parent.code}.{str(suffix).zfill(3)}"
            acc = ChartOfAccount.objects.create(organization=organization, code=code, name=name, type='ASSET', parent=parent, is_system_only=True, is_active=True, balance=Decimal('0.00'))
            account = FinancialAccount.objects.create(
                organization=organization, name=name, type=type, currency=currency,
                site_id=site_id, linked_coa=acc
            )
            
            # Implementation Plan Phase 3: Add Audit Logging for Account Creation
            ForensicAuditService.log_mutation(
                organization=organization,
                user=None, # user context not yet passed to this service, but logged
                model_name="FinancialAccount",
                object_id=account.id,
                change_type="CREATE",
                payload={"name": name, "type": type, "coa_code": code}
            )
            return account


class SequenceService:
    @staticmethod
    def get_next_number(organization, type):
        from apps.finance.models import TransactionSequence
        from django.db.models import F
        with transaction.atomic():
            # Determine intelligent prefix based on key
            prefix = type[:3].upper() + '-'
            if 'OFFICIAL' in type:
                prefix = 'OFF' + type[:2].upper() + '-'
            elif 'INTERNAL' in type:
                prefix = 'INT' + type[:2].upper() + '-'

            seq, created = TransactionSequence.objects.get_or_create(
                organization=organization, 
                type=type,
                defaults={'prefix': prefix, 'padding': 5}
            )
            seq = TransactionSequence.objects.select_for_update().get(id=seq.id)
            
            number_string = str(seq.next_number).zfill(seq.padding)
            formatted = f"{seq.prefix or ''}{number_string}{seq.suffix or ''}"
            
            seq.next_number += 1
            seq.save()
            
            return formatted


class BarcodeService:
    @staticmethod
    def calculate_ean13_check_digit(digits):
        sum_odd = 0
        sum_even = 0
        for i, char in enumerate(digits):
            num = int(char)
            if i % 2 == 0:
                sum_odd += num * 1
            else:
                sum_even += num * 3
        
        total = sum_odd + sum_even
        remainder = total % 10
        return (10 - remainder) % 10

    @staticmethod
    def generate_barcode(organization):
        from apps.finance.models import BarcodeSettings
        # Gated cross-module import
        try:
            from apps.inventory.models import Product
        except ImportError:
            raise ValidationError("Inventory module is required for barcode generation.")
        with transaction.atomic():
            settings, created = BarcodeSettings.objects.get_or_create(
                organization=organization,
                defaults={'prefix': '200', 'next_sequence': 1000}
            )
            if not settings.is_enabled:
                raise ValidationError("Barcode generation is disabled")
            
            current_seq = settings.next_sequence
            prefix = settings.prefix
            seq_str = str(current_seq).zfill(12 - len(prefix))
            raw_code = f"{prefix}{seq_str}"
            
            check_digit = BarcodeService.calculate_ean13_check_digit(raw_code)
            final_barcode = f"{raw_code}{check_digit}"
            
            settings.next_sequence += 1
            settings.save()
            
            if Product.objects.filter(organization=organization, barcode=final_barcode).exists():
                return BarcodeService.generate_barcode(organization)
                
            return final_barcode


class LoanService:
    @staticmethod
    def calculate_schedule(principal, interest_rate, interest_type, term_months, start_date, frequency):
        """
        Pure logic calculation, returns list of dicts.
        interest_rate is Annual %.
        """
        import datetime
        from dateutil.relativedelta import relativedelta
        
        principal = Decimal(str(principal))
        rate = Decimal(str(interest_rate))
        
        if frequency == 'MONTHLY': num_installments = term_months
        elif frequency == 'QUARTERLY': num_installments = math.ceil(term_months / 3)
        elif frequency == 'YEARLY': num_installments = math.ceil(term_months / 12)
        else: num_installments = term_months
        
        if num_installments <= 0: return []
        
        total_interest = Decimal('0')
        if interest_type == 'SIMPLE':
            years = Decimal(term_months) / Decimal('12')
            total_interest = principal * (rate / Decimal('100')) * years
        
        base_principal = principal / Decimal(num_installments)
        base_interest = total_interest / Decimal(num_installments)
        
        installments = []
        remaining_principal = principal
        remaining_interest = total_interest
        
        current_date_obj = start_date if isinstance(start_date, datetime.date) else datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        
        for i in range(1, num_installments + 1):
            if frequency == 'MONTHLY':
                next_date = current_date_obj + relativedelta(months=i)
            elif frequency == 'QUARTERLY':
                next_date = current_date_obj + relativedelta(months=i*3)
            elif frequency == 'YEARLY':
                next_date = current_date_obj + relativedelta(years=i)
            else:
                next_date = current_date_obj + relativedelta(months=i)

            is_last = (i == num_installments)
            
            line_principal = remaining_principal if is_last else base_principal.quantize(Decimal('0.01'))
            line_interest = remaining_interest if is_last else base_interest.quantize(Decimal('0.01'))
            line_total = line_principal + line_interest
            
            installments.append({
                "due_date": next_date,
                "principal": line_principal,
                "interest": line_interest,
                "total": line_total
            })
            
            if not is_last:
                remaining_principal -= line_principal
                remaining_interest -= line_interest
                
        return installments

    @staticmethod
    def create_contract(organization, data, scope='OFFICIAL'):
        from apps.finance.models import Loan, LoanInstallment
        from apps.crm.models import Contact
        from apps.finance.services import SequenceService
        """
        Creates a Loan and its Installments in DRAFT status.
        """
        with transaction.atomic():
            contract_number = SequenceService.get_next_number(organization, f'LOAN_{scope.upper()}')
            
            contact = Contact.objects.get(id=data['contact_id'], organization=organization)
            
            loan = Loan.objects.create(
                organization=organization,
                contract_number=contract_number,
                contact=contact,
                principal_amount=data['principal_amount'],
                interest_rate=data['interest_rate'],
                interest_type=data.get('interest_type', 'SIMPLE'),
                term_months=data['term_months'],
                start_date=data['start_date'],
                payment_frequency=data.get('payment_frequency', 'MONTHLY'),
                status='DRAFT',
                scope=scope
            )
            
            schedule = LoanService.calculate_schedule(
                loan.principal_amount,
                loan.interest_rate,
                loan.interest_type,
                loan.term_months,
                loan.start_date,
                loan.payment_frequency
            )
            
            for item in schedule:
                LoanInstallment.objects.create(
                    organization=organization,
                    loan=loan,
                    due_date=item['due_date'],
                    principal_amount=item['principal'],
                    interest_amount=item['interest'],
                    total_amount=item['total'],
                    status='PENDING'
                )
            
            return loan

    @staticmethod
    def disburse_loan(organization, loan_id, transaction_ref=None, account_id=None, user=None):
        from apps.finance.models import Loan
        with transaction.atomic():
            loan = Loan.objects.get(id=loan_id, organization=organization)
            if loan.status != 'DRAFT':
                raise ValidationError("Loan is not in DRAFT status")
            
            FinancialEventService.create_event(
                organization=organization,
                event_type='LOAN_DISBURSEMENT',
                amount=loan.principal_amount,
                date=timezone.now(),
                contact_id=loan.contact.id,
                reference=transaction_ref or f"DISB-{loan.contract_number}",
                loan_id=loan.id,
                account_id=account_id,
                user=user,
                scope=loan.scope
            )
            
            loan.status = 'ACTIVE'
            loan.save()
            return loan

    @staticmethod
    def process_repayment(organization, loan_id, amount, account_id, reference=None, user=None, scope='OFFICIAL'):
        from apps.finance.models import Loan, LoanInstallment, FinancialEvent
        with transaction.atomic():
            # Professional Audit: Lock the loan record to prevent concurrent repayment race conditions
            loan = Loan.objects.select_for_update().get(id=loan_id, organization=organization)
            if loan.status != 'ACTIVE':
                raise ValidationError("Loan must be ACTIVE to receive repayment")
            
            remaining = Decimal(str(amount))
            
            installments = LoanInstallment.objects.filter(
                organization=organization, 
                loan=loan, 
                status__in=['PENDING', 'PARTIAL']
            ).order_by('due_date', 'id')
            
            if not installments.exists():
                raise ValidationError("No pending installments found")

            repayment_details = []
            for inst in installments:
                if remaining <= 0:
                    break
                
                # Calculate how much we can pay on this installment
                inst_total = inst.total_amount
                inst_paid = inst.paid_amount
                inst_remaining = inst_total - inst_paid
                
                if remaining >= inst_remaining:
                    # Fully pay this installment
                    payment_on_this = inst_remaining
                    inst.paid_amount = inst_total
                    inst.status = 'PAID'
                    inst.is_paid = True
                    inst.paid_at = timezone.now()
                else:
                    # Partially pay this installment
                    payment_on_this = remaining
                    inst.paid_amount += remaining
                    inst.status = 'PARTIAL'
                
                inst.save()
                remaining -= payment_on_this
                repayment_details.append({"installment_id": inst.id, "amount": str(payment_on_this)})
                
            event = FinancialEventService.create_event(
                organization=organization,
                event_type='LOAN_REPAYMENT',
                amount=amount,
                date=timezone.now(),
                contact_id=loan.contact.id,
                reference=reference or f"REPAY-{loan.contract_number}-{uuid.uuid4().hex[:4]}",
                loan_id=loan.id,
                account_id=account_id,
                user=user,
                scope=scope
            )
            
            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="LoanRepayment",
                object_id=loan.id,
                change_type="UPDATE",
                payload={"amount": str(amount), "event_id": event.id, "details": repayment_details}
            )
            
            return event


class FinancialEventService:
    @staticmethod
    def create_event(organization, event_type, amount, date, contact_id, reference=None, notes=None, loan_id=None, account_id=None, user=None, scope='OFFICIAL'):
        from apps.finance.models import FinancialEvent, FiscalPeriod
        from apps.finance.services import SequenceService
        # Gated cross-module import
        try:
            from apps.crm.models import Contact
        except ImportError:
            raise ValidationError("CRM module is required for financial events.")
        
        amount = Decimal(str(amount))
        if amount <= 0:
            raise ValidationError("Event amount must be positive.")

        with transaction.atomic():
            # Period enforcement
            fp = FiscalPeriod.objects.filter(organization=organization, start_date__lte=date, end_date__gte=date).first()
            if not fp or fp.is_closed:
                raise ValidationError("Target fiscal period is closed or not found.")

            contact = Contact.objects.get(id=contact_id, organization=organization)
            
            # 1. Dual-Mode Gapless Sequencing
            if not reference:
                sequence_key = f"{event_type.upper()}_{scope.upper()}"
                reference = SequenceService.get_next_number(organization, sequence_key)

            event = FinancialEvent.objects.create(
                organization=organization,
                event_type=event_type,
                amount=amount,
                date=date,
                contact=contact,
                reference=reference,
                scope=scope,
                notes=notes,
                loan_id=loan_id,
                status='DRAFT'
            )
            
            if account_id:
                FinancialEventService.post_event(organization, event.id, account_id, user=user)
                event.refresh_from_db()
                
            return event

    @staticmethod
    def post_event(organization, event_id, account_id, user=None):
        from apps.finance.models import FinancialEvent, FinancialAccount, Transaction
        from erp.services import ConfigurationService
        with transaction.atomic():
            event = FinancialEvent.objects.get(id=event_id, organization=organization)
            if event.status == 'SETTLED': return event
            
            fin_acc = FinancialAccount.objects.get(id=account_id, organization=organization)
            actual_payment_acc_id = fin_acc.linked_coa_id
            
            rules = ConfigurationService.get_posting_rules(organization)
            
            debit_acc = None
            credit_acc = None
            description = ""
            
            if event.event_type in ['PARTNER_CAPITAL_INJECTION', 'PARTNER_INJECTION']:
                debit_acc = actual_payment_acc_id
                credit_acc = rules.get('partners', {}).get('capital') or rules.get('equity', {}).get('capital')
                description = f"Capital Injection from {event.contact.name}"
                
            elif event.event_type == 'PARTNER_LOAN':
                debit_acc = actual_payment_acc_id
                credit_acc = event.contact.linked_account_id
                description = f"Loan from Partner {event.contact.name}"

            elif event.event_type == 'LOAN_DISBURSEMENT':
                debit_acc = event.contact.linked_account_id
                credit_acc = actual_payment_acc_id
                description = f"Loan Disbursement to {event.contact.name}"
                
            elif event.event_type == 'LOAN_REPAYMENT':
                debit_acc = actual_payment_acc_id 
                credit_acc = event.contact.linked_account_id
                description = f"Loan Repayment from {event.contact.name}"
                
            elif event.event_type == 'PARTNER_WITHDRAWAL':
                debit_acc = rules.get('partners', {}).get('withdrawal') or rules.get('equity', {}).get('capital')
                credit_acc = actual_payment_acc_id
                description = f"Partner Withdrawal: {event.contact.name}"

            if not debit_acc or not credit_acc:
                raise ValidationError(f"Accounting mapping failed for {event.event_type} (Dr:{debit_acc}, Cr:{credit_acc})")

            trx_type = 'IN' if debit_acc == actual_payment_acc_id else 'OUT'
            
            trx = Transaction.objects.create(
                organization=organization,
                account=fin_acc,
                amount=event.amount,
                type=trx_type,
                description=description,
                reference_id=event.reference
            )
            
            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=event.date,
                description=description,
                reference=event.reference,
                status='POSTED',
                scope=event.scope,
                site_id=fin_acc.site_id,
                user=user,
                lines=[
                    {"account_id": debit_acc, "debit": event.amount, "credit": Decimal('0')},
                    {"account_id": credit_acc, "debit": Decimal('0'), "credit": event.amount}
                ],
                internal_bypass=True
            )
            
            event.transaction = trx
            event.journal_entry = entry
            event.status = 'SETTLED'
            event.save()
            return event

class TaxService:
    @staticmethod
    def get_declared_report(organization, start_date, end_date):
        """
        Generates the 'Virtual Reclassification' Report for Mixed/Regular modes.
        """
        # Gated cross-module import
        try:
            from apps.pos.models import Order, OrderLine
        except ImportError:
            raise ValidationError("POS module is required for tax reports.")
        from erp.services import ConfigurationService
        from django.db.models import Sum
        
        settings = ConfigurationService.get_global_settings(organization)
        company_type = settings.get('companyType', 'REGULAR')
        
        if company_type == 'MICRO':
            sales = Order.objects.filter(
                organization=organization,
                type='SALE',
                scope='OFFICIAL',
                created_at__range=[start_date, end_date]
            ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
            
            micro_rate = Decimal(str(settings.get('microTaxPercentage', 0))) / 100
            tax_due = sales * micro_rate
            
            return {
                "type": "MICRO",
                "period": f"{start_date} to {end_date}",
                "sales_revenue": sales,
                "tax_due": tax_due,
                "note": f"Calculated at {micro_rate*100}% of Revenue"
            }
            
        else:
            purchase_lines = OrderLine.objects.filter(
                organization=organization,
                order__type='PURCHASE',
                order__scope='OFFICIAL',
                order__status__in=['COMPLETED', 'RECEIVED'],
                order__created_at__range=[start_date, end_date]
            )
            
            total_ht = Decimal('0')
            total_vat_recoverable = Decimal('0')
            total_ttc = Decimal('0')
            
            for line in purchase_lines:
                qty = line.quantity
                ht = line.unit_cost_ht * qty
                vat = line.vat_amount * qty
                ttc = line.total
                
                total_ht += ht
                total_vat_recoverable += vat
                total_ttc += ttc
                
            return {
                "type": "STANDARD_RECLASSIFIED",
                "period": f"{start_date} to {end_date}",
                "purchases_ht": total_ht,
                "vat_recoverable": total_vat_recoverable,
                "purchases_ttc_internal": total_ttc,
                "note": "Virtual Reclassification: Ledger=TTC, Report=HT+VAT"
            }


class AuditVerificationService:
    @staticmethod
    def verify_ledger_integrity(organization):
        """
        Quantum Audit: Mathematically verifies the entire ledger chain for an organization.
        """
        from apps.finance.models import JournalEntry
        from apps.finance.cryptography import LedgerCryptography
        
        entries = JournalEntry.objects.filter(
            organization=organization,
            status='POSTED'
        ).order_by('posted_at', 'id')
        
        if not entries.exists():
            return {"status": "EMPTY", "message": "Ledger is empty, integrity is trivial."}
            
        expected_prev_hash = "GENESIS"
        issues = []
        
        for entry in entries:
            # 1. Chain Link Verification
            if entry.previous_hash != expected_prev_hash:
                issues.append({
                    "entry_id": entry.id,
                    "ref": entry.reference,
                    "issue": "Chain break: Previous hash mismatch",
                    "expected": expected_prev_hash,
                    "found": entry.previous_hash
                })
            
            # 2. Content Integrity Verification
            current_hash = entry.calculate_hash()
            if entry.entry_hash != current_hash:
                issues.append({
                    "entry_id": entry.id,
                    "ref": entry.reference,
                    "issue": "Content tampering: Stored hash does not match re-calculated hash",
                    "expected": entry.entry_hash,
                    "found": current_hash
                })
            
            # Update expected for next link
            expected_prev_hash = entry.entry_hash
            
        if issues:
            return {
                "status": "COMPROMISED",
                "message": f"Ledger integrity failed. {len(issues)} discrepancy(s) found.",
                "issues": issues,
                "timestamp": timezone.now()
            }
            
        return {
            "status": "VERIFIED",
            "message": "Quantum Audit complete: All transaction hashes and chain links are valid.",
            "entry_count": entries.count(),
            "last_hash": expected_prev_hash,
            "timestamp": timezone.now()
        }
