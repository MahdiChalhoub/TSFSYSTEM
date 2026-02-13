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


class LedgerService:
    @staticmethod
    def create_journal_entry(organization, transaction_date, description, lines, reference=None, status='DRAFT', scope='OFFICIAL', site_id=None):
        from apps.finance.models import FiscalPeriod, JournalEntry, JournalEntryLine
        total_debit = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
        total_credit = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
        if abs(total_debit - total_credit) > Decimal('0.001'): raise ValidationError("Out of Balance")
        with transaction.atomic():
            fp = FiscalPeriod.objects.filter(organization=organization, start_date__lte=transaction_date, end_date__gte=transaction_date).first()
            if not fp: raise ValidationError("No Fiscal Period")
            entry = JournalEntry.objects.create(organization=organization, transaction_date=transaction_date, description=description, reference=reference or f"JRN-{uuid.uuid4().hex[:8].upper()}", fiscal_year=fp.fiscal_year, fiscal_period=fp, status=status, scope=scope, site_id=site_id)
            for l in lines: JournalEntryLine.objects.create(organization=organization, journal_entry=entry, account_id=l['account_id'], debit=Decimal(str(l['debit'])), credit=Decimal(str(l['credit'])), description=l.get('description', description))
            if status == 'POSTED': LedgerService.post_journal_entry(entry)
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
        if entry.status == 'POSTED' and entry.posted_at: return
        with transaction.atomic():
            for line in entry.lines.all():
                net = line.debit - line.credit
                account = line.account
                account.balance = Decimal(str(account.balance)) + net
                if entry.scope == 'OFFICIAL': account.balance_official = Decimal(str(account.balance_official)) + net
                account.save()
            entry.status = 'POSTED'; entry.posted_at = timezone.now(); entry.save()

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
        
        lines_qs = JournalEntryLine.objects.filter(organization=organization, journal_entry__status='POSTED')
        if scope == 'OFFICIAL': lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
        
        balance_map = {b['account_id']: Decimal(str(b['net'] or '0')) for b in lines_qs.values('account_id').annotate(net=Sum('debit') - Sum('credit'))}
        
        accounts = list(qs)
        account_map = {acc.id: acc for acc in accounts}
        for acc in accounts: 
            acc.temp_balance = balance_map.get(acc.id, Decimal('0'))
            acc.rollup_balance = acc.temp_balance
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
        accounts = ChartOfAccount.objects.filter(organization=organization, is_active=True).order_by('code')
        lines_qs = JournalEntryLine.objects.filter(organization=organization, journal_entry__status='POSTED')
        if as_of_date: lines_qs = lines_qs.filter(journal_entry__transaction_date__lte=as_of_date)
        if scope == 'OFFICIAL': lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
        balance_map = {b['account_id']: Decimal(str(b['net'] or '0')) for b in lines_qs.values('account_id').annotate(net=Sum('debit') - Sum('credit'))}
        account_map = {acc.id: acc for acc in accounts}
        for acc in accounts: 
            acc.temp_balance = balance_map.get(acc.id, Decimal('0'))
            acc.temp_children = []
        roots = []
        for acc in accounts:
            if acc.parent_id and acc.parent_id in account_map: account_map[acc.parent_id].temp_children.append(acc)
            else: roots.append(acc)
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
            return FinancialAccount.objects.create(
                organization=organization, name=name, type=type, currency=currency,
                site_id=site_id, ledger_account=acc
            )


class SequenceService:
    @staticmethod
    def get_next_number(organization, type):
        from apps.finance.models import TransactionSequence
        from django.db.models import F
        with transaction.atomic():
            seq, created = TransactionSequence.objects.get_or_create(
                organization=organization, 
                type=type,
                defaults={'prefix': type[:3].upper() + '-', 'padding': 5}
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
    def create_contract(organization, data):
        from apps.finance.models import Loan, LoanInstallment
        # Gated cross-module import
        try:
            from apps.crm.models import Contact
        except ImportError:
            raise ValidationError("CRM module is required for loan contracts.")
        """
        Creates a Loan and its Installments in DRAFT status.
        """
        with transaction.atomic():
            contract_number = SequenceService.get_next_number(organization, 'LOAN')
            
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
                status='DRAFT'
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
    def disburse_loan(organization, loan_id, transaction_ref=None, account_id=None):
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
                account_id=account_id
            )
            
            loan.status = 'ACTIVE'
            loan.save()
            return loan

    @staticmethod
    def process_repayment(organization, loan_id, amount, account_id, reference=None):
        from apps.finance.models import Loan, LoanInstallment, FinancialEvent
        with transaction.atomic():
            loan = Loan.objects.get(id=loan_id, organization=organization)
            if loan.status != 'ACTIVE':
                raise ValidationError("Loan must be ACTIVE to receive repayment")
            
            remaining = Decimal(str(amount))
            
            installments = LoanInstallment.objects.filter(organization=organization, loan=loan, status='PENDING').order_by('due_date')
            
            if not installments.exists():
                raise ValidationError("No pending installments found")

            for inst in installments:
                if remaining <= 0: break
                pass
                
            event = FinancialEventService.create_event(
                organization=organization,
                event_type='LOAN_REPAYMENT',
                amount=amount,
                date=timezone.now(),
                contact_id=loan.contact.id,
                reference=reference or f"REPAY-{loan.contract_number}-{uuid.uuid4().hex[:4]}",
                loan_id=loan.id,
                account_id=account_id
            )
            
            return event


class FinancialEventService:
    @staticmethod
    def create_event(organization, event_type, amount, date, contact_id, reference=None, notes=None, loan_id=None, account_id=None):
        from apps.finance.models import FinancialEvent
        # Gated cross-module import
        try:
            from apps.crm.models import Contact
        except ImportError:
            raise ValidationError("CRM module is required for financial events.")
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
