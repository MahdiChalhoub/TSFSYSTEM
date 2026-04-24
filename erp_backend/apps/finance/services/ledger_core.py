import uuid
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Sum
from .audit_service import ForensicAuditService

logger = logging.getLogger(__name__)

from apps.finance.models import JournalEntry, JournalEntryLine, ChartOfAccount, FinancialEvent


class LedgerCoreMixin:

    @staticmethod
    def create_journal_entry(organization, transaction_date, description, lines, reference=None, status='DRAFT', scope='OFFICIAL', site_id=None, user=None, **kwargs):
        from apps.finance.models import FiscalPeriod, JournalEntry, JournalEntryLine
        from apps.finance.services.base_services import SequenceService
        
        total_debit = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
        total_credit = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
        if abs(total_debit - total_credit) > Decimal('0.001'): 
            raise ValidationError("Journal entry is out of balance.")

        # ── Migration Freeze Check ─────────────────────────────
        source_module = kwargs.get('source_module')
        if source_module != 'COA_MIGRATION' and not kwargs.get('internal_bypass'):
            try:
                from apps.finance.models.coa_template import COAMigrationSession
                if COAMigrationSession.objects.filter(
                    organization=organization, is_locked=True
                ).exists():
                    raise ValidationError(
                        "Organization finances are frozen during COA migration. "
                        "No journal entries can be created until migration completes."
                    )
            except ImportError:
                pass  # Model not yet available

        with transaction.atomic():
            # ── Step 1: Fiscal Period Enforcement ──────────────────────
            # Resolve the period containing this transaction_date. If two
            # periods overlap on this date, refuse to silently pick one —
            # ambiguity must be fixed at the fiscal-year level, not papered
            # over here. (See audit Q7.)
            matching_periods = list(FiscalPeriod.objects.filter(
                organization=organization,
                start_date__lte=transaction_date,
                end_date__gte=transaction_date,
            ).select_related('fiscal_year')[:2])
            if not matching_periods:
                raise ValidationError(f"No fiscal period found for date {transaction_date}")
            if len(matching_periods) > 1:
                raise ValidationError(
                    f"Date {transaction_date} falls in multiple overlapping fiscal periods "
                    f"({', '.join(p.name for p in matching_periods)}). "
                    f"Resolve the period overlap before posting."
                )
            fp = matching_periods[0]
            if not kwargs.get('internal_bypass'):
                if fp.status == 'CLOSED' or fp.is_closed:
                    raise ValidationError(f"Fiscal period {fp.name} is closed. Cannot post transactions.")
                if fp.status == 'HARD_LOCKED':
                    raise ValidationError(f"Fiscal period {fp.name} is hard-locked. Cannot post.")
                if fp.status == 'FUTURE':
                    raise ValidationError(f"Fiscal period {fp.name} is a future period. Cannot post yet.")
            if fp.status == 'SOFT_LOCKED' and not kwargs.get('internal_bypass'):
                # Soft-locked: Check dynamic permission
                is_authorized = kwargs.get('supervisor_override', False)
                if user and hasattr(user, 'is_superuser') and user.is_superuser:
                    is_authorized = True
                
                if not is_authorized and user:
                    try:
                        from kernel.rbac.permissions import check_permission
                        if check_permission(user, 'finance.post_locked_period', organization):
                            is_authorized = True
                    except ImportError:
                        pass
                        
                if not is_authorized:
                    raise ValidationError(
                        f"Fiscal period {fp.name} is soft-locked. "
                        f"You do not have permission to post to locked periods."
                    )
                    
            if getattr(fp, 'is_adjustment_period', False) and not kwargs.get('internal_bypass'):
                # Audit/Adjustment Period: Check dynamic permission
                is_authorized = kwargs.get('supervisor_override', False)
                if user and hasattr(user, 'is_superuser') and user.is_superuser:
                    is_authorized = True
                
                if not is_authorized and user:
                    try:
                        from kernel.rbac.permissions import check_permission
                        if check_permission(user, 'finance.post_adjustment_period', organization):
                            is_authorized = True
                    except ImportError:
                        pass
                        
                if not is_authorized:
                    raise ValidationError(
                        f"Fiscal period {fp.name} is an audit/adjustment period. "
                        f"You do not have permission to post adjustment entries."
                    )

            if fp.fiscal_year.is_hard_locked:
                raise ValidationError(f"Fiscal year {fp.fiscal_year.name} is hard-locked.")
            
            # ── Step 2: Gapless Reference Sequence ────────────────────
            if not reference:
                reference = SequenceService.get_next_number(organization, f"JOURNAL_{scope}")

            # ── Step 3: Source Document Duplicate Check ───────────────
            source_module = kwargs.get('source_module')
            source_model = kwargs.get('source_model')
            source_id = kwargs.get('source_id')
            if source_module and source_id:
                # Superseded rows don't count as "active" — they represent
                # historical versions that have already been soft-replaced
                # via the is_superseded / superseded_by chain. Matching them
                # here would block every regeneration of system-owned JEs
                # (OPENING, CLOSING) which is exactly the flow the supersede
                # mechanic was designed to support.
                existing = JournalEntry.objects.filter(
                    organization=organization,
                    source_module=source_module,
                    source_model=source_model or '',
                    source_id=source_id,
                    scope=scope,
                    status='POSTED',
                    is_superseded=False,
                ).first()
                if existing:
                    raise ValidationError(
                        f"Duplicate posting detected: {source_module}/{source_model}#{source_id} "
                        f"already posted as {existing.reference}. Use reversal to correct."
                    )
            
            # ── Step 4: Account Validation ────────────────────────────
            internal_bypass = kwargs.get('internal_bypass', False)
            account_ids = [l.get('account_id') for l in lines if l.get('account_id')]
            
            if account_ids and not internal_bypass:
                from apps.finance.models import ChartOfAccount
                accounts = {acc.id: acc for acc in ChartOfAccount.objects.filter(
                    id__in=account_ids, organization=organization
                )}
                
                for l in lines:
                    acc_id = l.get('account_id')
                    if not acc_id:
                        continue
                    acc = accounts.get(acc_id)
                    if not acc:
                        continue
                    
                    # 4a. System-only accounts: no manual posting
                    if acc.is_system_only:
                        raise ValidationError(
                            f"Manual posting to system-only account '{acc.code} - {acc.name}' is forbidden."
                        )
                    
                    # 4b. allow_posting check: header/parent accounts blocked
                    if not acc.allow_posting:
                        raise ValidationError(
                            f"Account '{acc.code} - {acc.name}' does not allow direct posting. "
                            f"Post to a child account instead."
                        )
                    
                    # 4c. Control accounts require partner_type
                    if acc.is_control_account:
                        if not l.get('partner_type') and not l.get('contact_id'):
                            logger.warning(
                                f"Posting to control account {acc.code} without partner_type. "
                                f"Subledger reporting may be incomplete for JE {reference}."
                            )
                    
                    # 4d. Account active check
                    if not acc.is_active:
                        raise ValidationError(
                            f"Account '{acc.code} - {acc.name}' is deactivated. Cannot post."
                        )
            
            # ── Step 5: Create Journal Entry ──────────────────────────
            journal_type = kwargs.get('journal_type', 'GENERAL')
            journal_role = kwargs.get('journal_role', 'USER_GENERAL')
            currency = kwargs.get('currency')
            exchange_rate = kwargs.get('exchange_rate')

            entry = JournalEntry.objects.create(
                organization=organization,
                transaction_date=transaction_date,
                description=description,
                reference=reference,
                fiscal_year=fp.fiscal_year,
                fiscal_period=fp,
                status='DRAFT',
                scope=scope,
                site_id=site_id,
                created_by=user,
                # New fields
                journal_type=journal_type,
                journal_role=journal_role,
                source_module=source_module or '',
                source_model=source_model or '',
                source_id=source_id,
                currency=currency,
                exchange_rate=exchange_rate,
                total_debit=total_debit,
                total_credit=total_credit,
            )

            # ── Step 6: Create Journal Entry Lines ────────────────────
            for l in lines: 
                acc_id = l.get('account_id')
                if not acc_id:
                    # Resolve suspense account from posting rules
                    from erp.services import ConfigurationService
                    from apps.finance.models import ChartOfAccount
                    rules = ConfigurationService.get_posting_rules(organization)
                    suspense_id = rules.get('suspense', {}).get('reception')
                    suspense = ChartOfAccount.objects.filter(
                        id=suspense_id, organization=organization
                    ).first() if suspense_id else None
                    if not suspense:
                        suspense = ChartOfAccount.objects.filter(
                            organization=organization, type='LIABILITY'
                        ).first()
                    if not suspense:
                        raise ValidationError(
                            "Cannot create journal line: No account mapping provided "
                            "and no suspense account exists. Configure posting rules first."
                        )
                    acc_id = suspense.id
                    logger.warning(
                        f"Unmapped ledger line redirected to suspense {suspense.code} "
                        f"for entry {reference}"
                    )

                JournalEntryLine.objects.create(
                    organization=organization, 
                    journal_entry=entry, 
                    account_id=acc_id, 
                    debit=Decimal(str(l['debit'])), 
                    credit=Decimal(str(l['credit'])), 
                    description=l.get('description', description),
                    contact_id=l.get('contact_id'),
                    employee_id=l.get('employee_id'),
                    # New fields pass-through
                    partner_type=l.get('partner_type'),
                    partner_id=l.get('partner_id'),
                    currency=l.get('currency') or currency,
                    exchange_rate=l.get('exchange_rate') or exchange_rate,
                    amount_currency=l.get('amount_currency'),
                    financial_account_id=l.get('financial_account_id'),
                    product_id=l.get('product_id'),
                    cost_center=l.get('cost_center'),
                    tax_line_id=l.get('tax_line_id'),
                )
            
            # ── Step 7: Post if requested ─────────────────────────────
            if status == 'POSTED':
                LedgerCoreMixin.post_journal_entry(entry, user=user, internal_bypass=kwargs.get('internal_bypass', False))

            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="JournalEntry",
                object_id=entry.id,
                change_type="CREATE",
                payload={
                    "reference": reference,
                    "total_amount": str(total_debit),
                    "journal_type": journal_type,
                    "source": f"{source_module}/{source_model}#{source_id}" if source_module else None,
                },
                scope=scope
            )
            return entry


    @staticmethod
    def post_journal_entry(entry, user=None, **kwargs):
        if entry.status == 'POSTED' and entry.posted_at: return

        # ── Migration Freeze Check ─────────────────────────────
        if not getattr(entry, '_migration_bypass', False):
            if entry.source_module != 'COA_MIGRATION':
                try:
                    from apps.finance.models.coa_template import COAMigrationSession
                    if COAMigrationSession.objects.filter(
                        organization=entry.organization, is_locked=True
                    ).exists():
                        raise ValidationError(
                            "Organization finances are frozen during COA migration. "
                            "Cannot post journal entries."
                        )
                except ImportError:
                    pass
        
        from django.db.models import Sum
        from apps.finance.models import ChartOfAccount, JournalEntry
        
        with transaction.atomic():
            # ── Final integrity check: Double-Entry Proof ─────────────
            totals = entry.lines.aggregate(
                total_debit=Sum('debit'),
                total_credit=Sum('credit')
            )
            debit = totals.get('total_debit') or Decimal('0')
            credit = totals.get('total_credit') or Decimal('0')
            
            if abs(debit - credit) > Decimal('0.001'):
                raise ValidationError(f"Cannot post unbalanced journal entry (Dr: {debit}, Cr: {credit})")

            # ── Final Period + Account Checks ─────────────────────────
            if entry.fiscal_period and entry.fiscal_period.is_closed and not kwargs.get('internal_bypass'):
                raise ValidationError(f"Cannot post to closed period {entry.fiscal_period.name}.")

            # ── Serializability: Lock accounts in ID order ────────────
            account_ids = list(
                entry.lines.values_list('account_id', flat=True).distinct().order_by('account_id')
            )
            accounts_map = {
                acc.id: acc for acc in
                ChartOfAccount.objects.select_for_update().filter(id__in=account_ids)
            }

            lines = entry.lines.all()
            for line in lines:
                acc = accounts_map.get(line.account_id)
                if not acc:
                    continue
                
                net = line.debit - line.credit
                
                # Update account balances
                acc.balance += net
                if entry.scope == 'OFFICIAL':
                    acc.balance_official += net
                acc.save()

            # ── Store Denormalized Totals ──────────────────────────────
            entry.total_debit = debit
            entry.total_credit = credit

            # ── Cryptographic Hash Chain ──────────────────────────────
            last_entry = JournalEntry.objects.filter(
                organization=entry.organization,
                status='POSTED'
            ).exclude(id=entry.id).order_by('-posted_at', '-id').first()
            
            entry.previous_hash = last_entry.entry_hash if last_entry else "GENESIS"

            # Transition status
            entry.status = 'POSTED'
            entry.posted_at = timezone.now()
            entry.posted_by = user

            # Calculate and seal SHA-256 signature
            entry.entry_hash = entry.calculate_hash()
            
            # Save with immutability bypass
            entry.save(force_audit_bypass=True)

            # ── Mark Balance Snapshots Stale ──────────────────────────
            try:
                from apps.finance.models import AccountBalanceSnapshot
                AccountBalanceSnapshot.objects.filter(
                    organization=entry.organization,
                    fiscal_period=entry.fiscal_period,
                    account_id__in=account_ids
                ).update(is_stale=True)
            except Exception:
                pass  # Snapshots may not exist yet — that's OK

            ForensicAuditService.log_mutation(
                organization=entry.organization,
                user=user,
                model_name="JournalEntry",
                object_id=entry.id,
                change_type="POST",
                payload={
                    "reference": entry.reference,
                    "hash": entry.entry_hash,
                    "total_debit": str(debit),
                    "total_credit": str(credit),
                }
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

