import uuid
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Sum

from .audit_service import ForensicAuditService

logger = logging.getLogger(__name__)

class LedgerService:
    @staticmethod
    def create_journal_entry(organization, transaction_date, description, lines, reference=None, status='DRAFT', scope='OFFICIAL', site_id=None, user=None, **kwargs):
        from apps.finance.models import FiscalPeriod, JournalEntry, JournalEntryLine
        # Import internally to avoid circular dependency
        from apps.finance.services.base_services import SequenceService
        
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
                    description=l.get('description', description),
                    contact_id=l.get('contact_id'),
                    employee_id=l.get('employee_id')
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
        from apps.finance.models import ChartOfAccount, JournalEntry
        
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

            # \u2500\u2500 Quantum Audit: Cryptographic Hash Chain \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
            # 1. Fetch the hash of the last POSTED entry in this organization
            last_entry = JournalEntry.objects.filter(
                organization=entry.organization,
                status='POSTED'
            ).exclude(id=entry.id).order_by('-posted_at', '-id').first()
            
            entry.previous_hash = last_entry.entry_hash if last_entry else "GENESIS"

            # 2. Transition status
            entry.status = 'POSTED'
            entry.posted_at = timezone.now()
            entry.posted_by = user

            # 3. Calculate and seal the entry's unique SHA-256 signature
            entry.entry_hash = entry.calculate_hash()
            
            # 4. Save with immutability bypass (we are THE posting service)
            entry.save(force_audit_bypass=True)

            ForensicAuditService.log_mutation(
                organization=entry.organization,
                user=user,
                model_name="JournalEntry",
                object_id=entry.id,
                change_type="POST",
                payload={"reference": entry.reference, "hash": entry.entry_hash}
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
        from apps.finance.services.base_services import SequenceService
        
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
                status='DRAFT',  # Create as DRAFT; post_journal_entry will transition to POSTED
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
            original.save(force_audit_bypass=True)

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
            # 1. Zero out all account balances
            ChartOfAccount.objects.filter(organization=organization).update(
                balance=Decimal('0'), balance_official=Decimal('0')
            )
            
            # 2. Fetch all posted entries in chronological order
            entries = JournalEntry.objects.filter(
                organization=organization, status='POSTED'
            ).order_by('posted_at')
            
            # 3. Reset each entry to DRAFT so post_journal_entry can reprocess it
            for entry in entries:
                original_posted_at = entry.posted_at
                original_posted_by = entry.posted_by
                
                # Temporarily reset to allow re-posting
                entry.status = 'DRAFT'
                entry.posted_at = None
                entry.entry_hash = None
                entry.previous_hash = None
                entry.save(force_audit_bypass=True)
                
                # Re-post (this recomputes balances + hash chain)
                LedgerService.post_journal_entry(entry, user=original_posted_by)
                
                # Restore original timestamp for audit accuracy
                entry.refresh_from_db()
                entry.posted_at = original_posted_at
                entry.save(force_audit_bypass=True)
                
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


class FinancialEventService:
    @staticmethod
    def create_event(organization, event_type, amount, date, contact_id, reference=None, notes=None, loan_id=None, account_id=None, user=None, scope='OFFICIAL'):
        from apps.finance.models import FinancialEvent, FiscalPeriod
        from apps.finance.services.base_services import SequenceService
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
