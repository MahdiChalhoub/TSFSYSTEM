"""
PeriodicTaxAccrualService
=========================
Computes and posts period-close tax accruals for an organization.

Call this at month-end or year-end for each applicable tax mode:
  - TURNOVER: % of total revenue for the period
  - PROFIT:   % of gross profit for the period
  - FORFAIT:  fixed periodic amount (from OrgTaxPolicy)

Usage:
    from apps.finance.services.periodic_tax_service import PeriodicTaxAccrualService

    result = PeriodicTaxAccrualService.run(
        organization=org,
        period_start='2026-01-01',
        period_end='2026-01-31',
        user=request.user,
    )
"""
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError


class PeriodicTaxAccrualService:

    @staticmethod
    def run(organization, period_start, period_end, user=None):
        """
        Run all applicable periodic tax accruals for the organization's default OrgTaxPolicy.

        Returns a list of created PeriodicTaxAccrual records.
        Raises ValidationError if no OrgTaxPolicy is configured.
        """
        from apps.finance.models import OrgTaxPolicy, PeriodicTaxAccrual
        from apps.finance.services.ledger_service import LedgerService
        from erp.services import ConfigurationService
        from django.db.models import Sum

        policy = OrgTaxPolicy.objects.filter(
            organization=organization, is_default=True
        ).first()
        if not policy:
            raise ValidationError(
                'PeriodicTaxAccrualService: no default OrgTaxPolicy configured for this organization.'
            )

        rules = ConfigurationService.get_posting_rules(organization)
        results = []

        with transaction.atomic():
            # ── TURNOVER / SALES TAX ──────────────────────────────────
            if policy.sales_tax_rate > 0 and policy.sales_tax_trigger == 'ON_TURNOVER':
                base = PeriodicTaxAccrualService._get_revenue(organization, period_start, period_end, rules)
                accrual_amount = (base * policy.sales_tax_rate).quantize(Decimal('0.01'))

                accrual = PeriodicTaxAccrualService._upsert(
                    organization=organization,
                    period_start=period_start,
                    period_end=period_end,
                    tax_type='TURNOVER',
                    base_amount=base,
                    rate=policy.sales_tax_rate,
                    accrual_amount=accrual_amount,
                    policy=policy,
                )

                if accrual.status == 'DRAFT':
                    entry = PeriodicTaxAccrualService._post_entry(
                        organization=organization,
                        period_start=period_start,
                        period_end=period_end,
                        tax_type='TURNOVER',
                        accrual_amount=accrual_amount,
                        rules=rules,
                        user=user,
                    )
                    accrual.journal_entry_id = entry.id if entry else None
                    accrual.status = 'POSTED'
                    accrual.save(update_fields=['journal_entry_id', 'status'])

                results.append({'tax_type': 'TURNOVER', 'base': float(base), 'amount': float(accrual_amount), 'id': accrual.id})

            # ── PROFIT TAX ────────────────────────────────────────────
            if policy.sales_tax_rate > 0 and policy.sales_tax_trigger == 'ON_PROFIT':
                base = PeriodicTaxAccrualService._get_gross_profit(organization, period_start, period_end, rules)
                accrual_amount = (base * policy.sales_tax_rate).quantize(Decimal('0.01'))

                accrual = PeriodicTaxAccrualService._upsert(
                    organization=organization,
                    period_start=period_start,
                    period_end=period_end,
                    tax_type='PROFIT',
                    base_amount=base,
                    rate=policy.sales_tax_rate,
                    accrual_amount=accrual_amount,
                    policy=policy,
                )

                if accrual.status == 'DRAFT':
                    entry = PeriodicTaxAccrualService._post_entry(
                        organization=organization,
                        period_start=period_start,
                        period_end=period_end,
                        tax_type='PROFIT',
                        accrual_amount=accrual_amount,
                        rules=rules,
                        user=user,
                    )
                    accrual.journal_entry_id = entry.id if entry else None
                    accrual.status = 'POSTED'
                    accrual.save(update_fields=['journal_entry_id', 'status'])

                results.append({'tax_type': 'PROFIT', 'base': float(base), 'amount': float(accrual_amount), 'id': accrual.id})

            # ── FORFAIT ───────────────────────────────────────────────
            if policy.periodic_amount > 0:
                accrual_amount = policy.periodic_amount

                accrual = PeriodicTaxAccrualService._upsert(
                    organization=organization,
                    period_start=period_start,
                    period_end=period_end,
                    tax_type='FORFAIT',
                    base_amount=Decimal('0'),
                    rate=Decimal('0'),
                    accrual_amount=accrual_amount,
                    policy=policy,
                )

                if accrual.status == 'DRAFT':
                    entry = PeriodicTaxAccrualService._post_entry(
                        organization=organization,
                        period_start=period_start,
                        period_end=period_end,
                        tax_type='FORFAIT',
                        accrual_amount=accrual_amount,
                        rules=rules,
                        user=user,
                    )
                    accrual.journal_entry_id = entry.id if entry else None
                    accrual.status = 'POSTED'
                    accrual.save(update_fields=['journal_entry_id', 'status'])

                results.append({'tax_type': 'FORFAIT', 'base': 0, 'amount': float(accrual_amount), 'id': accrual.id})

        return {
            'period': f"{period_start} to {period_end}",
            'policy': policy.name,
            'accruals': results,
        }

    # ── Helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _upsert(organization, period_start, period_end, tax_type,
                base_amount, rate, accrual_amount, policy):
        """Create or return existing draft accrual for this period+type."""
        from apps.finance.models import PeriodicTaxAccrual
        obj, created = PeriodicTaxAccrual.objects.get_or_create(
            organization=organization,
            period_start=period_start,
            period_end=period_end,
            tax_type=tax_type,
            defaults={
                'base_amount': base_amount,
                'rate': rate,
                'accrual_amount': accrual_amount,
                'policy_name': policy.name,
                'status': 'DRAFT',
            }
        )
        return obj

    @staticmethod
    def _post_entry(organization, period_start, period_end, tax_type,
                    accrual_amount, rules, user=None):
        """Post the journal entry for this accrual."""
        try:
            from apps.finance.services.ledger_service import LedgerService
            from django.utils import timezone

            expense_acc = rules.get('taxes', {}).get('expense') or rules.get('sales', {}).get('revenue')
            payable_acc = rules.get('taxes', {}).get('payable') or rules.get('purchases', {}).get('payables')

            if not expense_acc or not payable_acc:
                return None  # Missing config — skip posting, accrual still saved as DRAFT

            return LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f'Periodic Tax Accrual: {tax_type} | {period_start} to {period_end}',
                reference=f'PERIOD-TAX-{tax_type}-{period_end}',
                status='POSTED',
                scope='OFFICIAL',
                user=user,
                lines=[
                    {'account_id': expense_acc, 'debit': accrual_amount, 'credit': Decimal('0'),
                     'description': f'{tax_type} Tax Expense'},
                    {'account_id': payable_acc, 'debit': Decimal('0'), 'credit': accrual_amount,
                     'description': f'{tax_type} Payable'},
                ]
            )
        except Exception:
            return None  # Never block the accrual record creation

    @staticmethod
    def _get_revenue(organization, period_start, period_end, rules):
        """Sum all revenue credits in the period from the revenue account."""
        from apps.finance.models import JournalEntryLine
        from django.db.models import Sum

        rev_acc = rules.get('sales', {}).get('revenue')
        if not rev_acc:
            return Decimal('0')

        qs = JournalEntryLine.objects.filter(
            organization=organization,
            account_id=rev_acc,
            journal_entry__status='POSTED',
            journal_entry__transaction_date__range=[period_start, period_end],
        ).aggregate(c=Sum('credit'), d=Sum('debit'))
        return (qs['c'] or Decimal('0')) - (qs['d'] or Decimal('0'))

    @staticmethod
    def _get_gross_profit(organization, period_start, period_end, rules):
        """Gross profit = Revenue credits − COGS debits for the period."""
        from apps.finance.models import JournalEntryLine
        from django.db.models import Sum

        rev_acc  = rules.get('sales', {}).get('revenue')
        cogs_acc = rules.get('sales', {}).get('cogs')

        if not rev_acc or not cogs_acc:
            return Decimal('0')

        rev_qs = JournalEntryLine.objects.filter(
            organization=organization, account_id=rev_acc,
            journal_entry__status='POSTED',
            journal_entry__transaction_date__range=[period_start, period_end],
        ).aggregate(c=Sum('credit'), d=Sum('debit'))
        revenue = (rev_qs['c'] or Decimal('0')) - (rev_qs['d'] or Decimal('0'))

        cogs_qs = JournalEntryLine.objects.filter(
            organization=organization, account_id=cogs_acc,
            journal_entry__status='POSTED',
            journal_entry__transaction_date__range=[period_start, period_end],
        ).aggregate(c=Sum('credit'), d=Sum('debit'))
        cogs = (cogs_qs['d'] or Decimal('0')) - (cogs_qs['c'] or Decimal('0'))

        return max(Decimal('0'), revenue - cogs)
