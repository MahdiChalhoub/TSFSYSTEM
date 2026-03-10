"""
SalesAccountingPoster — Gap 2 (ERP Roadmap)
============================================
Automatic journal-entry generation for each Order workflow transition.

Transitions handled:
  post_confirmation()  → On ORDER_CONFIRMED: Dr A/R, Cr Revenue, Cr VAT Payable
  post_delivery()      → On DELIVERED:       Dr COGS, Cr Inventory
  post_payment()       → On PAID (CREDIT):   Dr Cash/Bank, Cr A/R
  post_return()        → On RETURN:          Full reversal of confirmation + re-stock COGS

All COA accounts are resolved dynamically from posting rules.
"""
from decimal import Decimal
import logging
from django.core.exceptions import ValidationError

logger = logging.getLogger('erp.sales_accounting')


def _resolve_accounts(organization):
    """
    Resolve all required COA account IDs from posting rules.
    Returns a dict with resolved IDs. Raises ValidationError for missing critical rules.
    """
    from erp.services import ConfigurationService
    rules = ConfigurationService.get_posting_rules(organization)

    sales = rules.get('sales', {})
    purchases = rules.get('purchases', {})
    tax = rules.get('tax', {})

    resolved = {
        'AR':            sales.get('receivable'),
        'REVENUE':       sales.get('revenue'),
        'VAT_PAYABLE':   sales.get('vat_collected') or tax.get('vat_payable'),
        'COGS':          sales.get('cogs'),
        'INVENTORY':     sales.get('inventory'),
        'AIRSI_PAYABLE': purchases.get('airsi_payable'),
    }
    return resolved


def _resolve_payment_account(organization, payment_method):
    """
    Resolve the cash/bank ledger account for a given payment method.
    Uses the organization's financial accounts and posting rules.
    """
    from erp.services import ConfigurationService
    from apps.finance.models import FinancialAccount

    method_upper = (payment_method or 'CASH').upper()

    # CREDIT method → use A/R (receivable)
    if method_upper == 'CREDIT':
        rules = ConfigurationService.get_posting_rules(organization)
        return rules.get('sales', {}).get('receivable')

    # Try to match a financial account by name/type
    type_map = {
        'CASH': 'CASH',
        'BANK': 'BANK',
        'WAVE': 'MOBILE',
        'ORANGE_MONEY': 'MOBILE',
        'MTN_MOBILE': 'MOBILE',
        'MOBILE': 'MOBILE',
    }
    account_type = type_map.get(method_upper, 'CASH')

    fa = FinancialAccount.objects.filter(
        organization=organization, type=account_type
    ).first()
    if fa and fa.ledger_account_id:
        return fa.ledger_account_id

    # Ultimate fallback: use first available financial account
    fa = FinancialAccount.objects.filter(
        organization=organization, ledger_account_id__isnull=False
    ).first()
    return fa.ledger_account_id if fa else None


class SalesAccountingPoster:
    """
    Stateless service. All methods are class methods.
    All COA accounts are resolved dynamically from posting rules.
    """

    @classmethod
    def post_confirmation(cls, order, user=None) -> bool:
        """
        On ORDER_CONFIRMED / checkout:

        Official scope only (INTERNAL orders use TTC cost — no customer AR posting):
          Dr  A/R (Receivable)        ← total_amount (TTC)
            Cr  Revenue (HT)            ← subtotal_ht
            Cr  VAT Payable             ← tax_amount
            Cr  AIRSI Payable           ← sum of airsi_withheld per line (if any)

        If INTERNAL scope: skip (cost handled via inventory deduction at checkout).
        """
        if not order or order.scope != 'OFFICIAL':
            return False

        organization = order.organization
        try:
            from apps.finance.services.ledger_service import LedgerService
            from django.utils import timezone

            accounts = _resolve_accounts(organization)

            total_ttc  = Decimal(str(order.total_amount  or '0'))
            tax_amt    = Decimal(str(order.tax_amount   or '0'))
            subtotal_ht = (total_ttc - tax_amt).quantize(Decimal('0.01'))

            # AIRSI: sum per line
            airsi_total = Decimal('0')
            try:
                from django.db.models import Sum as _Sum
                airsi_total = order.lines.aggregate(t=_Sum('airsi_withheld'))['t'] or Decimal('0')
            except Exception:
                pass

            if total_ttc <= Decimal('0'):
                return False

            ar_id       = accounts['AR']
            revenue_id  = accounts['REVENUE']
            vat_id      = accounts['VAT_PAYABLE']
            airsi_id    = accounts['AIRSI_PAYABLE'] if airsi_total else None

            if not ar_id:
                raise ValidationError(
                    "Cannot post order confirmation: 'Accounts Receivable' not configured in posting rules. "
                    "Go to Finance → Settings → Posting Rules."
                )
            if not revenue_id:
                raise ValidationError(
                    "Cannot post order confirmation: 'Revenue' account not configured in posting rules. "
                    "Go to Finance → Settings → Posting Rules."
                )

            lines = [
                # Dr A/R for full TTC
                {'account_id': ar_id,
                 'debit': total_ttc, 'credit': Decimal('0'),
                 'description': f"A/R — {order.invoice_number or order.ref_code}",
                 'contact_id': order.contact_id},
                # Cr Revenue (HT)
                {'account_id': revenue_id,
                 'debit': Decimal('0'), 'credit': subtotal_ht,
                 'description': f"Revenue HT — {order.invoice_number or order.ref_code}"},
            ]

            # Cr VAT Payable
            if vat_id and tax_amt > Decimal('0'):
                lines.append({'account_id': vat_id,
                               'debit': Decimal('0'), 'credit': tax_amt,
                               'description': f"VAT collected — {order.invoice_number or order.ref_code}"})
            elif tax_amt > Decimal('0'):
                # No VAT account — fold into revenue to balance
                lines[1]['credit'] += tax_amt
                logger.warning(f"[SalesAccountingPoster] VAT account missing — VAT folded into revenue for order {order.id}")

            # Cr AIRSI Payable
            if airsi_id and airsi_total > Decimal('0'):
                lines.append({'account_id': airsi_id,
                               'debit': Decimal('0'), 'credit': airsi_total,
                               'description': f"AIRSI collected — {order.invoice_number or order.ref_code}"})

            # Balance check
            cls._ensure_balance(lines)

            ref = f"CONF-{order.invoice_number or order.id}-{order.scope}"
            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=order.confirmed_at or timezone.now(),
                description=f"Sale confirmed — {order.invoice_number or order.ref_code}",
                lines=lines,
                reference=ref,
                status='POSTED',
                scope=order.scope,
                site_id=order.site_id,
                user=user,
                internal_bypass=True,
            )
            cls._store_je_ref(order, 'confirmation_ref', ref)
            logger.info(f"[SalesAccountingPoster] Confirmation JE posted for order {order.id}: {ref}")
            return True

        except ValidationError:
            raise  # Let validation errors propagate — these are configuration issues
        except Exception as exc:
            logger.error(f"[SalesAccountingPoster] post_confirmation failed for order {order.id}: {exc}", exc_info=True)
            return False

    @classmethod
    def post_delivery_cogs(cls, order, user=None) -> bool:
        """
        On DELIVERED:
          Dr  COGS             ← sum of effective_cost × qty per line
            Cr  Inventory        ← same amount
        """
        organization = order.organization
        try:
            from apps.finance.services.ledger_service import LedgerService
            from django.utils import timezone
            from django.db.models import F, Sum as _Sum, ExpressionWrapper
            from django.db.models import DecimalField as _DjDecF

            accounts = _resolve_accounts(organization)

            cost_expr = ExpressionWrapper(F('effective_cost') * F('quantity'), output_field=_DjDecF(max_digits=18, decimal_places=4))
            cogs_total = (
                order.lines.filter(effective_cost__isnull=False)
                .aggregate(t=_Sum(cost_expr))['t'] or Decimal('0')
            )
            cogs_total = Decimal(str(cogs_total)).quantize(Decimal('0.01'))

            if cogs_total <= Decimal('0'):
                return False

            cogs_id  = accounts['COGS']
            inv_id   = accounts['INVENTORY']

            if not cogs_id:
                raise ValidationError(
                    "Cannot post delivery COGS: 'COGS' account not configured in posting rules. "
                    "Go to Finance → Settings → Posting Rules."
                )
            if not inv_id:
                raise ValidationError(
                    "Cannot post delivery COGS: 'Inventory Assets' account not configured in posting rules. "
                    "Go to Finance → Settings → Posting Rules."
                )

            ref = f"COGS-{order.invoice_number or order.id}"
            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=order.delivered_at or timezone.now(),
                description=f"COGS delivery — {order.invoice_number or order.ref_code}",
                lines=[
                    {'account_id': cogs_id,  'debit': cogs_total, 'credit': Decimal('0'),
                     'description': f"COGS — {order.invoice_number or order.ref_code}"},
                    {'account_id': inv_id,   'debit': Decimal('0'), 'credit': cogs_total,
                     'description': f"Inventory relief — {order.invoice_number or order.ref_code}"},
                ],
                reference=ref,
                status='POSTED',
                scope=order.scope,
                site_id=order.site_id,
                user=user,
                internal_bypass=True,
            )
            cls._store_je_ref(order, 'cogs_ref', ref)
            logger.info(f"[SalesAccountingPoster] COGS JE posted for order {order.id}: {ref}")
            return True

        except ValidationError:
            raise
        except Exception as exc:
            logger.error(f"[SalesAccountingPoster] post_delivery_cogs failed for order {order.id}: {exc}", exc_info=True)
            return False

    @classmethod
    def post_payment(cls, order, user=None) -> bool:
        """
        On PAID (cash/mobile reconciliation):
          Dr  Cash/Mobile/Bank   ← amount paid
            Cr  A/R                ← clears receivable

        Skipped for non-CREDIT orders (cash was already received at checkout).
        """
        organization = order.organization
        try:
            if order.payment_method == 'CREDIT' and order.scope == 'OFFICIAL':
                from apps.finance.services.ledger_service import LedgerService
                from django.utils import timezone

                accounts = _resolve_accounts(organization)

                amount = Decimal(str(order.total_amount or '0'))
                ar_id = accounts['AR']

                if not ar_id:
                    raise ValidationError(
                        "Cannot post payment: 'Accounts Receivable' not configured in posting rules. "
                        "Go to Finance → Settings → Posting Rules."
                    )

                cash_id = _resolve_payment_account(organization, order.payment_method)
                if not cash_id:
                    raise ValidationError(
                        "Cannot post payment: No cash/bank financial account found. "
                        "Create a Cash or Bank financial account first."
                    )

                ref = f"PAY-{order.invoice_number or order.id}"
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=timezone.now(),
                    description=f"Payment received — {order.invoice_number or order.ref_code}",
                    lines=[
                        {'account_id': cash_id, 'debit': amount, 'credit': Decimal('0'),
                         'description': f"Payment {order.payment_method}"},
                        {'account_id': ar_id,   'debit': Decimal('0'), 'credit': amount,
                         'description': f"A/R cleared — {order.invoice_number or order.ref_code}"},
                    ],
                    reference=ref,
                    status='POSTED',
                    scope=order.scope,
                    site_id=order.site_id,
                    user=user,
                    internal_bypass=True,
                )
                logger.info(f"[SalesAccountingPoster] Payment JE posted for order {order.id}: {ref}")
            return True

        except ValidationError:
            raise
        except Exception as exc:
            logger.error(f"[SalesAccountingPoster] post_payment failed for order {order.id}: {exc}", exc_info=True)
            return False

    @classmethod
    def post_return(cls, order, user=None) -> bool:
        """
        On RETURN / CANCELLED (after confirmation):
        Reverse the confirmation journal entry using LedgerService.reverse_journal_entry().
        If the COGS journal was posted, reverse that too (re-stocks inventory).
        """
        organization = order.organization
        try:
            from apps.finance.services.ledger_service import LedgerService
            from apps.finance.models import JournalEntry

            conf_ref  = cls._load_je_ref(order, 'confirmation_ref')
            cogs_ref  = cls._load_je_ref(order, 'cogs_ref')

            reversed_any = False
            for ref in [conf_ref, cogs_ref]:
                if not ref:
                    continue
                try:
                    je = JournalEntry.objects.filter(
                        organization=organization,
                        reference=ref,
                        status='POSTED'
                    ).first()
                    if je:
                        LedgerService.reverse_journal_entry(organization, je.id, user=user)
                        reversed_any = True
                        logger.info(f"[SalesAccountingPoster] Reversed JE {ref} for order {order.id}")
                except Exception as rev_exc:
                    logger.error(f"[SalesAccountingPoster] Reversal of {ref} failed: {rev_exc}")

            return reversed_any

        except Exception as exc:
            logger.error(f"[SalesAccountingPoster] post_return failed for order {order.id}: {exc}", exc_info=True)
            return False

    # ── Internal helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _ensure_balance(lines: list) -> None:
        """
        Adjusts the last credit line by the debit/credit imbalance to guarantee
        the entry is balanced. Accepts rounding differences up to 1 unit.
        """
        total_dr = sum(Decimal(str(l['debit']))  for l in lines)
        total_cr = sum(Decimal(str(l['credit'])) for l in lines)
        diff = total_dr - total_cr
        if abs(diff) > Decimal('0') and abs(diff) <= Decimal('1'):
            for l in reversed(lines):
                if l['credit'] > Decimal('0'):
                    l['credit'] = Decimal(str(l['credit'])) + diff
                    break

    @staticmethod
    def _store_je_ref(order, key: str, ref: str) -> None:
        """Persist JE reference on order.extra_data for later reversal lookup."""
        try:
            extra = order.extra_data or {}
            extra.setdefault('je_refs', {})[key] = ref
            type(order).objects.filter(pk=order.pk).update(extra_data=extra)
        except Exception:
            pass  # Field might not exist yet — soft failure

    @staticmethod
    def _load_je_ref(order, key: str):
        """Load JE reference from order.extra_data."""
        try:
            extra = order.extra_data or {}
            return extra.get('je_refs', {}).get(key)
        except Exception:
            return None
