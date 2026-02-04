from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum, F
import uuid
import json
import math
from apps.finance.models import (
    ChartOfAccount, FiscalYear, FiscalPeriod, JournalEntry, 
    JournalEntryLine, FinancialAccount, Transaction, Loan, 
    LoanInstallment, FinancialEvent
)

class LedgerService:
    @staticmethod
    def create_journal_entry(organization, transaction_date, description, lines, reference=None, status='DRAFT', scope='OFFICIAL', site_id=None):
        total_debit = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
        total_credit = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
        if abs(total_debit - total_credit) > Decimal('0.001'): 
            raise ValidationError("Out of Balance")
        with transaction.atomic():
            fp = FiscalPeriod.objects.filter(organization=organization, start_date__lte=transaction_date, end_date__gte=transaction_date).first()
            if not fp: raise ValidationError("No Fiscal Period for the given date")
            entry = JournalEntry.objects.create(
                organization=organization, 
                transaction_date=transaction_date, 
                description=description, 
                reference=reference or f"JRN-{uuid.uuid4().hex[:8].upper()}", 
                fiscal_year=fp.fiscal_year, 
                fiscal_period=fp, 
                status=status, 
                scope=scope, 
                site_id=site_id
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
                LedgerService.post_journal_entry(entry)
            return entry

    @staticmethod
    def post_journal_entry(entry):
        if entry.status == 'POSTED' and entry.posted_at: return
        with transaction.atomic():
            for line in entry.lines.all():
                net = line.debit - line.credit
                account = line.account
                account.balance = Decimal(str(account.balance)) + net
                if entry.scope == 'OFFICIAL': 
                    account.balance_official = Decimal(str(account.balance_official)) + net
                account.save()
            entry.status = 'POSTED'; entry.posted_at = timezone.now(); entry.save()

    @staticmethod
    def get_trial_balance(organization, as_of_date=None, scope='INTERNAL'):
        accounts = ChartOfAccount.objects.filter(organization=organization, is_active=True).order_by('code')
        lines_qs = JournalEntryLine.objects.filter(organization=organization, journal_entry__status='POSTED')
        if as_of_date: 
            lines_qs = lines_qs.filter(journal_entry__transaction_date__lte=as_of_date)
        if scope == 'OFFICIAL': 
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
        
        balance_map = {b['account_id']: Decimal(str(b['net'] or '0')) for b in lines_qs.values('account_id').annotate(net=Sum('debit') - Sum('credit'))}
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
        for root in roots: 
            rollup(root)
        return accounts

    @staticmethod
    def get_profit_loss(organization, start_date=None, end_date=None, scope='INTERNAL'):
        accounts = LedgerService.get_trial_balance(organization, as_of_date=end_date, scope=scope)
        income_accs = [a for a in accounts if a.type == 'INCOME']
        expense_accs = [a for a in accounts if a.type == 'EXPENSE']
        total_income = abs(sum((a.rollup_balance for a in income_accs if a.parent is None), Decimal('0')))
        total_expenses = sum((a.rollup_balance for a in expense_accs if a.parent is None), Decimal('0'))
        return {
            "scope": scope, 
            "revenue": total_income, 
            "expenses": total_expenses, 
            "net_income": total_income - total_expenses
        }

    @staticmethod
    def get_balance_sheet(organization, as_of_date=None, scope='INTERNAL'):
        accounts = LedgerService.get_trial_balance(organization, as_of_date=as_of_date, scope=scope)
        assets = [a for a in accounts if a.type == 'ASSET']
        liabilities = [a for a in accounts if a.type == 'LIABILITY']
        equity = [a for a in accounts if a.type == 'EQUITY']
        
        total_assets = sum((a.rollup_balance for a in assets if a.parent is None), Decimal('0'))
        total_liabilities = abs(sum((a.rollup_balance for a in liabilities if a.parent is None), Decimal('0')))
        total_equity = abs(sum((a.rollup_balance for a in equity if a.parent is None), Decimal('0')))
        
        profit_data = LedgerService.get_profit_loss(organization, end_date=as_of_date, scope=scope)
        cur_earnings = profit_data['net_income']
        
        return {
            "scope": scope, 
            "assets": total_assets, 
            "liabilities": total_liabilities, 
            "equity": total_equity, 
            "current_earnings": cur_earnings, 
            "total_liabilities_and_equity": total_liabilities + total_equity + cur_earnings, 
            "is_balanced": abs(total_assets - (total_liabilities + total_equity + cur_earnings)) < Decimal('0.01')
        }

class FinancialAccountService:
    @staticmethod
    def create_account(organization, name, type, currency, site_id=None):
        parent = ChartOfAccount.objects.filter(organization=organization, sub_type=type).first()
        if not parent: raise ValidationError(f"No Chart of Accounts parent found for type: {type}")
        with transaction.atomic():
            last = ChartOfAccount.objects.filter(organization=organization, code__startswith=f"{parent.code}.").order_by('-code').first()
            suffix = (int(last.code.split('.')[-1]) + 1) if last else 1
            code = f"{parent.code}.{str(suffix).zfill(3)}"
            acc = ChartOfAccount.objects.create(
                organization=organization, 
                code=code, 
                name=name, 
                type='ASSET', 
                parent=parent, 
                is_system_only=True, 
                is_active=True, 
                balance=Decimal('0.00')
            )
            return FinancialAccount.objects.create(
                organization=organization, 
                name=name, 
                type=type, 
                currency=currency,
                site_id=site_id, 
                ledger_account=acc
            )

class FinancialEventService:
    @staticmethod
    def create_event(organization, event_type, amount, date, contact_id, reference=None, notes=None, loan_id=None, account_id=None):
        from erp.models import Contact
        with transaction.atomic():
            contact = Contact.objects.get(id=contact_id, organization=organization)
            event = FinancialEvent.objects.create(
                organization=organization,
                event_type=event_type,
                amount=amount,
                date=date,
                contact=contact,
                reference=reference,
                notes=notes,
                loan_id=loan_id,
                status='DRAFT'
            )
            if account_id:
                FinancialEventService.post_event(organization, event.id, account_id)
                event.refresh_from_db()
            return event

    @staticmethod
    def post_event(organization, event_id, account_id):
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
            
            if event.event_type == 'PARTNER_CAPITAL_INJECTION':
                debit_acc = actual_payment_acc_id
                credit_acc = rules.get('equity', {}).get('capital')
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
                debit_acc = rules.get('equity', {}).get('draws') or rules.get('equity', {}).get('capital')
                credit_acc = actual_payment_acc_id
                description = f"Partner Withdrawal: {event.contact.name}"

            if not debit_acc or not credit_acc:
                raise ValidationError(f"Accounting mapping failed for {event.event_type}")

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
                site_id=fin_acc.site_id,
                lines=[
                    {"account_id": debit_acc, "debit": event.amount, "credit": Decimal('0')},
                    {"account_id": credit_acc, "debit": Decimal('0'), "credit": event.amount}
                ]
            )
            
            event.transaction = trx
            event.journal_entry = entry
            event.status = 'SETTLED'
            event.save()
            return event
