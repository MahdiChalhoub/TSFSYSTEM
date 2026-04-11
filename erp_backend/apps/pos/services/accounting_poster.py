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

═══════════════════════════════════════════════════════════════════════════════
  ARCHITECTURE NOTE (Phase 3A — Module Decoupling)
  ─────────────────────────────────────────────────
  This file NO LONGER imports from apps.finance directly.
  All finance operations go through ConnectorEngine:
    - COA code resolution      → finance owns the code maps
    - Journal entry creation   → finance owns ledger logic
    - Journal entry reversal   → finance owns reversal logic

  POS sends BUSINESS INTENT (e.g., "post a sale"), not low-level journal data.
  Finance decides which accounts to use internally.

  Ref: .ai/plans/module-decoupling-blueprint.md (Phase 3A)
═══════════════════════════════════════════════════════════════════════════════
"""
from decimal import Decimal
import logging

logger = logging.getLogger('erp.sales_accounting')


def _get_connector():
    """Get the ConnectorEngine singleton. Lazy import to avoid circular refs."""
    from erp.connector_engine import connector_engine
    return connector_engine


class SalesAccountingPoster:
    """
    Stateless service. All methods are class methods.
    Each method is independently safe — exceptions are logged, never re-raised.

    All finance operations are routed through ConnectorEngine.
    POS never directly imports finance models or services.
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

        try:
            from django.utils import timezone

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

            # ── Route to Finance via ConnectorEngine ──
            connector = _get_connector()
            result = connector.route_write(
                target_module='finance',
                endpoint='post_sale_transaction',
                data={
                    'organization_id': order.organization_id,
                    'order_id': order.id,
                    'total_ttc': str(total_ttc),
                    'subtotal_ht': str(subtotal_ht),
                    'tax_amount': str(tax_amt),
                    'airsi_amount': str(airsi_total),
                    'invoice_number': order.invoice_number or '',
                    'ref_code': order.ref_code or '',
                    'contact_id': order.contact_id,
                    'scope': order.scope,
                    'site_id': order.site_id,
                    'confirmed_at': str(order.confirmed_at or timezone.now()),
                    'user_id': user.id if user else None,
                },
                organization_id=order.organization_id,
                source_module='pos',
            )

            journal_ref = None
            if result and result.data:
                journal_ref = result.data.get('journal_ref') if isinstance(result.data, dict) else None

            if journal_ref:
                cls._store_je_ref(order, 'confirmation_ref', journal_ref)
                logger.info(f"[SalesAccountingPoster] Confirmation JE posted for order {order.id}: {journal_ref}")
                return True

            return False

        except Exception as exc:
            logger.error(f"[SalesAccountingPoster] post_confirmation failed for order {order.id}: {exc}", exc_info=True)
            return False

    @classmethod
    def post_delivery_cogs(cls, order, user=None) -> bool:
        """
        On DELIVERED:
          Dr  601 COGS           ← sum of effective_cost × qty per line
            Cr  311 Inventory      ← same amount
        """
        try:
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

            # ── Route to Finance via ConnectorEngine ──
            connector = _get_connector()
            result = connector.route_write(
                target_module='finance',
                endpoint='post_cogs_entry',
                data={
                    'organization_id': order.organization_id,
                    'order_id': order.id,
                    'cogs_total': str(cogs_total),
                    'invoice_number': order.invoice_number or '',
                    'ref_code': order.ref_code or '',
                    'scope': order.scope or 'OFFICIAL',
                    'site_id': order.site_id,
                    'delivered_at': str(order.delivered_at) if order.delivered_at else None,
                    'user_id': user.id if user else None,
                },
                organization_id=order.organization_id,
                source_module='pos',
            )

            journal_ref = None
            if result and result.data:
                journal_ref = result.data.get('journal_ref') if isinstance(result.data, dict) else None

            if journal_ref:
                cls._store_je_ref(order, 'cogs_ref', journal_ref)
                logger.info(f"[SalesAccountingPoster] COGS JE posted for order {order.id}: {journal_ref}")
                return True

            return False

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
        try:
            if order.payment_method == 'CREDIT' and order.scope == 'OFFICIAL':
                connector = _get_connector()
                result = connector.route_write(
                    target_module='finance',
                    endpoint='post_payment_receipt',
                    data={
                        'organization_id': order.organization_id,
                        'order_id': order.id,
                        'amount': str(order.total_amount or '0'),
                        'payment_method': order.payment_method or 'CASH',
                        'invoice_number': order.invoice_number or '',
                        'ref_code': order.ref_code or '',
                        'scope': order.scope,
                        'site_id': order.site_id,
                        'user_id': user.id if user else None,
                    },
                    organization_id=order.organization_id,
                    source_module='pos',
                )
                if result and result.data:
                    journal_ref = result.data.get('journal_ref') if isinstance(result.data, dict) else None
                    if journal_ref:
                        logger.info(f"[SalesAccountingPoster] Payment JE posted for order {order.id}: {journal_ref}")
            return True

        except Exception as exc:
            logger.error(f"[SalesAccountingPoster] post_payment failed for order {order.id}: {exc}", exc_info=True)
            return False

    @classmethod
    def post_return(cls, order, user=None) -> bool:
        """
        On RETURN / CANCELLED (after confirmation):
        Reverse the confirmation journal entry using finance connector.
        If the COGS journal was posted, reverse that too (re-stocks inventory).
        """
        try:
            connector = _get_connector()
            conf_ref  = cls._load_je_ref(order, 'confirmation_ref')
            cogs_ref  = cls._load_je_ref(order, 'cogs_ref')

            reversed_any = False
            for ref in [conf_ref, cogs_ref]:
                if not ref:
                    continue
                try:
                    result = connector.route_write(
                        target_module='finance',
                        endpoint='post_refund',
                        data={
                            'organization_id': order.organization_id,
                            'journal_ref': ref,
                            'user_id': user.id if user else None,
                        },
                        organization_id=order.organization_id,
                        source_module='pos',
                    )
                    if result and result.data:
                        success = result.data.get('success') if isinstance(result.data, dict) else False
                        if success:
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
