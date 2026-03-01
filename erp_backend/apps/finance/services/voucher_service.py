from decimal import Decimal
from django.db import transaction, models
from django.db.models import Sum, F
from django.core.exceptions import ValidationError

from .base_services import SequenceService
from .ledger_service import LedgerService

class VoucherService:
    @staticmethod
    def create_voucher(organization, data, user=None, scope='OFFICIAL'):
        from apps.finance.models import Voucher
        with transaction.atomic():
            voucher_type = data['voucher_type']
            amount = Decimal(str(data['amount']))
            if amount <= 0:
                raise ValidationError("Amount must be positive.")

            # Validation
            if voucher_type in ('RECEIPT', 'PAYMENT') and not data.get('financial_event_id'):
                raise ValidationError("Receipt and Payment vouchers must be linked to a financial event.")
            if voucher_type == 'TRANSFER':
                if not data.get('source_account_id') or not data.get('destination_account_id'):
                    raise ValidationError("Transfer vouchers require both source and destination accounts.")

            # Auto-generate reference from Transaction Sequence
            seq_type = f'VOUCHER_{voucher_type}'
            reference = SequenceService.get_next_number(organization, seq_type)

            voucher = Voucher.objects.create(
                organization=organization,
                voucher_type=voucher_type,
                amount=amount,
                date=data['date'],
                reference=reference,
                description=data.get('description', ''),
                source_account_id=data.get('source_account_id'),
                destination_account_id=data.get('destination_account_id'),
                financial_event_id=data.get('financial_event_id'),
                contact_id=data.get('contact_id'),
                scope=scope,
            )

            return voucher

    @staticmethod
    def post_voucher(organization, voucher_id, user=None):
        from apps.finance.models import Voucher, FinancialAccount
        with transaction.atomic():
            voucher = Voucher.objects.select_for_update().get(id=voucher_id, organization=organization)
            if voucher.status != 'DRAFT':
                raise ValidationError("Voucher must be in DRAFT status.")

            debit_acc = None
            credit_acc = None
            desc = voucher.description or ''

            if voucher.voucher_type == 'TRANSFER':
                src = FinancialAccount.objects.get(id=voucher.source_account_id, organization=organization)
                dst = FinancialAccount.objects.get(id=voucher.destination_account_id, organization=organization)
                debit_acc = dst.ledger_account_id
                credit_acc = src.ledger_account_id
                desc = f"Transfer: {src.name} \u2192 {dst.name}"

            elif voucher.voucher_type == 'RECEIPT':
                dst = FinancialAccount.objects.get(id=voucher.destination_account_id, organization=organization)
                debit_acc = dst.ledger_account_id
                # Credit the contact's/event's source
                if voucher.contact_id:
                    from apps.crm.models import Contact
                    contact = Contact.objects.get(id=voucher.contact_id, organization=organization)
                    credit_acc = getattr(contact, 'linked_account_id', None)
                desc = f"Receipt: {desc}"

            elif voucher.voucher_type == 'PAYMENT':
                src = FinancialAccount.objects.get(id=voucher.source_account_id, organization=organization)
                credit_acc = src.ledger_account_id
                if voucher.contact_id:
                    from apps.crm.models import Contact
                    contact = Contact.objects.get(id=voucher.contact_id, organization=organization)
                    debit_acc = getattr(contact, 'linked_account_id', None)
                desc = f"Payment: {desc}"

            if not debit_acc or not credit_acc:
                raise ValidationError("Cannot map voucher to accounting entries. Check account mappings.")

            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=voucher.date,
                description=desc,
                status='POSTED',
                scope=voucher.scope,
                user=user,
                lines=[
                    {"account_id": debit_acc, "debit": voucher.amount, "credit": Decimal('0')},
                    {"account_id": credit_acc, "debit": Decimal('0'), "credit": voucher.amount},
                ],
                internal_bypass=True
            )

            voucher.journal_entry = entry
            voucher.status = 'POSTED'
            voucher.save()
            return voucher


class ProfitDistributionService:
    @staticmethod
    def calculate_distribution(organization, fiscal_year_id, allocations):
        """
        allocations = { "RESERVE": 10, "REINVESTMENT": 20, "DISTRIBUTABLE": 70 }
        percentages must sum to 100.
        """
        from apps.finance.models import FiscalYear
        from django.db.models import Sum

        fy = FiscalYear.objects.get(id=fiscal_year_id, organization=organization)
        if not fy.is_closed:
            raise ValidationError("Fiscal year must be closed before distributing profits.")

        # Calculate net profit from income - expenses for this fiscal year
        from apps.finance.models import JournalEntryLine
        lines = JournalEntryLine.objects.filter(
            organization=organization,
            journal_entry__fiscal_year=fy,
            journal_entry__status='POSTED'
        )
        income = lines.filter(account__type='INCOME').aggregate(val=Sum(F('credit') - F('debit')))['val'] or Decimal('0')
        expense = lines.filter(account__type='EXPENSE').aggregate(val=Sum(F('debit') - F('credit')))['val'] or Decimal('0')
        net_profit = income - expense

        total_pct = sum(allocations.values())
        if abs(total_pct - 100) > 0.01:
            raise ValidationError(f"Allocation percentages must sum to 100 (got {total_pct})")

        computed = {}
        remaining = net_profit
        items = sorted(allocations.items(), key=lambda x: x[0])
        for i, (wallet, pct) in enumerate(items):
            if i == len(items) - 1:
                computed[wallet] = str(remaining)
            else:
                amount = (net_profit * Decimal(str(pct)) / Decimal('100')).quantize(Decimal('0.01'))
                computed[wallet] = str(amount)
                remaining -= amount

        return {
            "fiscal_year": fy.name,
            "net_profit": str(net_profit),
            "allocations": computed,
        }

    @staticmethod
    def create_distribution(organization, fiscal_year_id, allocations, distribution_date, notes='', user=None):
        from apps.finance.models import ProfitDistribution

        calc = ProfitDistributionService.calculate_distribution(organization, fiscal_year_id, allocations)

        dist = ProfitDistribution.objects.create(
            organization=organization,
            fiscal_year_id=fiscal_year_id,
            net_profit=Decimal(calc['net_profit']),
            distribution_date=distribution_date,
            allocations=calc['allocations'],
            notes=notes,
            status='DRAFT',
        )
        return dist

    @staticmethod
    def post_distribution(organization, distribution_id, retained_earnings_coa_id, allocation_coa_map, user=None):
        """
        allocation_coa_map = { "RESERVE": coa_id, "DISTRIBUTABLE": coa_id }
        """
        from apps.finance.models import ProfitDistribution
        with transaction.atomic():
            dist = ProfitDistribution.objects.select_for_update().get(id=distribution_id, organization=organization)
            if dist.status == 'POSTED':
                raise ValidationError("Already posted.")

            lines = []
            total = Decimal('0')
            for wallet, amount_str in dist.allocations.items():
                amount = Decimal(amount_str)
                coa_id = allocation_coa_map.get(wallet)
                if not coa_id:
                    raise ValidationError(f"No COA mapping for wallet '{wallet}'")
                lines.append({"account_id": coa_id, "debit": Decimal('0'), "credit": amount})
                total += amount

            # Dr Retained Earnings \u2192 Cr Allocated wallets
            lines.insert(0, {"account_id": retained_earnings_coa_id, "debit": total, "credit": Decimal('0')})

            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=dist.distribution_date,
                description=f"Profit Distribution FY {dist.fiscal_year.name}",
                status='POSTED',
                scope='OFFICIAL',
                user=user,
                lines=lines,
                internal_bypass=True
            )

            dist.journal_entry = entry
            dist.status = 'POSTED'
            dist.save()
            return dist
