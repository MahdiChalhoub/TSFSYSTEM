import datetime
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from dateutil.relativedelta import relativedelta

from .ledger_service import LedgerService

class DeferredExpenseService:
    @staticmethod
    def create_deferred_expense(organization, data, user=None, scope='OFFICIAL'):
        from apps.finance.models import DeferredExpense, FinancialAccount
        with transaction.atomic():
            amount = Decimal(str(data['total_amount']))
            duration = int(data['duration_months'])
            if amount <= 0 or duration <= 0:
                raise ValidationError("Amount and duration must be positive.")

            source_acc = FinancialAccount.objects.get(id=data['source_account_id'], organization=organization)
            monthly = (amount / duration).quantize(Decimal('0.01'))

            expense = DeferredExpense.objects.create(
                organization=organization,
                name=data['name'],
                description=data.get('description', ''),
                category=data.get('category', 'OTHER'),
                total_amount=amount,
                start_date=data['start_date'],
                duration_months=duration,
                monthly_amount=monthly,
                remaining_amount=amount,
                source_account=source_acc,
                deferred_coa_id=data.get('deferred_coa_id'),
                expense_coa_id=data.get('expense_coa_id'),
                scope=scope,
            )

            # Initial JE: Dr Deferred Expense (Asset) \u2192 Cr Cash/Bank
            if expense.deferred_coa_id and source_acc.ledger_account_id:
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=expense.start_date,
                    description=f"Deferred Expense: {expense.name}",
                    status='POSTED',
                    scope=scope,
                    user=user,
                    lines=[
                        {"account_id": expense.deferred_coa_id, "debit": amount, "credit": Decimal('0')},
                        {"account_id": source_acc.ledger_account_id, "debit": Decimal('0'), "credit": amount},
                    ],
                    internal_bypass=True
                )

            return expense

    @staticmethod
    def recognize_monthly(organization, expense_id, period_date, user=None):
        from apps.finance.models import DeferredExpense
        with transaction.atomic():
            expense = DeferredExpense.objects.select_for_update().get(id=expense_id, organization=organization)
            if expense.status != 'ACTIVE':
                raise ValidationError("Deferred expense is not active.")
            if expense.months_recognized >= expense.duration_months:
                raise ValidationError("All months already recognized.")

            is_last = (expense.months_recognized + 1) == expense.duration_months
            amount = expense.remaining_amount if is_last else expense.monthly_amount

            # JE: Dr Expense \u2192 Cr Deferred Expense (no cash movement)
            if expense.expense_coa_id and expense.deferred_coa_id:
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=period_date,
                    description=f"Monthly recognition: {expense.name} ({expense.months_recognized + 1}/{expense.duration_months})",
                    status='POSTED',
                    scope=expense.scope,
                    user=user,
                    lines=[
                        {"account_id": expense.expense_coa_id, "debit": amount, "credit": Decimal('0')},
                        {"account_id": expense.deferred_coa_id, "debit": Decimal('0'), "credit": amount},
                    ],
                    internal_bypass=True
                )

            expense.months_recognized += 1
            expense.remaining_amount -= amount
            if expense.months_recognized >= expense.duration_months:
                expense.status = 'COMPLETED'
            expense.save()
            return expense


class AssetService:
    @staticmethod
    def acquire_asset(organization, data, user=None, scope='OFFICIAL'):
        from apps.finance.models import Asset, FinancialAccount
        with transaction.atomic():
            value = Decimal(str(data['purchase_value']))
            residual = Decimal(str(data.get('residual_value', '0.00')))

            asset = Asset.objects.create(
                organization=organization,
                name=data['name'],
                description=data.get('description', ''),
                category=data.get('category', 'OTHER'),
                purchase_value=value,
                purchase_date=data['purchase_date'],
                useful_life_years=int(data.get('useful_life_years', 5)),
                residual_value=residual,
                depreciation_method=data.get('depreciation_method', 'LINEAR'),
                book_value=value,
                asset_coa_id=data.get('asset_coa_id'),
                depreciation_expense_coa_id=data.get('depreciation_expense_coa_id'),
                accumulated_depreciation_coa_id=data.get('accumulated_depreciation_coa_id'),
                source_account_id=data.get('source_account_id'),
                scope=scope,
            )

            # JE: Dr Fixed Asset \u2192 Cr Cash/Bank
            source_acc = FinancialAccount.objects.filter(id=data.get('source_account_id'), organization=organization).first()
            if asset.asset_coa_id and source_acc and source_acc.ledger_account_id:
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=asset.purchase_date,
                    description=f"Asset Acquisition: {asset.name}",
                    status='POSTED',
                    scope=scope,
                    user=user,
                    lines=[
                        {"account_id": asset.asset_coa_id, "debit": value, "credit": Decimal('0')},
                        {"account_id": source_acc.ledger_account_id, "debit": Decimal('0'), "credit": value},
                    ],
                    internal_bypass=True
                )

            # Generate depreciation schedule
            AssetService.generate_schedule(asset)
            return asset

    @staticmethod
    def generate_schedule(asset):
        from apps.finance.models import AmortizationSchedule
        import datetime
        from dateutil.relativedelta import relativedelta

        depreciable = asset.purchase_value - asset.residual_value
        if depreciable <= 0:
            return

        total_months = asset.useful_life_years * 12
        monthly_amount = (depreciable / total_months).quantize(Decimal('0.01'))
        remaining = depreciable

        current = asset.purchase_date
        if isinstance(current, str):
            current = datetime.datetime.strptime(current, "%Y-%m-%d").date()

        for i in range(total_months):
            current = current + relativedelta(months=1)
            is_last = (i == total_months - 1)
            amount = remaining if is_last else monthly_amount

            AmortizationSchedule.objects.create(
                organization=asset.organization,
                asset=asset,
                period_date=current,
                amount=amount,
            )
            remaining -= amount

    @staticmethod
    def post_depreciation(organization, schedule_id, user=None):
        from apps.finance.models import AmortizationSchedule
        with transaction.atomic():
            line = AmortizationSchedule.objects.select_for_update().get(id=schedule_id, organization=organization)
            if line.is_posted:
                raise ValidationError("Already posted.")

            asset = line.asset
            if not asset.depreciation_expense_coa_id or not asset.accumulated_depreciation_coa_id:
                raise ValidationError("Asset COA mapping incomplete.")

            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=line.period_date,
                description=f"Depreciation: {asset.name} ({line.period_date})",
                status='POSTED',
                scope=asset.scope,
                user=user,
                lines=[
                    {"account_id": asset.depreciation_expense_coa_id, "debit": line.amount, "credit": Decimal('0')},
                    {"account_id": asset.accumulated_depreciation_coa_id, "debit": Decimal('0'), "credit": line.amount},
                ],
                internal_bypass=True
            )

            line.is_posted = True
            line.journal_entry = entry
            line.save()

            asset.accumulated_depreciation += line.amount
            asset.book_value = asset.purchase_value - asset.accumulated_depreciation
            if asset.book_value <= asset.residual_value:
                asset.status = 'FULLY_DEPRECIATED'
            asset.save()

            return line
