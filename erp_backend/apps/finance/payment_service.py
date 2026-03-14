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


# Connector Governance Layer
from erp.connector_registry import connector


class PaymentService:
    """Centralized payment processing for supplier and customer flows."""

    # ── Supplier Payments ────────────────────────────────────────────

    @staticmethod
    def record_supplier_payment(
        organization, contact_id, amount, payment_date,
        payment_account_id, method='CASH', description=None,
        supplier_invoice_id=None, scope='OFFICIAL', user=None
    ):
        """
        Record a payment to a supplier.
        GL: Dr. Accounts Payable → Cr. Cash/Bank
        """
        from apps.finance.payment_models import Payment, SupplierBalance
        from erp.services import ConfigurationService

        from apps.finance.services import LedgerService, SequenceService
        if not LedgerService or not SequenceService:
            raise ValidationError('Finance services unavailable.')

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

            # Post GL entry via dedicated service
            from apps.finance.services.posting_service import PaymentPostingService
            payment = PaymentPostingService.post_payment(payment, user=user)

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
        sales_order_id=None, scope='OFFICIAL', user=None
    ):
        """
        Record a receipt from a customer.
        GL: Dr. Cash/Bank → Cr. Accounts Receivable
        """
        from apps.finance.payment_models import Payment, CustomerBalance
        from erp.services import ConfigurationService

        from apps.finance.services import LedgerService, SequenceService
        if not LedgerService or not SequenceService:
            raise ValidationError('Finance services unavailable.')

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

            # Post GL entry via dedicated service
            from apps.finance.services.posting_service import PaymentPostingService
            payment = PaymentPostingService.post_payment(payment, user=user)

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

        from apps.finance.services import LedgerService
        if not LedgerService:
            return None

        rules = ConfigurationService.get_posting_rules(organization)
        vat_suspense = rules.get('purchases', {}).get('vat_suspense')
        vat_payable = rules.get('purchases', {}).get('tax')

        if not vat_suspense:
            raise ValidationError(
                "Cannot release cash-basis VAT: 'VAT Suspense' account not configured in posting rules. "
                "Go to Finance → Settings → Posting Rules."
            )
        if not vat_payable:
            raise ValidationError(
                "Cannot release cash-basis VAT: 'VAT Payable' account not configured in posting rules. "
                "Go to Finance → Settings → Posting Rules."
            )

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
        Order = connector.require('pos.orders.get_model', org_id=0, source='finance')
        if not Order:
            raise ValueError('POS module is required.')
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
        Order = connector.require('pos.orders.get_model', org_id=0, source='finance')
        if not Order:
            raise ValueError('POS module is required.')
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
