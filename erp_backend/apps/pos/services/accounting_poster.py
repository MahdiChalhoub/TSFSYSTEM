"""
SalesAccountingPoster — Gap 2 (ERP Roadmap)
============================================
Automatic journal-entry generation for each Order workflow transition.

Transitions handled:
  post_confirmation()  → On ORDER_CONFIRMED: Dr A/R, Cr Revenue, Cr VAT Payable
  post_delivery()      → On DELIVERED:       Dr COGS, Cr Inventory
  post_payment()       → On PAID (CREDIT):   Dr Cash/Bank, Cr A/R
  post_return()        → On RETURN:          Full reversal of confirmation + re-stock COGS

All postings are wrapped in try/except so they NEVER block workflow transitions.
Call them from SalesWorkflowService._log() or action methods.

SYSCOHADA GL Account Codes:
  411  Clients (Accounts Receivable)
  701  Ventes de marchandises (Revenue — COGS items)
  443  TVA facturée sur ventes (VAT Payable)
  601  Achats / Coût des marchandises vendues (COGS)
  311  Marchandises (Inventory)
  521  Banque / Caisse (Cash/Bank — resolved from payment method)
"""
from decimal import Decimal
import logging

logger = logging.getLogger('erp.sales_accounting')

# ── SYSCOHADA code registry ────────────────────────────────────────────────────
# All codes below must exist in ChartOfAccount for the org (applied via COA template).
_COA = {
    'AR':            '411',   # Accounts Receivable — Clients
    'REVENUE':       '701',   # Ventes de marchandises HT
    'VAT_PAYABLE':   '443',   # TVA collectée sur ventes
    'COGS':          '601',   # Coût des marchandises vendues
    'INVENTORY':     '311',   # Marchandises en stock
    'CASH':          '571',   # Caisse (cash drawer)
    'BANK':          '521',   # Banque
    'MOBILE':        '562',   # Portefeuille mobile (Wave, Orange Money)
    'AIRSI_PAYABLE': '447',   # AIRSI collecté à reverser
}

# Payment method → COA code
_PM_TO_COA = {
    'CASH':         '571',
    'WAVE':         '562',
    'ORANGE_MONEY': '562',
    'MTN_MOBILE':   '562',
    'MOBILE':       '562',
    'BANK':         '521',
    'CREDIT':       '411',   # On credit → stays in A/R until reconciled
}


def _get_account(organization, code: str):
    """Return ChartOfAccount for this org by code. Returns None if not found."""
    from apps.finance.models import ChartOfAccount
    return ChartOfAccount.objects.filter(
        organization=organization, code=code, is_active=True
    ).first()


def _acc_id(organization, code: str):
    """Return account.id or None."""
    acc = _get_account(organization, code)
    return acc.id if acc else None


class SalesAccountingPoster:
    """
    Stateless service. All methods are class methods.
    Each method is independently safe — exceptions are logged, never re-raised.
    """

    @classmethod
    def post_confirmation(cls, order, user=None) -> bool:
        """
        On ORDER_CONFIRMED / checkout:

        Official scope only (INTERNAL orders use TTC cost — no customer AR posting):
          Dr  411 Clients (A/R)       ← total_amount (TTC)
            Cr  701 Ventes HT           ← subtotal_ht
            Cr  443 TVA facturée         ← tax_amount
            Cr  447 AIRSI collecté       ← sum of airsi_withheld per line (if any)

        If INTERNAL scope: skip (cost handled via inventory deduction at checkout).
        """
        if not order or order.scope != 'OFFICIAL':
            return False

        organization = order.organization
        try:
            from apps.finance.services.ledger_service import LedgerService
            from apps.finance.services.base_services import SequenceService
            from django.utils import timezone

            total_ttc  = Decimal(str(order.total_amount  or '0'))
            tax_amt    = Decimal(str(order.tax_amount   or '0'))
            # HT = TTC - VAT  (Order has no subtotal_ht field)
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

            ar_id       = _acc_id(organization, _COA['AR'])
            revenue_id  = _acc_id(organization, _COA['REVENUE'])
            vat_id      = _acc_id(organization, _COA['VAT_PAYABLE'])
            airsi_id    = _acc_id(organization, _COA['AIRSI_PAYABLE']) if airsi_total else None

            if not ar_id or not revenue_id:
                logger.warning(
                    f"[SalesAccountingPoster] Skipping confirmation posting for order {order.id}: "
                    f"411 or 701 account not found in COA."
                )
                return False

            lines = [
                # Dr A/R for full TTC
                {'account_id': ar_id,
                 'debit': total_ttc, 'credit': Decimal('0'),
                 'description': f"A/R — {order.invoice_number or order.ref_code}",
                 'contact_id': order.contact_id},
                # Cr Revenue (HT)
                {'account_id': revenue_id,
                 'debit': Decimal('0'), 'credit': subtotal_ht,
                 'description': f"Ventes HT — {order.invoice_number or order.ref_code}"},
            ]

            # Cr VAT Payable
            if vat_id and tax_amt > Decimal('0'):
                lines.append({'account_id': vat_id,
                               'debit': Decimal('0'), 'credit': tax_amt,
                               'description': f"TVA collectée — {order.invoice_number or order.ref_code}"})
            elif tax_amt > Decimal('0'):
                # No VAT account — add to revenue credit to balance
                lines[1]['credit'] += tax_amt
                logger.warning(f"[SalesAccountingPoster] 443 account missing — VAT folded into revenue for order {order.id}")

            # Cr AIRSI Payable
            if airsi_id and airsi_total > Decimal('0'):
                lines.append({'account_id': airsi_id,
                               'debit': Decimal('0'), 'credit': airsi_total,
                               'description': f"AIRSI collecté — {order.invoice_number or order.ref_code}"})

            # Balance check — top up or trim last credit line to guarantee balance
            cls._ensure_balance(lines)

            ref = f"CONF-{order.invoice_number or order.id}-{order.scope}"
            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=order.confirmed_at or timezone.now(),
                description=f"Vente confirmée — {order.invoice_number or order.ref_code}",
                lines=lines,
                reference=ref,
                status='POSTED',
                scope=order.scope,
                site_id=order.site_id,
                user=user,
                internal_bypass=True,
            )
            # Store reference on order for later reversal
            cls._store_je_ref(order, 'confirmation_ref', ref)
            logger.info(f"[SalesAccountingPoster] Confirmation JE posted for order {order.id}: {ref}")
            return True

        except Exception as exc:
            logger.error(f"[SalesAccountingPoster] post_confirmation failed for order {order.id}: {exc}", exc_info=True)
            return False

    @classmethod
    def post_delivery_cogs(cls, order, user=None) -> bool:
        """
        On DELIVERED:
          Dr  601 COGS           ← sum of effective_cost × qty per line
            Cr  311 Inventory      ← same amount

        Already partially handled by workflow_service._post_cogs_on_delivery().
        This version uses the same pattern but via LedgerService for consistency.
        """
        organization = order.organization
        try:
            from apps.finance.services.ledger_service import LedgerService
            from django.utils import timezone
            from django.db.models import F, Sum as _Sum, ExpressionWrapper
            from django.db.models import DecimalField as _DjDecF

            cost_expr = ExpressionWrapper(F('effective_cost') * F('quantity'), output_field=_DjDecF(max_digits=18, decimal_places=4))
            cogs_total = (
                order.lines.filter(effective_cost__isnull=False)
                .aggregate(t=_Sum(cost_expr))['t'] or Decimal('0')
            )
            cogs_total = Decimal(str(cogs_total)).quantize(Decimal('0.01'))

            if cogs_total <= Decimal('0'):
                return False

            cogs_id  = _acc_id(organization, _COA['COGS'])
            inv_id   = _acc_id(organization, _COA['INVENTORY'])
            if not cogs_id or not inv_id:
                logger.warning(f"[SalesAccountingPoster] 601 or 311 missing — COGS posting skipped for order {order.id}")
                return False

            ref = f"COGS-{order.invoice_number or order.id}"
            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=order.delivered_at or timezone.now(),
                description=f"COGS livraison — {order.invoice_number or order.ref_code}",
                lines=[
                    {'account_id': cogs_id,  'debit': cogs_total, 'credit': Decimal('0'),
                     'description': f"COGS — {order.invoice_number or order.ref_code}"},
                    {'account_id': inv_id,   'debit': Decimal('0'), 'credit': cogs_total,
                     'description': f"Sortie stock — {order.invoice_number or order.ref_code}"},
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

        except Exception as exc:
            logger.error(f"[SalesAccountingPoster] post_delivery_cogs failed for order {order.id}: {exc}", exc_info=True)
            return False

    @classmethod
    def post_payment(cls, order, user=None) -> bool:
        """
        On PAID (cash/mobile reconciliation):
          Dr  571/562/521 Cash/Mobile/Bank   ← amount paid
            Cr  411 A/R                        ← clears receivable

        Skipped for non-CREDIT orders (cash was already received at checkout
        — the A/R entry clears immediately via confirmation line swap).
        """
        organization = order.organization
        try:
            if order.payment_method == 'CREDIT' and order.scope == 'OFFICIAL':
                from apps.finance.services.ledger_service import LedgerService
                from django.utils import timezone

                amount = Decimal(str(order.total_amount or '0'))
                pm_code = _PM_TO_COA.get((order.payment_method or '').upper(), _COA['CASH'])
                cash_id = _acc_id(organization, pm_code)
                ar_id   = _acc_id(organization, _COA['AR'])
                if not cash_id or not ar_id:
                    return False

                ref = f"PAY-{order.invoice_number or order.id}"
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=timezone.now(),
                    description=f"Encaissement — {order.invoice_number or order.ref_code}",
                    lines=[
                        {'account_id': cash_id, 'debit': amount, 'credit': Decimal('0'),
                         'description': f"Encaissement {order.payment_method}"},
                        {'account_id': ar_id,   'debit': Decimal('0'), 'credit': amount,
                         'description': f"Apurement A/R — {order.invoice_number or order.ref_code}"},
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
            # Find last credit line and adjust
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
