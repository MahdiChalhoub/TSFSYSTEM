import uuid
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Sum
from .audit_service import ForensicAuditService

from apps.finance.models import JournalEntry, JournalEntryLine, ChartOfAccount, FinancialEvent



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
            actual_payment_acc_id = fin_acc.ledger_account_id
            
            rules = ConfigurationService.get_posting_rules(organization)
            
            debit_acc = None
            credit_acc = None
            description = ""
            
            if event.event_type in ['PARTNER_CAPITAL_INJECTION', 'PARTNER_INJECTION']:
                debit_acc = actual_payment_acc_id
                credit_acc = rules.get('partners', {}).get('capital') or rules.get('equity', {}).get('capital')
                # BUG 5 FIX: actionable error for missing capital account config
                if not credit_acc:
                    raise ValidationError(
                        "Cannot post capital injection: 'partners.capital' or 'equity.capital' account "
                        "not configured. Go to Finance → Settings → Posting Rules to configure."
                    )
                description = f"Capital Injection from {event.contact.name}"

            elif event.event_type in ['PARTNER_LOAN', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT']:
                # BUG 2 FIX: explicit actionable error if contact has no linked GL account
                if not event.contact.linked_account_id:
                    raise ValidationError(
                        f"Contact '{event.contact.name}' has no linked GL account. "
                        f"Please link this contact to a Chart of Accounts entry (Contacts → Edit → Link Account) "
                        f"before posting loan transactions."
                    )
                if event.event_type == 'PARTNER_LOAN':
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
                raise ValidationError(
                    f"Accounting mapping failed for event type '{event.event_type}'. "
                    f"Dr: {debit_acc}, Cr: {credit_acc}. Check Finance → Settings → Posting Rules."
                )

            trx_type = 'IN' if debit_acc == actual_payment_acc_id else 'OUT'
            
            trx = Transaction.objects.create(
                organization=organization,
                account=fin_acc,
                amount=event.amount,
                type=trx_type,
                description=description,
                reference_id=event.reference
            )
            
            from .ledger_service import LedgerService
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
