"""
Asset Depreciation Service
===========================
Handles depreciation calculation, schedule generation, and automated posting.

Depreciation Methods:
- LINEAR (Straight Line): Equal depreciation each period
- DECLINING (Declining Balance): Higher depreciation in early years
- UNITS (Units of Production): Based on actual usage

Usage:
    from apps.finance.services.depreciation_service import DepreciationService

    service = DepreciationService(asset)
    schedule = service.generate_depreciation_schedule()
    service.post_monthly_depreciation(month, year)
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Optional
from django.db import transaction
from django.utils import timezone


class DepreciationService:
    """Service for asset depreciation management."""

    def __init__(self, asset):
        """
        Initialize depreciation service.

        Args:
            asset: Asset instance
        """
        self.asset = asset

    def generate_depreciation_schedule(self, regenerate: bool = False) -> List[Dict]:
        """
        Generate depreciation schedule for asset's useful life.

        Args:
            regenerate: If True, delete existing schedule and regenerate

        Returns:
            List of period dictionaries with depreciation amounts
        """
        from apps.finance.models import AmortizationSchedule

        # Delete existing schedule if regenerate
        if regenerate:
            self.asset.amortization_lines.all().delete()

        # Check if schedule already exists
        if self.asset.amortization_lines.exists() and not regenerate:
            return self._serialize_schedule(self.asset.amortization_lines.all())

        # Validate asset data
        if not self.asset.purchase_date:
            raise ValueError("Asset must have a purchase date")
        if self.asset.useful_life_years <= 0:
            raise ValueError("Asset useful life must be > 0")
        if self.asset.purchase_value <= 0:
            raise ValueError("Asset purchase value must be > 0")

        # Calculate depreciable amount
        depreciable_amount = self.asset.purchase_value - self.asset.residual_value

        if depreciable_amount <= 0:
            raise ValueError("Depreciable amount must be > 0 (purchase_value - residual_value)")

        # Generate schedule based on method
        if self.asset.depreciation_method == 'LINEAR':
            schedule = self._generate_straight_line(depreciable_amount)
        elif self.asset.depreciation_method == 'DECLINING':
            schedule = self._generate_declining_balance(depreciable_amount)
        elif self.asset.depreciation_method == 'UNITS':
            schedule = self._generate_units_of_production(depreciable_amount)
        else:
            # Default to straight line
            schedule = self._generate_straight_line(depreciable_amount)

        # Create amortization schedule records
        with transaction.atomic():
            for period in schedule:
                AmortizationSchedule.objects.create(
                    organization=self.asset.organization,
                    asset=self.asset,
                    period_date=period['period_date'],
                    amount=period['amount'],
                    is_posted=False
                )

        return schedule

    def post_monthly_depreciation(
        self,
        month: int,
        year: int,
        auto_create_missing: bool = True
    ) -> Dict:
        """
        Post depreciation for a specific month.

        Args:
            month: Month (1-12)
            year: Year
            auto_create_missing: If True, create schedule entry if missing

        Returns:
            Dict with posting details
        """
        from apps.finance.models import AmortizationSchedule, JournalEntry, JournalEntryLine

        # Get period date (last day of month)
        period_date = date(year, month, 1) + relativedelta(day=31)

        # Get or create schedule entry
        schedule_entry = AmortizationSchedule.objects.filter(
            organization=self.asset.organization,
            asset=self.asset,
            period_date=period_date
        ).first()

        if not schedule_entry:
            if not auto_create_missing:
                raise ValueError(f"No depreciation schedule entry for {period_date}")

            # Calculate monthly depreciation
            monthly_amount = self.calculate_monthly_depreciation(period_date)

            schedule_entry = AmortizationSchedule.objects.create(
                organization=self.asset.organization,
                asset=self.asset,
                period_date=period_date,
                amount=monthly_amount,
                is_posted=False
            )

        # Check if already posted
        if schedule_entry.is_posted:
            return {
                'status': 'already_posted',
                'journal_entry_id': schedule_entry.journal_entry.id if schedule_entry.journal_entry else None,
                'amount': schedule_entry.amount
            }

        # Validate accounts are set
        if not self.asset.depreciation_expense_coa:
            raise ValueError("Asset must have depreciation expense account")
        if not self.asset.accumulated_depreciation_coa:
            raise ValueError("Asset must have accumulated depreciation account")

        # Create journal entry
        with transaction.atomic():
            entry = JournalEntry.objects.create(
                organization=self.asset.organization,
                transaction_date=period_date,
                description=f"Depreciation - {self.asset.name} ({period_date.strftime('%B %Y')})",
                reference=f"DEP-{self.asset.id}-{year}-{month:02d}",
                status='POSTED',
                entry_type='DEPRECIATION',
            )

            # Debit: Depreciation Expense
            JournalEntryLine.objects.create(
                organization=self.asset.organization,
                entry=entry,
                account=self.asset.depreciation_expense_coa,
                description=f"Depreciation expense - {self.asset.name}",
                debit=schedule_entry.amount,
                credit=Decimal('0.00'),
            )

            # Credit: Accumulated Depreciation
            JournalEntryLine.objects.create(
                organization=self.asset.organization,
                entry=entry,
                account=self.asset.accumulated_depreciation_coa,
                description=f"Accumulated depreciation - {self.asset.name}",
                debit=Decimal('0.00'),
                credit=schedule_entry.amount,
            )

            # Update schedule entry
            schedule_entry.is_posted = True
            schedule_entry.journal_entry = entry
            schedule_entry.save(update_fields=['is_posted', 'journal_entry'])

            # Update asset accumulated depreciation and book value
            self.asset.accumulated_depreciation += schedule_entry.amount
            self.asset.book_value = self.asset.purchase_value - self.asset.accumulated_depreciation

            # Check if fully depreciated
            if self.asset.book_value <= self.asset.residual_value:
                self.asset.status = 'FULLY_DEPRECIATED'

            self.asset.save(update_fields=['accumulated_depreciation', 'book_value', 'status'])

        return {
            'status': 'posted',
            'journal_entry_id': entry.id,
            'amount': schedule_entry.amount,
            'accumulated_depreciation': self.asset.accumulated_depreciation,
            'book_value': self.asset.book_value,
        }

    def calculate_monthly_depreciation(self, as_of_date: date = None) -> Decimal:
        """
        Calculate monthly depreciation amount.

        Args:
            as_of_date: Date for calculation (default: today)

        Returns:
            Monthly depreciation amount
        """
        if as_of_date is None:
            as_of_date = date.today()

        # Check if asset should be depreciated
        if self.asset.status == 'FULLY_DEPRECIATED':
            return Decimal('0.00')
        if as_of_date < self.asset.purchase_date:
            return Decimal('0.00')

        depreciable_amount = self.asset.purchase_value - self.asset.residual_value

        if self.asset.depreciation_method == 'LINEAR':
            # Straight line: (purchase_value - residual_value) / (useful_life_years * 12)
            monthly_depreciation = depreciable_amount / (self.asset.useful_life_years * 12)
        elif self.asset.depreciation_method == 'DECLINING':
            # Declining balance: remaining_value * (2 / useful_life_years) / 12
            remaining_value = self.asset.book_value
            annual_rate = Decimal('2.0') / self.asset.useful_life_years
            monthly_depreciation = remaining_value * annual_rate / 12
        else:
            # Default to straight line
            monthly_depreciation = depreciable_amount / (self.asset.useful_life_years * 12)

        return monthly_depreciation.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def get_depreciation_summary(self) -> Dict:
        """
        Get comprehensive depreciation summary for asset.

        Returns:
            Dict with depreciation details
        """
        from apps.finance.models import AmortizationSchedule

        schedule_entries = AmortizationSchedule.objects.filter(
            organization=self.asset.organization,
            asset=self.asset
        ).order_by('period_date')

        total_scheduled = sum(entry.amount for entry in schedule_entries)
        total_posted = sum(entry.amount for entry in schedule_entries.filter(is_posted=True))
        total_unposted = sum(entry.amount for entry in schedule_entries.filter(is_posted=False))

        depreciable_amount = self.asset.purchase_value - self.asset.residual_value
        remaining_to_depreciate = depreciable_amount - self.asset.accumulated_depreciation

        # Calculate completion percentage
        completion_pct = (
            (self.asset.accumulated_depreciation / depreciable_amount * 100)
            if depreciable_amount > 0 else 0
        )

        return {
            'asset_id': self.asset.id,
            'asset_name': self.asset.name,
            'purchase_value': self.asset.purchase_value,
            'residual_value': self.asset.residual_value,
            'depreciable_amount': depreciable_amount,
            'accumulated_depreciation': self.asset.accumulated_depreciation,
            'book_value': self.asset.book_value,
            'remaining_to_depreciate': remaining_to_depreciate,
            'completion_percentage': completion_pct,
            'depreciation_method': self.asset.depreciation_method,
            'useful_life_years': self.asset.useful_life_years,
            'status': self.asset.status,
            'total_scheduled': total_scheduled,
            'total_posted': total_posted,
            'total_unposted': total_unposted,
            'schedule_entries_count': schedule_entries.count(),
            'posted_entries_count': schedule_entries.filter(is_posted=True).count(),
        }

    def dispose_asset(
        self,
        disposal_date: date,
        disposal_amount: Decimal,
        disposal_account,
        notes: str = ''
    ) -> Dict:
        """
        Record asset disposal.

        Args:
            disposal_date: Date of disposal
            disposal_amount: Sale/disposal proceeds
            disposal_account: Bank/cash account receiving proceeds
            notes: Disposal notes

        Returns:
            Dict with disposal details
        """
        from apps.finance.models import JournalEntry, JournalEntryLine

        disposal_amount = Decimal(str(disposal_amount))

        # Calculate gain/loss on disposal
        gain_loss = disposal_amount - self.asset.book_value

        with transaction.atomic():
            # Create disposal journal entry
            entry = JournalEntry.objects.create(
                organization=self.asset.organization,
                transaction_date=disposal_date,
                description=f"Asset disposal - {self.asset.name}",
                reference=f"DISP-{self.asset.id}",
                status='POSTED',
                entry_type='ASSET_DISPOSAL',
            )

            # Debit: Bank/Cash (disposal proceeds)
            if disposal_amount > 0:
                JournalEntryLine.objects.create(
                    organization=self.asset.organization,
                    entry=entry,
                    account=disposal_account,
                    description=f"Proceeds from disposal - {self.asset.name}",
                    debit=disposal_amount,
                    credit=Decimal('0.00'),
                )

            # Debit: Accumulated Depreciation (remove accumulated)
            if self.asset.accumulated_depreciation > 0:
                JournalEntryLine.objects.create(
                    organization=self.asset.organization,
                    entry=entry,
                    account=self.asset.accumulated_depreciation_coa,
                    description=f"Remove accumulated depreciation - {self.asset.name}",
                    debit=self.asset.accumulated_depreciation,
                    credit=Decimal('0.00'),
                )

            # Credit: Asset Account (remove asset)
            JournalEntryLine.objects.create(
                organization=self.asset.organization,
                entry=entry,
                account=self.asset.asset_coa,
                description=f"Remove asset - {self.asset.name}",
                debit=Decimal('0.00'),
                credit=self.asset.purchase_value,
            )

            # Gain or Loss account
            if gain_loss != 0:
                # Get gain/loss account (should be setup in COA)
                from apps.finance.models import ChartOfAccount
                if gain_loss > 0:
                    # Gain: Credit income account
                    gain_loss_account = ChartOfAccount.objects.filter(
                        organization=self.asset.organization,
                        code__startswith='8',  # Income
                        name__icontains='gain'
                    ).first()
                    if gain_loss_account:
                        JournalEntryLine.objects.create(
                            organization=self.asset.organization,
                            entry=entry,
                            account=gain_loss_account,
                            description=f"Gain on disposal - {self.asset.name}",
                            debit=Decimal('0.00'),
                            credit=abs(gain_loss),
                        )
                else:
                    # Loss: Debit expense account
                    gain_loss_account = ChartOfAccount.objects.filter(
                        organization=self.asset.organization,
                        code__startswith='6',  # Expense
                        name__icontains='loss'
                    ).first()
                    if gain_loss_account:
                        JournalEntryLine.objects.create(
                            organization=self.asset.organization,
                            entry=entry,
                            account=gain_loss_account,
                            description=f"Loss on disposal - {self.asset.name}",
                            debit=abs(gain_loss),
                            credit=Decimal('0.00'),
                        )

            # Update asset status
            self.asset.status = 'DISPOSED'
            self.asset.save(update_fields=['status'])

        return {
            'status': 'disposed',
            'journal_entry_id': entry.id,
            'disposal_amount': disposal_amount,
            'book_value': self.asset.book_value,
            'gain_loss': gain_loss,
            'gain_loss_type': 'GAIN' if gain_loss > 0 else 'LOSS' if gain_loss < 0 else 'NONE',
        }

    # Private helper methods

    def _generate_straight_line(self, depreciable_amount: Decimal) -> List[Dict]:
        """
        Generate straight-line depreciation schedule.

        Equal depreciation each period.
        """
        total_months = self.asset.useful_life_years * 12
        monthly_depreciation = (depreciable_amount / total_months).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )

        schedule = []
        current_date = self.asset.purchase_date

        for month in range(total_months):
            # Move to end of month
            period_date = current_date + relativedelta(months=month+1, day=31)

            # Last period: adjust for rounding
            if month == total_months - 1:
                total_so_far = sum(entry['amount'] for entry in schedule)
                monthly_depreciation = depreciable_amount - total_so_far

            schedule.append({
                'period_date': period_date,
                'amount': monthly_depreciation,
                'method': 'LINEAR'
            })

        return schedule

    def _generate_declining_balance(self, depreciable_amount: Decimal) -> List[Dict]:
        """
        Generate declining balance depreciation schedule.

        Higher depreciation in early years (typically 200% of straight-line).
        """
        total_months = self.asset.useful_life_years * 12
        annual_rate = Decimal('2.0') / self.asset.useful_life_years  # Double-declining
        monthly_rate = annual_rate / 12

        schedule = []
        remaining_value = self.asset.purchase_value
        current_date = self.asset.purchase_date

        for month in range(total_months):
            period_date = current_date + relativedelta(months=month+1, day=31)

            # Calculate depreciation for this month
            monthly_depreciation = (remaining_value * monthly_rate).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )

            # Don't depreciate below residual value
            if remaining_value - monthly_depreciation < self.asset.residual_value:
                monthly_depreciation = remaining_value - self.asset.residual_value

            # Stop if fully depreciated
            if monthly_depreciation <= 0:
                break

            schedule.append({
                'period_date': period_date,
                'amount': monthly_depreciation,
                'method': 'DECLINING'
            })

            remaining_value -= monthly_depreciation

        return schedule

    def _generate_units_of_production(self, depreciable_amount: Decimal) -> List[Dict]:
        """
        Generate units of production depreciation schedule.

        Note: This requires tracking actual usage, so we'll create
        monthly placeholders that can be updated with actual usage.
        """
        # For now, default to straight-line as placeholder
        # In real implementation, would track actual units produced/used
        return self._generate_straight_line(depreciable_amount)

    def _serialize_schedule(self, schedule_queryset) -> List[Dict]:
        """Serialize schedule queryset to dict list."""
        return [
            {
                'period_date': entry.period_date,
                'amount': entry.amount,
                'is_posted': entry.is_posted,
            }
            for entry in schedule_queryset
        ]


class DepreciationBatchService:
    """Service for batch depreciation operations."""

    @staticmethod
    def post_depreciation_for_month(organization, month: int, year: int) -> Dict:
        """
        Post depreciation for all active assets in a month.

        Args:
            organization: Organization instance
            month: Month (1-12)
            year: Year

        Returns:
            Dict with batch posting results
        """
        from apps.finance.models import Asset

        # Get all active assets
        assets = Asset.objects.filter(
            organization=organization,
            status='ACTIVE'
        )

        results = {
            'total_assets': assets.count(),
            'posted': 0,
            'already_posted': 0,
            'errors': 0,
            'total_amount': Decimal('0.00'),
            'details': []
        }

        for asset in assets:
            try:
                service = DepreciationService(asset)
                result = service.post_monthly_depreciation(month, year)

                if result['status'] == 'posted':
                    results['posted'] += 1
                    results['total_amount'] += result['amount']
                elif result['status'] == 'already_posted':
                    results['already_posted'] += 1

                results['details'].append({
                    'asset_id': asset.id,
                    'asset_name': asset.name,
                    'status': result['status'],
                    'amount': result['amount']
                })

            except Exception as e:
                results['errors'] += 1
                results['details'].append({
                    'asset_id': asset.id,
                    'asset_name': asset.name,
                    'status': 'error',
                    'error': str(e)
                })

        return results

    @staticmethod
    def get_asset_register(organization, as_of_date: date = None) -> List[Dict]:
        """
        Get asset register with depreciation details.

        Args:
            organization: Organization instance
            as_of_date: Date for report (default: today)

        Returns:
            List of asset dictionaries with depreciation details
        """
        from apps.finance.models import Asset

        if as_of_date is None:
            as_of_date = date.today()

        assets = Asset.objects.filter(
            organization=organization
        ).select_related(
            'asset_coa', 'depreciation_expense_coa', 'accumulated_depreciation_coa'
        )

        register = []
        for asset in assets:
            service = DepreciationService(asset)
            summary = service.get_depreciation_summary()
            register.append(summary)

        return register
