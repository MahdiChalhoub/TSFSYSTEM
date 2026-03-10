import uuid
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Sum
from .audit_service import ForensicAuditService

from apps.finance.models import JournalEntry, JournalEntryLine, ChartOfAccount, FinancialEvent


class LedgerCoreMixin:

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
                acc_id = l.get('account_id')
                if not acc_id:
                    # Resolve suspense account from posting rules (NO hardcoded codes)
                    from erp.services import ConfigurationService
                    from apps.finance.models import ChartOfAccount
                    rules = ConfigurationService.get_posting_rules(organization)
                    suspense_id = rules.get('suspense', {}).get('reception')
                    suspense = ChartOfAccount.objects.filter(id=suspense_id, organization=organization).first() if suspense_id else None
                    if not suspense:
                        suspense = ChartOfAccount.objects.filter(organization=organization, type='LIABILITY').first()
                    
                    if not suspense:
                        raise ValidationError("Cannot create journal line: No account mapping provided and no suspense account exists. Configure posting rules first.")
                    acc_id = suspense.id
                    logger.warning(f"Unmapped ledger line redirected to suspense account {suspense.code} for entry {reference}")

                JournalEntryLine.objects.create(
                    organization=organization, 
                    journal_entry=entry, 
                    account_id=acc_id, 
                    debit=Decimal(str(l['debit'])), 
                    credit=Decimal(str(l['credit'])), 
                    description=l.get('description', description),
                    contact_id=l.get('contact_id'),
                    employee_id=l.get('employee_id')
                )
            
            if status == 'POSTED': 
                LedgerCoreMixin.post_journal_entry(entry, user=user)

            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="JournalEntry",
                object_id=entry.id,
                change_type="CREATE",
                payload={"reference": reference, "total_amount": str(total_debit)},
                scope=scope
            )
            return entry


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
                    acc_id = l.get('account_id')
                    if not acc_id:
                        from erp.services import ConfigurationService
                        from apps.finance.models import ChartOfAccount
                        rules = ConfigurationService.get_posting_rules(organization)
                        suspense_id = rules.get('suspense', {}).get('reception')
                        suspense = ChartOfAccount.objects.filter(id=suspense_id, organization=organization).first() if suspense_id else None
                        if not suspense: suspense = ChartOfAccount.objects.filter(organization=organization, type='LIABILITY').first()
                        if not suspense: raise ValidationError("Missing account and no suspense account in posting rules.")
                        acc_id = suspense.id

                    JournalEntryLine.objects.create(
                        organization=organization,
                        journal_entry=entry,
                        account_id=acc_id,
                        debit=Decimal(str(l['debit'])),
                        credit=Decimal(str(l['credit'])),
                        description=l.get('description', entry.description)
                    )
            
            entry.save()
            if entry.status == 'POSTED' and not entry.posted_at:
                LedgerCoreMixin.post_journal_entry(entry, user=user)
            
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
            
            LedgerCoreMixin.post_journal_entry(reversal, user=user)
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
                LedgerCoreMixin.post_journal_entry(entry, user=original_posted_by)
                
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

