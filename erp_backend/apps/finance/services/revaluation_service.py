"""
Currency Revaluation Service — Period-end FX gain/loss computation.

At period-end, accounts denominated in foreign currencies are revalued
at the appropriate rate per IAS 21 / ASC 830:

  * Monetary items (cash, AR, AP, FC loans)        → CLOSING rate
  * Non-monetary items (PPE, prepaid expenses)     → historical rate (skip)
  * Income / expense items                          → AVERAGE rate

The difference is an unrealized FX gain/loss, posted to the P&L.

Workflow
--------
1.  ``preview(...)``          — compute the revaluation, return lines + totals,
                                no DB write. UI uses this to populate the
                                drawer before commit.
2.  ``run_revaluation(...)``  — same compute, then either:
                                 - post immediately (status=POSTED)
                                 - park as PENDING_APPROVAL when the
                                   materiality threshold is exceeded
                                Operators can pass ``excluded_account_ids``
                                to opt specific accounts out for this run.
3.  ``approve(reval, user)``  — flip PENDING_APPROVAL → POSTED, generate JE.
4.  ``reject(reval, user, reason)`` — flip PENDING_APPROVAL → REJECTED, no JE.
5.  ``reverse_at_period_start(reval)`` — auto-post a reversing JE on day 1
                                of the next fiscal period. Idempotent.
6.  ``run_multi_period_catchup(...)`` — run the above for every unrevalued
                                period in chronological order.
7.  ``compute_realized_fx(...)`` — called from payment posting; computes
                                the realized FX gain/loss between invoice
                                date and payment date.
8.  ``compute_exposure_report(...)`` — read-only snapshot of FC exposure
                                per currency / account with sensitivity bands.

The default materiality threshold is 0.5% of the revalued base, configurable
via ``organization.settings['fx']['materiality_threshold_pct']``.
"""
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

DEFAULT_MATERIALITY_THRESHOLD_PCT = Decimal('0.5000')  # 0.5%


def _get_materiality_threshold(organization) -> Decimal:
    """Read org-level materiality threshold (default 0.5%)."""
    settings = (organization.settings or {}) if hasattr(organization, 'settings') else {}
    fx_cfg = settings.get('fx', {}) if isinstance(settings, dict) else {}
    raw = fx_cfg.get('materiality_threshold_pct', DEFAULT_MATERIALITY_THRESHOLD_PCT)
    try:
        return Decimal(str(raw))
    except Exception:
        return DEFAULT_MATERIALITY_THRESHOLD_PCT


def _classification_to_rate_type(classification: str) -> str:
    """Map COA monetary classification → ExchangeRate.rate_type."""
    if classification == 'INCOME_EXPENSE':
        return 'AVERAGE'
    # MONETARY (and unknown values) default to CLOSING.
    return 'CLOSING'


class RevaluationService:
    """Handles foreign currency revaluation at period-end."""

    # ────────────────────────────────────────────────────────────────────
    # PREVIEW + RUN
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def preview(organization, fiscal_period, scope='OFFICIAL', excluded_account_ids=None):
        """
        Compute the revaluation without writing anything. Returns a dict:

            {
                'lines':                [ {…per-account…}, … ],
                'total_gain':           Decimal,
                'total_loss':           Decimal,
                'net_impact':           Decimal,
                'revalued_base_total':  Decimal,
                'materiality_pct':      Decimal,
                'materiality_threshold': Decimal,
                'requires_approval':    bool,
                'excluded_account_ids': [ids],
                'skipped':              [ {account_id, code, currency, reason} ],
            }
        """
        return RevaluationService._compute(
            organization=organization,
            fiscal_period=fiscal_period,
            scope=scope,
            excluded_account_ids=excluded_account_ids or [],
            dry_run=True,
        )

    @staticmethod
    def run_revaluation(
        organization, fiscal_period, user=None, scope='OFFICIAL',
        excluded_account_ids=None, force_post=False, dry_run=False,
        auto_reverse=True,
    ):
        """
        Execute a full revaluation. By default, gates on the org's
        materiality threshold — a run that exceeds the threshold is parked
        as PENDING_APPROVAL until a user calls ``approve``.

        Set ``force_post=True`` to bypass the gate (ops with explicit
        approval-bypass permission).
        """
        if dry_run:
            return RevaluationService.preview(
                organization=organization,
                fiscal_period=fiscal_period,
                scope=scope,
                excluded_account_ids=excluded_account_ids,
            )

        result = RevaluationService._compute(
            organization=organization,
            fiscal_period=fiscal_period,
            scope=scope,
            excluded_account_ids=excluded_account_ids or [],
            dry_run=False,
            user=user,
            auto_reverse=auto_reverse,
            force_post=force_post,
        )
        return result

    # ────────────────────────────────────────────────────────────────────
    # APPROVAL FLOW
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def approve(revaluation, user=None):
        """Flip PENDING_APPROVAL → POSTED, generate the JE."""
        if revaluation.status != 'PENDING_APPROVAL':
            raise ValidationError(
                f"Cannot approve revaluation in status {revaluation.status!r}; "
                f"must be PENDING_APPROVAL."
            )
        with transaction.atomic():
            # Supersede any prior posted revaluation for the same period+scope
            # before posting this approval's JE. See _compute() for the same
            # call on direct-post path.
            RevaluationService._supersede_prior_revaluations(revaluation)
            je = RevaluationService._build_journal_entry(revaluation, user=user)
            revaluation.journal_entry = je
            revaluation.status = 'POSTED'
            revaluation.approved_by = user
            revaluation.approved_at = timezone.now()
            revaluation.save(update_fields=[
                'journal_entry', 'status', 'approved_by', 'approved_at',
            ])
            if je is not None:
                RevaluationService._link_superseded_to_new_je(revaluation, je)
        return revaluation

    @staticmethod
    def reject(revaluation, user=None, reason=''):
        """Flip PENDING_APPROVAL → REJECTED. Lines kept for audit; no JE posted."""
        if revaluation.status != 'PENDING_APPROVAL':
            raise ValidationError(
                f"Cannot reject revaluation in status {revaluation.status!r}; "
                f"must be PENDING_APPROVAL."
            )
        revaluation.status = 'REJECTED'
        revaluation.approved_by = user
        revaluation.approved_at = timezone.now()
        revaluation.rejection_reason = (reason or '')[:1000]
        revaluation.save(update_fields=[
            'status', 'approved_by', 'approved_at', 'rejection_reason',
        ])
        return revaluation

    # ────────────────────────────────────────────────────────────────────
    # AUTO-REVERSAL ON NEXT-PERIOD START
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def reverse_at_period_start(revaluation, user=None):
        """
        Post a reversing JE on day 1 of the *next* fiscal period.
        Idempotent: returns the existing reversal_journal_entry if already done.
        """
        from apps.finance.models import FiscalPeriod, JournalEntry
        from apps.finance.services.ledger_core import LedgerCoreMixin

        if revaluation.reversal_journal_entry_id:
            return revaluation.reversal_journal_entry
        if revaluation.status != 'POSTED' or not revaluation.journal_entry_id:
            raise ValidationError(
                "Only POSTED revaluations with a JE can be reversed."
            )
        if not revaluation.auto_reverse_at_period_start:
            raise ValidationError(
                "auto_reverse_at_period_start is False for this revaluation."
            )

        # Find next fiscal period (chronologically by start_date) for the same fiscal_year.
        # Falls through to the first period of the next fiscal year if this is the last one.
        cur_period = revaluation.fiscal_period
        next_period = FiscalPeriod.objects.filter(
            organization=revaluation.organization,
            fiscal_year=cur_period.fiscal_year,
            start_date__gt=cur_period.start_date,
        ).order_by('start_date').first()

        if not next_period:
            # Try the first period of the next fiscal year.
            next_period = FiscalPeriod.objects.filter(
                organization=revaluation.organization,
                start_date__gt=cur_period.end_date,
            ).order_by('start_date').first()

        if not next_period:
            raise ValidationError(
                "No subsequent fiscal period found — cannot post auto-reversal. "
                "Create the next period first."
            )

        original_je: JournalEntry = revaluation.journal_entry

        with transaction.atomic():
            reversed_lines = []
            for line in original_je.lines.all():
                reversed_lines.append({
                    'account_id': line.account_id,
                    'debit': line.credit,    # swap sides
                    'credit': line.debit,
                    'description': f"Reversal of FX reval {cur_period.name}: {line.description or ''}".strip(),
                })

            # Don't reuse (source_module, source_model, source_id, journal_type)
            # of the original — the ledger's dedup check would reject it.
            # Audit link to the original is preserved via
            # `revaluation.reversal_journal_entry_id` (set below).
            reversal_je = LedgerCoreMixin.create_journal_entry(
                organization=revaluation.organization,
                transaction_date=next_period.start_date,
                description=f"FX Reval Reversal: {cur_period.name}",
                lines=reversed_lines,
                status='POSTED',
                scope=revaluation.scope,
                user=user,
                journal_type='ADJUSTMENT',
                source_module='finance',
                source_model='CurrencyRevaluationReversal',
                source_id=revaluation.id,
                internal_bypass=True,
            )
            revaluation.reversal_journal_entry = reversal_je
            revaluation.save(update_fields=['reversal_journal_entry'])
        return reversal_je

    # ────────────────────────────────────────────────────────────────────
    # MULTI-PERIOD CATCHUP
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def run_multi_period_catchup(
        organization, through_period, user=None, scope='OFFICIAL',
        force_post=False, auto_reverse=True, stop_on_error=False,
    ):
        """
        Run revaluation for every fiscal period that:
          - ends on or before ``through_period.end_date``
          - has no POSTED revaluation in this scope yet

        Periods are processed in chronological order so that auto-reversals
        from prior periods land before the next period's revaluation runs.

        Failure handling
        ----------------
        Each period runs in its own ``transaction.atomic()`` block. A failure
        in one period is recorded in the result row (status='ERROR') but does
        NOT roll back successful prior periods — those JEs stay posted. The
        operator can re-run catchup later to retry the failures after fixing
        the underlying cause (typically a missing exchange rate).

        If ``stop_on_error=True``, the loop bails on the first failure
        instead of continuing — useful for dry-run dependency checks.

        Returns a list of result dicts with at minimum ``period_id``,
        ``period_name``, plus one of:
          - ``revaluation_id`` + ``status``        — newly posted/parked
          - ``skipped_reason``                     — already done
          - ``error``                              — failure detail
        Plus a ``summary`` key on the last entry counting outcomes.
        """
        from apps.finance.models import FiscalPeriod, CurrencyRevaluation

        candidates = FiscalPeriod.objects.filter(
            organization=organization,
            end_date__lte=through_period.end_date,
        ).order_by('start_date')

        results = []
        n_run = 0
        n_skipped = 0
        n_errors = 0

        for period in candidates:
            try:
                with transaction.atomic():
                    # Skip if a non-rejected revaluation already exists for this scope.
                    existing = CurrencyRevaluation.objects.filter(
                        organization=organization,
                        fiscal_period=period,
                        scope=scope,
                    ).exclude(status='REJECTED').first()
                    if existing and existing.status in ('POSTED', 'PENDING_APPROVAL'):
                        # Auto-reverse the prior period's POSTED reval into THIS period
                        # if it hasn't been reversed yet — keeps the chain consistent.
                        if existing.status == 'POSTED' and existing.auto_reverse_at_period_start \
                                and not existing.reversal_journal_entry_id:
                            try:
                                RevaluationService.reverse_at_period_start(existing, user=user)
                            except ValidationError as e:
                                logger.warning(f"Catchup: skipped reversal for period {period.name}: {e}")
                        results.append({'period_id': period.id, 'period_name': period.name,
                                        'skipped_reason': f'already {existing.status}'})
                        n_skipped += 1
                        continue

                    r = RevaluationService.run_revaluation(
                        organization=organization,
                        fiscal_period=period,
                        user=user,
                        scope=scope,
                        force_post=force_post,
                        auto_reverse=auto_reverse,
                    )
                    results.append({
                        'period_id': period.id, 'period_name': period.name,
                        'revaluation_id': getattr(r, 'id', None),
                        'status': getattr(r, 'status', None),
                    })
                    n_run += 1
            except (ValidationError, Exception) as e:  # noqa: BLE001
                # Per-period rollback already occurred via atomic(). Record the
                # failure and continue (or stop if stop_on_error=True).
                err_msg = str(e) if not isinstance(e, ValidationError) else (
                    e.message if hasattr(e, 'message')
                    else (e.messages[0] if hasattr(e, 'messages') else str(e))
                )
                logger.exception(f"Catchup: period {period.name} failed: {err_msg}")
                results.append({
                    'period_id': period.id, 'period_name': period.name,
                    'error': err_msg,
                })
                n_errors += 1
                if stop_on_error:
                    break

        if results:
            results[-1]['summary'] = {
                'run': n_run, 'skipped': n_skipped, 'errors': n_errors,
                'total': len(results),
            }
        return results

    # ────────────────────────────────────────────────────────────────────
    # REALIZED FX (called from payment posting)
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def compute_realized_fx(
        organization, foreign_amount, base_currency_code, foreign_currency_code,
        invoice_rate, payment_date,
    ):
        """
        Realized FX gain/loss on a payment that settles a foreign-currency
        invoice or receivable.

            realized = foreign_amount * (payment_rate - invoice_rate)

        Positive → realized gain (book to FX_GAIN, credit P&L).
        Negative → realized loss (book to FX_LOSS, debit P&L).

        Returns a dict ready to be merged into a payment journal entry:

            {'realized': Decimal,
             'payment_rate': Decimal,
             'fx_gain_amount': Decimal,    # 0 or positive
             'fx_loss_amount': Decimal,    # 0 or positive
             'rate_source': 'SPOT'|'CLOSING'|'AVERAGE'|None}
        """
        from apps.finance.models import ExchangeRate

        if foreign_currency_code == base_currency_code or not foreign_amount:
            return {'realized': Decimal('0.00'),
                    'payment_rate': Decimal('1'), 'fx_gain_amount': Decimal('0.00'),
                    'fx_loss_amount': Decimal('0.00'), 'rate_source': None}

        rate_obj = ExchangeRate.objects.filter(
            organization=organization,
            from_currency__code=foreign_currency_code,
            to_currency__code=base_currency_code,
            effective_date__lte=payment_date,
            rate_type='SPOT',
        ).order_by('-effective_date').first()
        if not rate_obj:
            rate_obj = ExchangeRate.objects.filter(
                organization=organization,
                from_currency__code=foreign_currency_code,
                to_currency__code=base_currency_code,
                effective_date__lte=payment_date,
            ).order_by('-effective_date').first()

        if not rate_obj:
            logger.warning(
                f"compute_realized_fx: no rate {foreign_currency_code}→{base_currency_code} "
                f"on/before {payment_date}; treating realized FX as 0."
            )
            return {'realized': Decimal('0.00'),
                    'payment_rate': Decimal(invoice_rate or 1),
                    'fx_gain_amount': Decimal('0.00'),
                    'fx_loss_amount': Decimal('0.00'),
                    'rate_source': None}

        payment_rate = Decimal(rate_obj.rate)
        invoice_rate_d = Decimal(invoice_rate or 0)
        realized = (Decimal(foreign_amount) * (payment_rate - invoice_rate_d)).quantize(Decimal('0.01'))
        return {
            'realized': realized,
            'payment_rate': payment_rate,
            'fx_gain_amount': realized if realized > 0 else Decimal('0.00'),
            'fx_loss_amount': abs(realized) if realized < 0 else Decimal('0.00'),
            'rate_source': rate_obj.rate_type,
        }

    # ────────────────────────────────────────────────────────────────────
    # FX EXPOSURE REPORT (read-only snapshot)
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def compute_exposure_report(organization, as_of_date, scope='OFFICIAL', sensitivity_bands=None):
        """
        Read-only snapshot of foreign-currency exposure:

            [
              {
                'currency': 'USD',
                'accounts': [
                  {'account_id': 12, 'code': '1110', 'name': 'Bank USD',
                   'classification': 'MONETARY',
                   'balance_fc': Decimal('10000.00'),
                   'balance_base': Decimal('6000000.00'),
                   'rate': Decimal('600.0')},
                  …
                ],
                'total_fc': Decimal,
                'total_base': Decimal,
                'sensitivity': {
                    '-10': base_at_rate_minus_10pct,
                    '-5':  …,
                    '+5':  …,
                    '+10': …,
                },
              },
              …
            ]
        """
        from apps.finance.models import (
            ChartOfAccount, JournalEntryLine, Currency, ExchangeRate,
        )

        sensitivity_bands = sensitivity_bands or [Decimal('-10'), Decimal('-5'),
                                                  Decimal('5'), Decimal('10')]
        base = Currency.objects.filter(organization=organization, is_base=True).first()
        if not base:
            return {'as_of': as_of_date, 'currencies': [], 'note': 'No base currency set.'}

        accounts = ChartOfAccount.objects.filter(
            organization=organization,
            is_active=True,
        ).exclude(currency=base.code).exclude(currency__isnull=True)

        by_ccy = {}
        for acc in accounts:
            agg = JournalEntryLine.objects.filter(
                organization=organization,
                account=acc,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__transaction_date__date__lte=as_of_date,
                journal_entry__scope=scope,
                amount_currency__isnull=False,
            ).aggregate(total_fc=models.Sum('amount_currency'))
            balance_fc = agg['total_fc'] or Decimal('0.00')
            if balance_fc == 0:
                continue

            rate_obj = ExchangeRate.objects.filter(
                organization=organization,
                from_currency__code=acc.currency,
                to_currency=base,
                effective_date__lte=as_of_date,
                rate_type='CLOSING',
            ).order_by('-effective_date').first()
            if not rate_obj:
                rate_obj = ExchangeRate.objects.filter(
                    organization=organization,
                    from_currency__code=acc.currency,
                    to_currency=base,
                    effective_date__lte=as_of_date,
                ).order_by('-effective_date').first()
            rate = Decimal(rate_obj.rate) if rate_obj else Decimal('0')
            balance_base = (balance_fc * rate).quantize(Decimal('0.01'))

            row = {
                'account_id': acc.id, 'code': acc.code, 'name': acc.name,
                'classification': getattr(acc, 'monetary_classification', 'MONETARY'),
                'balance_fc': balance_fc, 'balance_base': balance_base,
                'rate': rate,
            }
            by_ccy.setdefault(acc.currency, {'accounts': [], 'total_fc': Decimal('0.00'),
                                             'total_base': Decimal('0.00'),
                                             'rate': rate})
            by_ccy[acc.currency]['accounts'].append(row)
            by_ccy[acc.currency]['total_fc'] += balance_fc
            by_ccy[acc.currency]['total_base'] += balance_base

        currencies = []
        for code, data in sorted(by_ccy.items()):
            sensitivity = {}
            for band in sensitivity_bands:
                shifted_rate = data['rate'] * (Decimal('1') + band / Decimal('100'))
                sensitivity[str(band)] = (data['total_fc'] * shifted_rate).quantize(Decimal('0.01'))
            currencies.append({
                'currency': code,
                'accounts': data['accounts'],
                'total_fc': data['total_fc'],
                'total_base': data['total_base'],
                'rate': data['rate'],
                'sensitivity': sensitivity,
            })
        return {
            'as_of': as_of_date,
            'base_currency': base.code,
            'currencies': currencies,
            'sensitivity_bands': [str(b) for b in sensitivity_bands],
        }

    # ────────────────────────────────────────────────────────────────────
    # CORE COMPUTE — shared by preview + run
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def _compute(
        organization, fiscal_period, scope, excluded_account_ids,
        dry_run, user=None, auto_reverse=True, force_post=False,
    ):
        from apps.finance.models import (
            ChartOfAccount, JournalEntryLine,
            CurrencyRevaluation, CurrencyRevaluationLine,
            Currency, ExchangeRate,
        )

        base_currency = Currency.objects.filter(
            organization=organization, is_base=True
        ).first()
        if not base_currency:
            raise ValidationError("No base currency configured. Set one currency as is_base=True.")

        excluded_set = set(int(x) for x in (excluded_account_ids or []))

        candidate_accounts = ChartOfAccount.objects.filter(
            organization=organization,
            is_active=True,
        ).exclude(currency=base_currency.code).exclude(currency__isnull=True)

        # Honour revaluation_required when set; otherwise let classification
        # drive (monetary/income-expense are revalued, non-monetary skipped).
        # Two reasons we check both: (1) revaluation_required is the historical
        # opt-in flag operators already set; (2) classification refines *how*.
        # If revaluation_required=True but classification=NON_MONETARY we still
        # skip — classification overrides because that's the IFRS truth.
        accounts = candidate_accounts.filter(revaluation_required=True)

        result_lines = []
        skipped = []
        total_gain = Decimal('0.00')
        total_loss = Decimal('0.00')
        revalued_base_total = Decimal('0.00')
        processed = 0

        for acc in accounts:
            classification = getattr(acc, 'monetary_classification', 'MONETARY')
            if acc.id in excluded_set:
                skipped.append({
                    'account_id': acc.id, 'code': acc.code, 'currency': acc.currency,
                    'reason': 'Operator excluded',
                })
                continue
            if classification == 'NON_MONETARY':
                skipped.append({
                    'account_id': acc.id, 'code': acc.code, 'currency': acc.currency,
                    'reason': 'Non-monetary (historical cost)',
                })
                continue

            cumulative_filter = dict(
                organization=organization,
                account=acc,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__transaction_date__date__lte=fiscal_period.end_date,
                journal_entry__scope=scope,
                amount_currency__isnull=False,
            )
            fc_balance = JournalEntryLine.objects.filter(**cumulative_filter).aggregate(
                total_fc=models.Sum('amount_currency')
            )
            balance_in_fc = fc_balance['total_fc'] or Decimal('0.00')
            if balance_in_fc == Decimal('0.00'):
                continue

            base_agg = JournalEntryLine.objects.filter(**cumulative_filter).aggregate(
                dr=models.Sum('debit'), cr=models.Sum('credit'),
            )
            old_base_amount = (base_agg['dr'] or Decimal('0.00')) - (base_agg['cr'] or Decimal('0.00'))

            rate_type = _classification_to_rate_type(classification)
            rate_obj = ExchangeRate.objects.filter(
                organization=organization,
                from_currency__code=acc.currency,
                to_currency=base_currency,
                effective_date__lte=fiscal_period.end_date,
                rate_type=rate_type,
            ).order_by('-effective_date').first()
            rate_used_label = rate_type
            if not rate_obj:
                # Fallback: any available rate type.
                rate_obj = ExchangeRate.objects.filter(
                    organization=organization,
                    from_currency__code=acc.currency,
                    to_currency=base_currency,
                    effective_date__lte=fiscal_period.end_date,
                ).order_by('-effective_date').first()
                if rate_obj:
                    rate_used_label = 'SPOT'
            if not rate_obj:
                skipped.append({
                    'account_id': acc.id, 'code': acc.code, 'currency': acc.currency,
                    'reason': f'No {rate_type} or fallback rate available',
                })
                continue

            new_rate = Decimal(rate_obj.rate)
            new_base_amount = (balance_in_fc * new_rate).quantize(Decimal('0.01'))
            difference = (new_base_amount - old_base_amount).quantize(Decimal('0.01'))
            old_rate = (Decimal('1') if old_base_amount == Decimal('0')
                        else (old_base_amount / balance_in_fc))

            line_data = {
                'account_id': acc.id, 'account_code': acc.code, 'account_name': acc.name,
                'currency_id': rate_obj.from_currency_id,
                'currency_code': acc.currency,
                'classification': classification,
                'balance_in_currency': balance_in_fc,
                'old_rate': old_rate, 'new_rate': new_rate,
                'old_base_amount': old_base_amount,
                'new_base_amount': new_base_amount,
                'difference': difference,
                'rate_type_used': rate_used_label,
            }
            result_lines.append(line_data)
            revalued_base_total += abs(new_base_amount)
            if difference > 0:
                total_gain += difference
            elif difference < 0:
                total_loss += abs(difference)
            processed += 1

        net_impact = total_gain - total_loss
        materiality_pct = (
            (abs(net_impact) / revalued_base_total * Decimal('100')).quantize(Decimal('0.0001'))
            if revalued_base_total > 0 else Decimal('0.0000')
        )
        threshold = _get_materiality_threshold(organization)
        requires_approval = (materiality_pct >= threshold) and not force_post

        if dry_run:
            return {
                'lines': result_lines,
                'skipped': skipped,
                'total_gain': total_gain, 'total_loss': total_loss,
                'net_impact': net_impact,
                'revalued_base_total': revalued_base_total,
                'materiality_pct': materiality_pct,
                'materiality_threshold': threshold,
                'requires_approval': requires_approval,
                'excluded_account_ids': sorted(excluded_set),
                'accounts_processed': processed,
            }

        # ── Persist ──────────────────────────────────────────────────────
        with transaction.atomic():
            reval = CurrencyRevaluation.objects.create(
                organization=organization,
                fiscal_period=fiscal_period,
                revaluation_date=fiscal_period.end_date,
                scope=scope,
                created_by=user,
                total_gain=total_gain,
                total_loss=total_loss,
                net_impact=net_impact,
                accounts_processed=processed,
                materiality_pct=materiality_pct,
                excluded_account_ids=sorted(excluded_set),
                auto_reverse_at_period_start=auto_reverse,
                status='PENDING_APPROVAL' if requires_approval else 'DRAFT',
            )
            # Persist per-account lines (always — same audit shape as preview).
            for ln in result_lines:
                CurrencyRevaluationLine.objects.create(
                    organization=organization,
                    revaluation=reval,
                    account_id=ln['account_id'],
                    currency_id=ln['currency_id'],
                    balance_in_currency=ln['balance_in_currency'],
                    old_rate=ln['old_rate'], new_rate=ln['new_rate'],
                    old_base_amount=ln['old_base_amount'],
                    new_base_amount=ln['new_base_amount'],
                    difference=ln['difference'],
                    rate_type_used=ln['rate_type_used'],
                    classification=ln['classification'],
                )

            if not requires_approval:
                # Supersede any prior POSTED revaluation for the same period+scope
                # before posting the new JE. Without this, re-running for the
                # same period would leave TWO posted reval JEs in effect — the
                # books would double-count the FX gain/loss. The old reval
                # status flips to REVERSED, its JE is_superseded=True linked to
                # the new JE.
                RevaluationService._supersede_prior_revaluations(reval)
                je = RevaluationService._build_journal_entry(reval, user=user)
                reval.journal_entry = je
                reval.status = 'POSTED'
                reval.save(update_fields=['journal_entry', 'status'])
                # Backfill superseded_by once the new JE exists.
                if je is not None:
                    RevaluationService._link_superseded_to_new_je(reval, je)

        logger.info(
            f"RevaluationService: period={fiscal_period.name} processed={processed} "
            f"net={net_impact} mat={materiality_pct}% status={reval.status}"
        )
        return reval

    # ────────────────────────────────────────────────────────────────────
    # JOURNAL ENTRY BUILDER (shared by run + approve)
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def _supersede_prior_revaluations(new_reval):
        """Mark any prior POSTED revaluation for the same (org, period, scope)
        as REVERSED with its JE flagged ``is_superseded=True``. Run BEFORE the
        new JE is built so the dedup-key is freed up; ``superseded_by`` is
        backfilled by ``_link_superseded_to_new_je`` once the new JE exists.

        Idempotent — does nothing if no prior posted reval is found.
        """
        from apps.finance.models import CurrencyRevaluation, JournalEntry

        prior_qs = CurrencyRevaluation.objects.filter(
            organization=new_reval.organization,
            fiscal_period=new_reval.fiscal_period,
            scope=new_reval.scope,
            status='POSTED',
        ).exclude(pk=new_reval.pk).select_related('journal_entry')

        for prior in prior_qs:
            if prior.journal_entry_id:
                JournalEntry.objects.filter(pk=prior.journal_entry_id).update(
                    is_superseded=True,
                )
            prior.status = 'REVERSED'
            prior.save(update_fields=['status'])

    @staticmethod
    def _link_superseded_to_new_je(new_reval, new_je):
        """Backfill ``superseded_by=new_je`` on any JE we just superseded for
        this period. Called after the new JE exists so the FK can resolve."""
        from apps.finance.models import CurrencyRevaluation, JournalEntry

        prior_je_ids = list(
            CurrencyRevaluation.objects.filter(
                organization=new_reval.organization,
                fiscal_period=new_reval.fiscal_period,
                scope=new_reval.scope,
                status='REVERSED',
            ).exclude(pk=new_reval.pk)
            .exclude(journal_entry__isnull=True)
            .values_list('journal_entry_id', flat=True)
        )
        if prior_je_ids:
            JournalEntry.objects.filter(
                pk__in=prior_je_ids, is_superseded=True,
            ).update(superseded_by=new_je)

    @staticmethod
    def _build_journal_entry(revaluation, user=None):
        from apps.finance.models import (
            ChartOfAccount, CurrencyRevaluationLine,
        )
        from apps.finance.services.ledger_core import LedgerCoreMixin
        from erp.services import ConfigurationService

        lines_qs = CurrencyRevaluationLine.objects.filter(revaluation=revaluation)
        posting_lines = []
        total_gain = Decimal('0.00')
        total_loss = Decimal('0.00')

        for ln in lines_qs:
            if ln.difference == 0:
                continue
            if ln.difference > 0:
                posting_lines.append({
                    'account_id': ln.account_id,
                    'debit': ln.difference, 'credit': Decimal('0.00'),
                    'description': f"FX Reval: {ln.account.code} ({ln.currency.code}) gain",
                })
                total_gain += ln.difference
            else:
                posting_lines.append({
                    'account_id': ln.account_id,
                    'debit': Decimal('0.00'), 'credit': abs(ln.difference),
                    'description': f"FX Reval: {ln.account.code} ({ln.currency.code}) loss",
                })
                total_loss += abs(ln.difference)

        if not posting_lines:
            return None

        rules = ConfigurationService.get_posting_rules(revaluation.organization)
        fx_gain_id = rules.get('fx', {}).get('unrealized_gain')
        fx_loss_id = rules.get('fx', {}).get('unrealized_loss')
        if not fx_gain_id:
            fx_gain_acc = ChartOfAccount.objects.filter(
                organization=revaluation.organization, system_role='FX_GAIN',
                is_active=True, allow_posting=True,
            ).order_by('code').first()
            fx_gain_id = fx_gain_acc.id if fx_gain_acc else None
        if not fx_loss_id:
            fx_loss_acc = ChartOfAccount.objects.filter(
                organization=revaluation.organization, system_role='FX_LOSS',
                is_active=True, allow_posting=True,
            ).order_by('code').first()
            fx_loss_id = fx_loss_acc.id if fx_loss_acc else None
        if (total_gain > 0 and not fx_gain_id) or (total_loss > 0 and not fx_loss_id):
            raise ValidationError(
                "FX_GAIN / FX_LOSS account is not configured. Either set posting "
                "rules fx.unrealized_gain / fx.unrealized_loss, or tag a COA "
                "account with system_role='FX_GAIN' / 'FX_LOSS'."
            )

        if total_gain > 0:
            posting_lines.append({
                'account_id': fx_gain_id, 'debit': Decimal('0.00'),
                'credit': total_gain, 'description': 'Unrealized FX gain',
            })
        if total_loss > 0:
            posting_lines.append({
                'account_id': fx_loss_id, 'debit': total_loss,
                'credit': Decimal('0.00'), 'description': 'Unrealized FX loss',
            })

        je = LedgerCoreMixin.create_journal_entry(
            organization=revaluation.organization,
            transaction_date=revaluation.fiscal_period.end_date,
            description=f"FX Revaluation: {revaluation.fiscal_period.name}",
            lines=posting_lines,
            status='POSTED',
            scope=revaluation.scope,
            user=user,
            journal_type='ADJUSTMENT',
            source_module='finance',
            source_model='CurrencyRevaluation',
            source_id=revaluation.id,
            internal_bypass=True,
        )
        return je

    # ────────────────────────────────────────────────────────────────────
    # LEGACY HELPER — kept for callers outside the new flow
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def get_rate(organization, from_code, to_code, date, rate_type='SPOT'):
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
        if rate_type != 'SPOT':
            return RevaluationService.get_rate(organization, from_code, to_code, date, 'SPOT')
        return None
