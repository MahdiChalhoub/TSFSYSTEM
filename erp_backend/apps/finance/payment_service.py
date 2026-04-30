"""
Payment Service
===============
Business logic for supplier payments, customer receipts, aged reports,
and cash-basis VAT release.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


def _safe_import(module_path, names):
    try:
        mod = __import__(module_path, fromlist=names)
        return tuple(getattr(mod, n) for n in names)
    except ImportError:
        logger.warning(f"Module '{module_path}' not installed — import skipped")
        return tuple(None for _ in names)


class PaymentService:
    """Centralized payment processing for supplier and customer flows."""

    # ── Supplier Payments ────────────────────────────────────────────

    @staticmethod
    def record_supplier_payment(
        organization, contact_id, amount, payment_date,
        payment_account_id, method='CASH', description=None,
        supplier_invoice_id=None, scope='OFFICIAL', user=None,
        payment_amount_foreign=None, payment_rate=None,
    ):
        """
        Record a payment to a supplier.
        GL: Dr. Accounts Payable → Cr. Cash/Bank
        """
        from apps.finance.payment_models import Payment, SupplierBalance
        from erp.services import ConfigurationService

        (LedgerService, SequenceService) = _safe_import(
            'apps.finance.services', ['LedgerService', 'SequenceService']
        )

        with transaction.atomic():
            amount = Decimal(str(amount))
            if amount <= 0:
                raise ValidationError("Payment amount must be positive")

            ref = None
            if SequenceService:
                ref = SequenceService.get_next_number(organization, 'SUPPLIER_PAYMENT')

            payment = Payment.objects.create(
                organization=organization,
                type='SUPPLIER_PAYMENT',
                contact_id=contact_id,
                amount=amount,
                payment_date=payment_date,
                method=method,
                reference=ref,
                description=description,
                supplier_invoice_id=supplier_invoice_id,
                payment_account_id=payment_account_id,
                scope=scope,
                created_by=user,
                status='DRAFT'
            )

            # Post GL entry
            journal_entry = None
            if LedgerService:
                rules = ConfigurationService.get_posting_rules(organization)
                ap_acc = rules.get('purchases', {}).get('payable')

                from apps.finance.models import FinancialAccount
                fin_acc = FinancialAccount.objects.filter(
                    id=payment_account_id, organization=organization
                ).first()
                cash_acc = fin_acc.ledger_account_id if fin_acc else None

                if not ap_acc or not cash_acc:
                    raise ValidationError("Payment GL mapping missing: AP or Cash account not configured")

                journal_entry = LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=payment_date,
                    description=f"Supplier Payment: {description or ref}",
                    reference=f"PAY-{payment.id}",
                    status='POSTED',
                    scope=scope,
                    user=user,
                    lines=[
                        {"account_id": ap_acc, "debit": amount, "credit": Decimal('0'),
                         "description": "AP reduction"},
                        {"account_id": cash_acc, "debit": Decimal('0'), "credit": amount,
                         "description": "Cash/Bank outflow"},
                    ]
                )
                payment.journal_entry = journal_entry
                payment.status = 'POSTED'
                payment.save()

                # Realized FX variance — only when caller provided the foreign-
                # amount + payment-rate context AND there is a settled supplier
                # invoice to pin variance against. Skipped for cash/ad-hoc
                # payments that aren't settling an FC invoice.
                PaymentService._maybe_post_realized_fx(
                    invoice_id=supplier_invoice_id,
                    invoice_kind='supplier',
                    payment_amount_foreign=payment_amount_foreign,
                    payment_rate=payment_rate,
                    payment_date=payment_date,
                    user=user,
                )

            # Update running balance
            balance, _ = SupplierBalance.objects.get_or_create(
                organization=organization,
                contact_id=contact_id,
                defaults={'current_balance': Decimal('0')}
            )
            balance.current_balance -= amount
            balance.last_payment_date = payment_date
            balance.save()

            return payment

    # ── Customer Receipts ────────────────────────────────────────────

    @staticmethod
    def record_customer_receipt(
        organization, contact_id, amount, payment_date,
        payment_account_id, method='CASH', description=None,
        sales_order_id=None, scope='OFFICIAL', user=None,
        customer_invoice_id=None,
        payment_amount_foreign=None, payment_rate=None,
    ):
        """
        Record a receipt from a customer.
        GL: Dr. Cash/Bank → Cr. Accounts Receivable
        """
        from apps.finance.payment_models import Payment, CustomerBalance
        from erp.services import ConfigurationService

        (LedgerService, SequenceService) = _safe_import(
            'apps.finance.services', ['LedgerService', 'SequenceService']
        )

        with transaction.atomic():
            amount = Decimal(str(amount))
            if amount <= 0:
                raise ValidationError("Receipt amount must be positive")

            ref = None
            if SequenceService:
                ref = SequenceService.get_next_number(organization, 'CUSTOMER_RECEIPT')

            payment = Payment.objects.create(
                organization=organization,
                type='CUSTOMER_RECEIPT',
                contact_id=contact_id,
                amount=amount,
                payment_date=payment_date,
                method=method,
                reference=ref,
                description=description,
                sales_order_id=sales_order_id,
                payment_account_id=payment_account_id,
                scope=scope,
                created_by=user,
                status='DRAFT'
            )

            # Post GL entry
            journal_entry = None
            if LedgerService:
                rules = ConfigurationService.get_posting_rules(organization)
                ar_acc = rules.get('sales', {}).get('receivable')

                from apps.finance.models import FinancialAccount
                fin_acc = FinancialAccount.objects.filter(
                    id=payment_account_id, organization=organization
                ).first()
                cash_acc = fin_acc.ledger_account_id if fin_acc else None

                if not ar_acc or not cash_acc:
                    raise ValidationError("Receipt GL mapping missing: AR or Cash account not configured")

                journal_entry = LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=payment_date,
                    description=f"Customer Receipt: {description or ref}",
                    reference=f"REC-{payment.id}",
                    status='POSTED',
                    scope=scope,
                    user=user,
                    lines=[
                        {"account_id": cash_acc, "debit": amount, "credit": Decimal('0'),
                         "description": "Cash/Bank inflow"},
                        {"account_id": ar_acc, "debit": Decimal('0'), "credit": amount,
                         "description": "AR reduction"},
                    ]
                )
                payment.journal_entry = journal_entry
                payment.status = 'POSTED'
                payment.save()

                # Realized FX variance — only fires when caller supplies the
                # foreign-amount + rate context AND there's a settled customer
                # invoice. Plain CSAT cash receipts skip silently.
                PaymentService._maybe_post_realized_fx(
                    invoice_id=customer_invoice_id,
                    invoice_kind='customer',
                    payment_amount_foreign=payment_amount_foreign,
                    payment_rate=payment_rate,
                    payment_date=payment_date,
                    user=user,
                )

            # Update running balance
            balance, _ = CustomerBalance.objects.get_or_create(
                organization=organization,
                contact_id=contact_id,
                defaults={'current_balance': Decimal('0')}
            )
            balance.current_balance -= amount
            balance.last_payment_date = payment_date
            balance.save()

            return payment

    # ── Realized FX (called from supplier + customer payment posting) ─

    @staticmethod
    def _maybe_post_realized_fx(
        *, invoice_id, invoice_kind,
        payment_amount_foreign, payment_rate, payment_date, user,
    ):
        """Bridge from payment posting → RealizedFXService.

        Resolves the invoice row, sanity-checks the inputs, and posts the
        realized FX variance JE if there's anything to post. Failures are
        logged at WARNING and *do not* block the payment from posting —
        rather, the operator gets a flag in `realized_fx.check_integrity`
        for follow-up. Wrapping the variance in a hard exception would mean
        a missing rate could block a customer from paying their bill.
        """
        if not invoice_id or not payment_amount_foreign or not payment_rate:
            return  # caller didn't opt in — pure base-currency payment
        try:
            from apps.finance.services.realized_fx_service import RealizedFXService
            from apps.finance.invoice_models import Invoice  # supplier + customer share table
            invoice = Invoice.objects.filter(id=invoice_id).first()
            if not invoice:
                logger.warning(
                    f"_maybe_post_realized_fx: {invoice_kind} invoice {invoice_id} not found; "
                    "skipping realized FX."
                )
                return
            RealizedFXService.post_realized_variance(
                invoice=invoice,
                payment_amount_foreign=payment_amount_foreign,
                payment_rate=payment_rate,
                payment_date=payment_date,
                user=user,
            )
        except Exception as e:
            # Surfaced via realized-fx integrity check — see
            # RealizedFXService.check_realized_fx_integrity. Don't block the
            # payment.
            logger.warning(
                f"_maybe_post_realized_fx ({invoice_kind}, invoice={invoice_id}) failed: {e}"
            )

    # ── VAT Release (Cash-Basis) ─────────────────────────────────────

    @staticmethod
    def release_vat_on_payment(organization, payment, user=None):
        """
        For cash-basis VAT accounting: when a supplier payment is made,
        release the proportional VAT from suspense to payable.

        Only applies to REAL company type with declareTVA=True.
        """
        from erp.services import ConfigurationService

        settings = ConfigurationService.get_global_settings(organization)
        company_type = settings.get('companyType', 'REGULAR')
        declare_tva = settings.get('declareTVA', False)

        if company_type != 'REAL' or not declare_tva:
            return None  # No cash-basis VAT for this company type

        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])
        if not LedgerService:
            return None

        rules = ConfigurationService.get_posting_rules(organization)
        vat_suspense = rules.get('purchases', {}).get('vat_suspense')
        vat_payable = rules.get('purchases', {}).get('tax')

        if not vat_suspense or not vat_payable:
            return None

        # Calculate proportional VAT (simplified: assume tax is standard rate)
        from apps.finance.tax_calculator import TaxCalculator
        result = TaxCalculator.calculate_tax(
            payment.amount, Decimal(str(settings.get('default_tax_rate', '0.11'))), mode='TTC'
        )
        vat_amount = result['tax']

        if vat_amount <= 0:
            return None

        with transaction.atomic():
            return LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=payment.payment_date,
                description=f"VAT Release (Cash-Basis) — Payment {payment.reference}",
                reference=f"VAT-REL-{payment.id}",
                status='POSTED',
                scope=payment.scope,
                user=user,
                lines=[
                    {"account_id": vat_suspense, "debit": vat_amount, "credit": Decimal('0'),
                     "description": "VAT released from suspense"},
                    {"account_id": vat_payable, "debit": Decimal('0'), "credit": vat_amount,
                     "description": "VAT now payable"},
                ]
            )

    # ── Aged Reports ─────────────────────────────────────────────────

    @staticmethod
    def get_aged_receivables(organization):
        """
        Customer aging report: 0-30, 31-60, 61-90, 90+ days.
        Based on posted SALE orders that are not fully paid.
        """
        from apps.pos.models import Order
        from django.db.models import Sum, Q, F

        today = timezone.now().date()
        buckets = {
            'current': {'min': 0, 'max': 30, 'total': Decimal('0'), 'items': []},
            '31_60': {'min': 31, 'max': 60, 'total': Decimal('0'), 'items': []},
            '61_90': {'min': 61, 'max': 90, 'total': Decimal('0'), 'items': []},
            'over_90': {'min': 91, 'max': 9999, 'total': Decimal('0'), 'items': []},
        }

        orders = Order.objects.filter(
            organization=organization,
            type='SALE',
            status__in=['COMPLETED', 'INVOICED']
        ).select_related('contact')

        for order in orders:
            days = (today - order.created_at.date()).days
            remaining = order.total_amount - (
                order.payments_received.filter(status='POSTED').aggregate(
                    paid=Sum('amount'))['paid'] or Decimal('0')
            )
            if remaining <= 0:
                continue

            entry = {
                'order_id': order.id,
                'customer': order.contact.name if order.contact else 'Walk-in',
                'amount': float(remaining),
                'days': days,
                'date': str(order.created_at.date()),
            }

            for key, bucket in buckets.items():
                if bucket['min'] <= days <= bucket['max']:
                    bucket['total'] += remaining
                    bucket['items'].append(entry)
                    break

        return {k: {'total': float(v['total']), 'items': v['items']} for k, v in buckets.items()}

    @staticmethod
    def get_aged_payables(organization):
        """
        Supplier aging report: 0-30, 31-60, 61-90, 90+ days.
        Based on posted PURCHASE orders that are not fully paid.
        """
        from apps.pos.models import Order
        from django.db.models import Sum

        today = timezone.now().date()
        buckets = {
            'current': {'min': 0, 'max': 30, 'total': Decimal('0'), 'items': []},
            '31_60': {'min': 31, 'max': 60, 'total': Decimal('0'), 'items': []},
            '61_90': {'min': 61, 'max': 90, 'total': Decimal('0'), 'items': []},
            'over_90': {'min': 91, 'max': 9999, 'total': Decimal('0'), 'items': []},
        }

        orders = Order.objects.filter(
            organization=organization,
            type='PURCHASE',
            status__in=['COMPLETED', 'INVOICED']
        ).select_related('contact')

        for order in orders:
            days = (today - order.created_at.date()).days
            remaining = order.total_amount - (
                order.payments_made.filter(status='POSTED').aggregate(
                    paid=Sum('amount'))['paid'] or Decimal('0')
            )
            if remaining <= 0:
                continue

            entry = {
                'order_id': order.id,
                'supplier': order.contact.name if order.contact else 'Unknown',
                'amount': float(remaining),
                'days': days,
                'date': str(order.created_at.date()),
            }

            for key, bucket in buckets.items():
                if bucket['min'] <= days <= bucket['max']:
                    bucket['total'] += remaining
                    bucket['items'].append(entry)
                    break

        return {k: {'total': float(v['total']), 'items': v['items']} for k, v in buckets.items()}
