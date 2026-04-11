import calendar
from datetime import timedelta, date
from django.db import transaction
from django.core.exceptions import ValidationError

class FiscalYearService:
    @staticmethod
    def create_fiscal_year(organization, data):
        from apps.finance.models import FiscalYear, FiscalPeriod
        
        with transaction.atomic():
            # Check for overlapping years
            start_date = data['start_date']
            end_date = data['end_date']
            
            if FiscalYear.objects.filter(
                organization=organization,
                start_date__lte=end_date,
                end_date__gte=start_date
            ).exists():
                raise ValidationError("Fiscal year overlaps with an existing one.")

            fiscal_year = FiscalYear.objects.create(
                organization=organization,
                name=data['name'],
                start_date=start_date,
                end_date=end_date,
                is_closed=False,
                is_hard_locked=False
            )
            
            frequency = data.get('frequency', 'MONTHLY')
            
            curr = start_date
            if isinstance(curr, str):
                from django.utils.dateparse import parse_date
                curr = parse_date(curr)
            if isinstance(end_date, str):
                from django.utils.dateparse import parse_date
                end_date = parse_date(end_date)

            period_count = 1
            while curr <= end_date:
                last_day_of_month = calendar.monthrange(curr.year, curr.month)[1]
                period_end = date(curr.year, curr.month, last_day_of_month)
                
                if period_end > end_date:
                    period_end = end_date
                
                period_name = f"P{str(period_count).zfill(2)}-{curr.year}"
                
                FiscalPeriod.objects.create(
                    organization=organization,
                    fiscal_year=fiscal_year,
                    name=period_name,
                    start_date=curr,
                    end_date=period_end
                )
                
                curr = period_end + timedelta(days=1)
                period_count += 1
                
            return fiscal_year

    @staticmethod
    def close_fiscal_year(organization, fiscal_year, user=None, retained_earnings_account_id=None):
        """
        Close a fiscal year. Delegates to ClosingService for the full
        SAP/Odoo-standard year-end close sequence:
          1. Verify all periods are closed
          2. Close P&L into retained earnings
          3. Generate opening balances for next year
          4. Lock fiscal year
        """
        from apps.finance.services.closing_service import ClosingService
        return ClosingService.close_fiscal_year(
            organization, fiscal_year,
            user=user,
            retained_earnings_account_id=retained_earnings_account_id,
        )
