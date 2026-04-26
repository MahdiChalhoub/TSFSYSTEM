"""
Financial Report Service
=========================
Comprehensive financial reporting: Cash Flow, Trial Balance, P&L, Balance Sheet.

Features:
- Cash Flow Statement (Direct & Indirect methods)
- Enhanced Trial Balance with opening/closing balances
- Profit & Loss Statement with comparative periods
- Balance Sheet with prior period comparison
- Account-level drill-down

Usage:
    from apps.finance.services.financial_report_service import FinancialReportService

    service = FinancialReportService(organization, start_date, end_date)
    cash_flow = service.generate_cash_flow_statement()
    trial_balance = service.generate_trial_balance()
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from typing import List, Dict, Optional
from django.db.models import Sum, Q
from collections import defaultdict


class FinancialReportService:
    """Service for generating financial reports."""

    def __init__(self, organization, start_date: date, end_date: date, scope: str = 'OFFICIAL'):
        """
        Initialize report service.

        Args:
            organization: Organization instance
            start_date: Report start date
            end_date: Report end date
            scope: 'OFFICIAL' (only OFFICIAL journals) or 'INTERNAL' (all journals).
                   Determines which journal entries contribute to every report
                   this service produces. Default OFFICIAL = safe for direct
                   API callers without the X-Scope header.
        """
        self.organization = organization
        self.start_date = start_date
        self.end_date = end_date
        self.scope = (scope or 'OFFICIAL').upper()

    def _scope_filter_qs(self, qs, prefix='journal_entry__'):
        """Apply OFFICIAL filter to a JE/JE-line queryset; INTERNAL = no filter."""
        if self.scope == 'OFFICIAL':
            return qs.filter(**{f'{prefix}scope': 'OFFICIAL'})
        return qs

    def _account_qs(self):
        """Account base queryset, scope-aware (hides internal-only in OFFICIAL view)."""
        from apps.finance.models import ChartOfAccount
        qs = ChartOfAccount.objects.filter(organization=self.organization)
        if self.scope == 'OFFICIAL':
            qs = qs.filter(is_internal=False)
        return qs

    def generate_cash_flow_statement(self, method: str = 'INDIRECT') -> Dict:
        """
        Generate Cash Flow Statement.

        Args:
            method: 'INDIRECT' (default) or 'DIRECT'

        Returns:
            Dict with cash flow statement data
        """
        if method == 'DIRECT':
            return self._generate_cash_flow_direct()
        else:
            return self._generate_cash_flow_indirect()

    def generate_trial_balance(
        self,
        include_opening: bool = True,
        include_closing: bool = True
    ) -> Dict:
        """
        Generate Trial Balance with opening and closing balances.

        Args:
            include_opening: Include opening balances
            include_closing: Include closing balances

        Returns:
            Dict with trial balance data
        """
        from apps.finance.models import JournalEntryLine

        # Scope-aware account selection (hides internal-only in OFFICIAL view)
        accounts = self._account_qs().filter(is_active=True).order_by('code')

        trial_balance_lines = []
        total_opening_debit = Decimal('0.00')
        total_opening_credit = Decimal('0.00')
        total_period_debit = Decimal('0.00')
        total_period_credit = Decimal('0.00')
        total_closing_debit = Decimal('0.00')
        total_closing_credit = Decimal('0.00')

        for account in accounts:
            # Opening balance (before start_date)
            opening_balance = Decimal('0.00')
            if include_opening:
                opening_balance = self._calculate_account_balance(
                    account,
                    end_date=self.start_date - timedelta(days=1)
                )

            # Period activity (scope-filtered)
            period_qs = JournalEntryLine.objects.filter(
                organization=self.organization,
                account=account,
                entry__status='POSTED',
                entry__transaction_date__gte=self.start_date,
                entry__transaction_date__lte=self.end_date
            )
            period_qs = self._scope_filter_qs(period_qs, prefix='entry__')
            period_totals = period_qs.aggregate(
                debit=Sum('debit'),
                credit=Sum('credit')
            )

            period_debit = period_totals['debit'] or Decimal('0.00')
            period_credit = period_totals['credit'] or Decimal('0.00')

            # Closing balance
            closing_balance = Decimal('0.00')
            if include_closing:
                closing_balance = opening_balance + period_debit - period_credit

            # Determine debit/credit presentation based on normal balance
            if account.normal_balance == 'DEBIT':
                opening_dr = opening_balance if opening_balance >= 0 else Decimal('0.00')
                opening_cr = abs(opening_balance) if opening_balance < 0 else Decimal('0.00')
                closing_dr = closing_balance if closing_balance >= 0 else Decimal('0.00')
                closing_cr = abs(closing_balance) if closing_balance < 0 else Decimal('0.00')
            else:
                opening_cr = abs(opening_balance) if opening_balance >= 0 else Decimal('0.00')
                opening_dr = opening_balance if opening_balance < 0 else Decimal('0.00')
                closing_cr = abs(closing_balance) if closing_balance >= 0 else Decimal('0.00')
                closing_dr = closing_balance if closing_balance < 0 else Decimal('0.00')

            # Skip accounts with no activity
            if (opening_balance == 0 and period_debit == 0 and
                period_credit == 0 and closing_balance == 0):
                continue

            trial_balance_lines.append({
                'account_code': account.code,
                'account_name': account.name,
                'account_type': account.account_type,
                'opening_debit': opening_dr,
                'opening_credit': opening_cr,
                'period_debit': period_debit,
                'period_credit': period_credit,
                'closing_debit': closing_dr,
                'closing_credit': closing_cr,
            })

            # Update totals
            total_opening_debit += opening_dr
            total_opening_credit += opening_cr
            total_period_debit += period_debit
            total_period_credit += period_credit
            total_closing_debit += closing_dr
            total_closing_credit += closing_cr

        return {
            'organization': self.organization.name,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'lines': trial_balance_lines,
            'totals': {
                'opening_debit': total_opening_debit,
                'opening_credit': total_opening_credit,
                'period_debit': total_period_debit,
                'period_credit': total_period_credit,
                'closing_debit': total_closing_debit,
                'closing_credit': total_closing_credit,
            },
            'is_balanced': (
                total_opening_debit == total_opening_credit and
                total_period_debit == total_period_credit and
                total_closing_debit == total_closing_credit
            )
        }

    def generate_profit_loss(
        self,
        comparative_period: bool = False,
        previous_start: date = None,
        previous_end: date = None
    ) -> Dict:
        """
        Generate Profit & Loss Statement.

        Args:
            comparative_period: Include previous period comparison
            previous_start: Previous period start date
            previous_end: Previous period end date

        Returns:
            Dict with P&L data
        """
        from apps.finance.models import ChartOfAccount

        # Get revenue and expense accounts
        revenue_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            account_type='INCOME',
            is_active=True
        ).order_by('code')

        expense_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            account_type='EXPENSE',
            is_active=True
        ).order_by('code')

        # Calculate current period
        revenue_lines = []
        expense_lines = []
        total_revenue = Decimal('0.00')
        total_expenses = Decimal('0.00')

        for account in revenue_accounts:
            amount = self._calculate_account_activity(account, self.start_date, self.end_date)
            if amount != 0:
                revenue_lines.append({
                    'account_code': account.code,
                    'account_name': account.name,
                    'amount': abs(amount),  # Revenue is credit, show as positive
                })
                total_revenue += abs(amount)

        for account in expense_accounts:
            amount = self._calculate_account_activity(account, self.start_date, self.end_date)
            if amount != 0:
                expense_lines.append({
                    'account_code': account.code,
                    'account_name': account.name,
                    'amount': abs(amount),  # Expense is debit, show as positive
                })
                total_expenses += abs(amount)

        net_income = total_revenue - total_expenses

        result = {
            'organization': self.organization.name,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'revenue': {
                'lines': revenue_lines,
                'total': total_revenue
            },
            'expenses': {
                'lines': expense_lines,
                'total': total_expenses
            },
            'net_income': net_income,
            'net_margin_percentage': (
                (net_income / total_revenue * 100) if total_revenue > 0 else Decimal('0.00')
            )
        }

        # Add comparative period if requested
        if comparative_period and previous_start and previous_end:
            prev_service = FinancialReportService(self.organization, previous_start, previous_end, scope=self.scope)
            prev_pl = prev_service.generate_profit_loss()

            result['previous_period'] = {
                'start_date': previous_start,
                'end_date': previous_end,
                'total_revenue': prev_pl['revenue']['total'],
                'total_expenses': prev_pl['expenses']['total'],
                'net_income': prev_pl['net_income'],
            }

            result['variance'] = {
                'revenue': total_revenue - prev_pl['revenue']['total'],
                'expenses': total_expenses - prev_pl['expenses']['total'],
                'net_income': net_income - prev_pl['net_income'],
            }

        return result

    def generate_balance_sheet(
        self,
        as_of_date: date = None,
        comparative: bool = False,
        previous_date: date = None
    ) -> Dict:
        """
        Generate Balance Sheet.

        Args:
            as_of_date: Balance sheet date (default: end_date)
            comparative: Include previous period comparison
            previous_date: Previous period date

        Returns:
            Dict with balance sheet data
        """
        from apps.finance.models import ChartOfAccount

        if as_of_date is None:
            as_of_date = self.end_date

        # Get accounts by type
        asset_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            account_type='ASSET',
            is_active=True
        ).order_by('code')

        liability_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            account_type='LIABILITY',
            is_active=True
        ).order_by('code')

        equity_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            account_type='EQUITY',
            is_active=True
        ).order_by('code')

        # Calculate balances
        assets = []
        liabilities = []
        equity = []
        total_assets = Decimal('0.00')
        total_liabilities = Decimal('0.00')
        total_equity = Decimal('0.00')

        for account in asset_accounts:
            balance = self._calculate_account_balance(account, end_date=as_of_date)
            if balance != 0:
                assets.append({
                    'account_code': account.code,
                    'account_name': account.name,
                    'balance': abs(balance)
                })
                total_assets += abs(balance)

        for account in liability_accounts:
            balance = self._calculate_account_balance(account, end_date=as_of_date)
            if balance != 0:
                liabilities.append({
                    'account_code': account.code,
                    'account_name': account.name,
                    'balance': abs(balance)
                })
                total_liabilities += abs(balance)

        for account in equity_accounts:
            balance = self._calculate_account_balance(account, end_date=as_of_date)
            if balance != 0:
                equity.append({
                    'account_code': account.code,
                    'account_name': account.name,
                    'balance': abs(balance)
                })
                total_equity += abs(balance)

        # Calculate net income for the period and add to equity
        net_income = self._calculate_net_income(end_date=as_of_date)
        total_equity += net_income

        result = {
            'organization': self.organization.name,
            'as_of_date': as_of_date,
            'assets': {
                'lines': assets,
                'total': total_assets
            },
            'liabilities': {
                'lines': liabilities,
                'total': total_liabilities
            },
            'equity': {
                'lines': equity,
                'retained_earnings': net_income,
                'total': total_equity
            },
            'total_liabilities_equity': total_liabilities + total_equity,
            'is_balanced': abs(total_assets - (total_liabilities + total_equity)) < Decimal('0.01')
        }

        # Add comparative if requested
        if comparative and previous_date:
            prev_service = FinancialReportService(
                self.organization,
                self.start_date,
                previous_date,
                scope=self.scope,
            )
            prev_bs = prev_service.generate_balance_sheet(as_of_date=previous_date)

            result['previous_period'] = {
                'as_of_date': previous_date,
                'total_assets': prev_bs['assets']['total'],
                'total_liabilities': prev_bs['liabilities']['total'],
                'total_equity': prev_bs['equity']['total'],
            }

        return result

    # Private helper methods

    def _generate_cash_flow_indirect(self) -> Dict:
        """
        Generate Cash Flow Statement using indirect method.

        Starts with net income and adjusts for non-cash items.
        """
        # Calculate net income
        net_income = self._calculate_net_income(
            start_date=self.start_date,
            end_date=self.end_date
        )

        # Operating Activities
        operating_activities = {
            'net_income': net_income,
            'adjustments': [],
            'total': Decimal('0.00')
        }

        # Add back non-cash expenses (depreciation, amortization)
        depreciation = self._get_depreciation_expense()
        if depreciation:
            operating_activities['adjustments'].append({
                'description': 'Depreciation and Amortization',
                'amount': depreciation
            })

        # Changes in working capital
        ar_change = self._get_accounts_receivable_change()
        if ar_change:
            operating_activities['adjustments'].append({
                'description': 'Accounts Receivable Change',
                'amount': -ar_change  # Increase in AR is use of cash
            })

        ap_change = self._get_accounts_payable_change()
        if ap_change:
            operating_activities['adjustments'].append({
                'description': 'Accounts Payable Change',
                'amount': ap_change  # Increase in AP is source of cash
            })

        operating_total = net_income + sum(adj['amount'] for adj in operating_activities['adjustments'])
        operating_activities['total'] = operating_total

        # Investing Activities
        investing_activities = {
            'items': [],
            'total': Decimal('0.00')
        }

        # Asset purchases/sales
        asset_activity = self._get_asset_activity()
        if asset_activity:
            investing_activities['items'].extend(asset_activity)

        investing_total = sum(item['amount'] for item in investing_activities['items'])
        investing_activities['total'] = investing_total

        # Financing Activities
        financing_activities = {
            'items': [],
            'total': Decimal('0.00')
        }

        # Loan activity
        loan_activity = self._get_loan_activity()
        if loan_activity:
            financing_activities['items'].extend(loan_activity)

        # Equity activity
        equity_activity = self._get_equity_activity()
        if equity_activity:
            financing_activities['items'].extend(equity_activity)

        financing_total = sum(item['amount'] for item in financing_activities['items'])
        financing_activities['total'] = financing_total

        # Net cash change
        net_cash_change = operating_total + investing_total + financing_total

        # Beginning and ending cash
        beginning_cash = self._get_cash_balance(self.start_date - timedelta(days=1))
        ending_cash = beginning_cash + net_cash_change

        return {
            'organization': self.organization.name,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'method': 'INDIRECT',
            'operating_activities': operating_activities,
            'investing_activities': investing_activities,
            'financing_activities': financing_activities,
            'net_cash_change': net_cash_change,
            'beginning_cash': beginning_cash,
            'ending_cash': ending_cash,
        }

    def _generate_cash_flow_direct(self) -> Dict:
        """
        Generate Cash Flow Statement using direct method.

        Shows actual cash receipts and payments.
        """
        # For now, return indirect method
        # Direct method requires detailed cash transaction tracking
        return self._generate_cash_flow_indirect()

    def _calculate_account_balance(
        self,
        account,
        start_date: date = None,
        end_date: date = None
    ) -> Decimal:
        """Calculate account balance for date range (scope-aware)."""
        from apps.finance.models import JournalEntryLine

        query = Q(
            organization=self.organization,
            account=account,
            entry__status='POSTED'
        )

        if end_date:
            query &= Q(entry__transaction_date__lte=end_date)
        if start_date:
            query &= Q(entry__transaction_date__gte=start_date)

        # OFFICIAL view → only OFFICIAL journals; INTERNAL → all journals.
        if self.scope == 'OFFICIAL':
            query &= Q(entry__scope='OFFICIAL')

        totals = JournalEntryLine.objects.filter(query).aggregate(
            debit=Sum('debit'),
            credit=Sum('credit')
        )

        debit_total = totals['debit'] or Decimal('0.00')
        credit_total = totals['credit'] or Decimal('0.00')

        # Net balance based on account type
        if account.normal_balance == 'DEBIT':
            return debit_total - credit_total
        else:
            return credit_total - debit_total

    def _calculate_account_activity(
        self,
        account,
        start_date: date,
        end_date: date
    ) -> Decimal:
        """Calculate account activity for period."""
        return self._calculate_account_balance(account, start_date, end_date)

    def _calculate_net_income(
        self,
        start_date: date = None,
        end_date: date = None
    ) -> Decimal:
        """Calculate net income for period."""
        from apps.finance.models import ChartOfAccount

        if start_date is None:
            start_date = self.start_date
        if end_date is None:
            end_date = self.end_date

        # Revenue - Expenses
        revenue_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            account_type='INCOME'
        )

        expense_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            account_type='EXPENSE'
        )

        total_revenue = sum(
            abs(self._calculate_account_activity(acc, start_date, end_date))
            for acc in revenue_accounts
        )

        total_expenses = sum(
            abs(self._calculate_account_activity(acc, start_date, end_date))
            for acc in expense_accounts
        )

        return total_revenue - total_expenses

    def _get_depreciation_expense(self) -> Decimal:
        """Get depreciation expense for period."""
        from apps.finance.models import ChartOfAccount

        dep_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            name__icontains='depreciation',
            account_type='EXPENSE'
        )

        return sum(
            abs(self._calculate_account_activity(acc, self.start_date, self.end_date))
            for acc in dep_accounts
        )

    def _get_accounts_receivable_change(self) -> Decimal:
        """Get change in accounts receivable."""
        from apps.finance.models import ChartOfAccount

        ar_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            code__startswith='1120',  # AR account code pattern
            account_type='ASSET'
        )

        beginning = sum(
            self._calculate_account_balance(acc, end_date=self.start_date - timedelta(days=1))
            for acc in ar_accounts
        )

        ending = sum(
            self._calculate_account_balance(acc, end_date=self.end_date)
            for acc in ar_accounts
        )

        return ending - beginning

    def _get_accounts_payable_change(self) -> Decimal:
        """Get change in accounts payable."""
        from apps.finance.models import ChartOfAccount

        ap_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            code__startswith='2100',  # AP account code pattern
            account_type='LIABILITY'
        )

        beginning = sum(
            self._calculate_account_balance(acc, end_date=self.start_date - timedelta(days=1))
            for acc in ap_accounts
        )

        ending = sum(
            self._calculate_account_balance(acc, end_date=self.end_date)
            for acc in ap_accounts
        )

        return ending - beginning

    def _get_asset_activity(self) -> List[Dict]:
        """Get asset purchase/sale activity."""
        # Would query asset purchases/disposals from Asset model
        # For now, return empty
        return []

    def _get_loan_activity(self) -> List[Dict]:
        """Get loan disbursement/repayment activity."""
        # Would query loan transactions
        # For now, return empty
        return []

    def _get_equity_activity(self) -> List[Dict]:
        """Get equity contributions/distributions."""
        # Would query equity transactions
        # For now, return empty
        return []

    def _get_cash_balance(self, as_of_date: date) -> Decimal:
        """Get cash balance as of date."""
        from apps.finance.models import ChartOfAccount

        cash_accounts = ChartOfAccount.objects.filter(
            organization=self.organization,
            code__startswith='1',  # Cash accounts
            name__icontains='cash',
            account_type='ASSET'
        ) | ChartOfAccount.objects.filter(
            organization=self.organization,
            code__startswith='1',
            name__icontains='bank',
            account_type='ASSET'
        )

        return sum(
            self._calculate_account_balance(acc, end_date=as_of_date)
            for acc in cash_accounts
        )
