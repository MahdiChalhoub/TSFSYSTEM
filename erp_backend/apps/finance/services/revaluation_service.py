"""
Currency Revaluation Service — Period-end FX gain/loss computation.

At period-end, accounts denominated in foreign currencies are revalued
at the closing exchange rate. The difference is an unrealized FX gain
or loss, posted to the P&L.
"""
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class RevaluationService:
    """Handles foreign currency revaluation at period-end."""

    @staticmethod
    def run_revaluation(organization, fiscal_period, user=None, scope='OFFICIAL'):
        """
        Execute a full revaluation for all foreign-currency accounts.

        Steps:
          1. Find all accounts with allow_multi_currency or currency != base
          2. For each, compute balance in foreign currency
          3. Revalue at closing rate vs. average rate
          4. Create revaluation JE for the net difference
        """
        from apps.finance.models import (
            ChartOfAccount, JournalEntryLine,
            CurrencyRevaluation, CurrencyRevaluationLine,
            Currency, ExchangeRate,
        )
        from apps.finance.services.ledger_core import LedgerCoreMixin
        from erp.services import ConfigurationService

        # Find base currency
        base_currency = Currency.objects.filter(
            organization=organization, is_base=True
        ).first()
        if not base_currency:
            raise ValidationError("No base currency configured. Set one currency as is_base=True.")

        # Find accounts that need revaluation
        revaluation_accounts = ChartOfAccount.objects.filter(
            organization=organization,
            is_active=True,
            revaluation_required=True,
        ).exclude(currency=base_currency.code).exclude(currency__isnull=True)

        if not revaluation_accounts.exists():
            logger.info("RevaluationService: No accounts require revaluation.")
            return None

        with transaction.atomic():
            reval = CurrencyRevaluation.objects.create(
                organization=organization,
                fiscal_period=fiscal_period,
                revaluation_date=fiscal_period.end_date,
                scope=scope,
                created_by=user,
            )

            posting_lines = []
            total_gain = Decimal('0.00')
            total_loss = Decimal('0.00')
            processed = 0

            for acc in revaluation_accounts:
                # Get balances in foreign currency from JEL
                fc_balance = JournalEntryLine.objects.filter(
                    organization=organization,
                    account=acc,
                    journal_entry__status='POSTED',
                    journal_entry__fiscal_period=fiscal_period,
                ).aggregate(
                    total_fc=models.Sum('amount_currency')
                )
                balance_in_fc = fc_balance['total_fc'] or Decimal('0.00')
                if balance_in_fc == Decimal('0.00'):
                    continue

                # Get closing rate
                closing_rate_obj = ExchangeRate.objects.filter(
                    organization=organization,
                    from_currency__code=acc.currency,
                    to_currency=base_currency,
                    effective_date__lte=fiscal_period.end_date,
                    rate_type='CLOSING',
                ).order_by('-effective_date').first()

                if not closing_rate_obj:
                    # Fallback to spot rate
                    closing_rate_obj = ExchangeRate.objects.filter(
                        organization=organization,
                        from_currency__code=acc.currency,
                        to_currency=base_currency,
                        effective_date__lte=fiscal_period.end_date,
                    ).order_by('-effective_date').first()

                if not closing_rate_obj:
                    logger.warning(
                        f"RevaluationService: No rate for {acc.currency}→{base_currency.code}. "
                        f"Skipping account {acc.code}."
                    )
                    continue

                closing_rate = closing_rate_obj.rate
                old_base_amount = acc.balance_official  # Current base currency balance
                new_base_amount = balance_in_fc * closing_rate
                difference = new_base_amount - old_base_amount

                CurrencyRevaluationLine.objects.create(
                    organization=organization,
                    revaluation=reval,
                    account=acc,
                    currency=closing_rate_obj.from_currency,
                    balance_in_currency=balance_in_fc,
                    old_rate=Decimal('1') if old_base_amount == Decimal('0') else (old_base_amount / balance_in_fc),
                    new_rate=closing_rate,
                    old_base_amount=old_base_amount,
                    new_base_amount=new_base_amount,
                    difference=difference,
                )

                if difference != Decimal('0.00'):
                    if difference > Decimal('0'):
                        # Unrealized gain: Debit the account, Credit FX gain
                        posting_lines.append({
                            'account_id': acc.id,
                            'debit': difference,
                            'credit': Decimal('0.00'),
                            'description': f"FX Reval: {acc.code} ({acc.currency}) gain",
                        })
                        total_gain += difference
                    else:
                        # Unrealized loss: Credit the account, Debit FX loss
                        posting_lines.append({
                            'account_id': acc.id,
                            'debit': Decimal('0.00'),
                            'credit': abs(difference),
                            'description': f"FX Reval: {acc.code} ({acc.currency}) loss",
                        })
                        total_loss += abs(difference)

                processed += 1

            # Add FX gain/loss counter-lines from posting rules
            if posting_lines:
                rules = ConfigurationService.get_posting_rules(organization)
                fx_gain_id = rules.get('fx', {}).get('unrealized_gain')
                fx_loss_id = rules.get('fx', {}).get('unrealized_loss')

                if total_gain > Decimal('0'):
                    posting_lines.append({
                        'account_id': fx_gain_id,
                        'debit': Decimal('0.00'),
                        'credit': total_gain,
                        'description': 'Unrealized FX gain',
                    })
                if total_loss > Decimal('0'):
                    posting_lines.append({
                        'account_id': fx_loss_id,
                        'debit': total_loss,
                        'credit': Decimal('0.00'),
                        'description': 'Unrealized FX loss',
                    })

                je = LedgerCoreMixin.create_journal_entry(
                    organization=organization,
                    transaction_date=fiscal_period.end_date,
                    description=f"FX Revaluation: {fiscal_period.name}",
                    lines=posting_lines,
                    status='POSTED',
                    scope=scope,
                    user=user,
                    journal_type='ADJUSTMENT',
                    source_module='finance',
                    source_model='CurrencyRevaluation',
                    source_id=reval.id,
                    internal_bypass=True,
                )
                reval.journal_entry = je
                reval.status = 'POSTED'

            reval.total_gain = total_gain
            reval.total_loss = total_loss
            reval.net_impact = total_gain - total_loss
            reval.accounts_processed = processed
            reval.save()

            logger.info(
                f"RevaluationService: Processed {processed} accounts. "
                f"Gain={total_gain}, Loss={total_loss}, Net={reval.net_impact}"
            )
            return reval

    @staticmethod
    def get_rate(organization, from_code, to_code, date, rate_type='SPOT'):
        """Helper to look up an exchange rate with fallback chain."""
        from apps.finance.models import ExchangeRate

        rate_obj = ExchangeRate.objects.filter(
            organization=organization,
            from_currency__code=from_code,
            to_currency__code=to_code,
            effective_date__lte=date,
            rate_type=rate_type,
        ).order_by('-effective_date').first()

        if rate_obj:
            return rate_obj.rate

        # Fallback: try SPOT if we asked for CLOSING/AVERAGE
        if rate_type != 'SPOT':
            return RevaluationService.get_rate(organization, from_code, to_code, date, 'SPOT')

        return None
