"""
Finance Module Signals
======================
Event-driven signal handlers for:
  - Payment lifecycle and balance updates
  - PaymentAllocation → Invoice auto-status (Gap 6)
  - Invoice → JournalEntry auto-posting (Gap 11)
  - reference.OrgCurrency → finance.Currency auto-mirror (single source of truth)
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# reference.OrgCurrency → finance.Currency MIRROR
# =============================================================================
# Why: /settings/regional manages OrgCurrency (the user-facing "which
# currencies do we use" toggle + base flag). The finance app uses its own
# apps.finance.Currency model for ExchangeRate / Revaluation / RatePolicy
# FKs. Without this mirror, the FX tab can't see what's enabled in the
# Currencies tab — two parallel sources of truth. This signal keeps them
# in lockstep so /settings/regional remains the single source of truth.

def _mirror_org_currency_to_finance(instance):
    """Materialize / update the matching apps.finance.Currency row. Idempotent."""
    from apps.finance.models.currency_models import Currency as FinanceCurrency
    ref_ccy = instance.currency
    if not ref_ccy:
        return

    defaults = {
        'name': getattr(ref_ccy, 'name', ref_ccy.code),
        'symbol': getattr(ref_ccy, 'symbol', '') or ref_ccy.code,
        'decimal_places': getattr(ref_ccy, 'decimal_places', 2),
        'is_active': bool(instance.is_enabled),
        'is_base': bool(instance.is_default),
    }
    fin_ccy, created = FinanceCurrency.objects.update_or_create(
        organization=instance.organization,
        code=ref_ccy.code,
        defaults=defaults,
    )

    # Single-base invariant: demote any other base row when this becomes base.
    if fin_ccy.is_base:
        FinanceCurrency.objects.filter(
            organization=instance.organization, is_base=True,
        ).exclude(pk=fin_ccy.pk).update(is_base=False)

    if created:
        logger.info(
            f"[OrgCurrency→finance.Currency] Materialized {ref_ccy.code} "
            f"for {instance.organization} (is_base={fin_ccy.is_base})"
        )


@receiver(post_save, sender='reference.OrgCurrency')
def on_org_currency_saved(sender, instance, **kwargs):
    try:
        _mirror_org_currency_to_finance(instance)
    except Exception as e:
        logger.error(f"[OrgCurrency mirror] failed for {instance}: {e}")


@receiver(post_delete, sender='reference.OrgCurrency')
def on_org_currency_deleted(sender, instance, **kwargs):
    """
    Soft-deactivate the mirror when an org disables a currency. We don't
    hard-delete because ExchangeRate / JournalEntryLine PROTECT FKs would
    block it — deactivation is the right semantic (history preserved, new
    postings rejected via is_active).
    """
    try:
        from apps.finance.models.currency_models import Currency as FinanceCurrency
        ref_ccy = instance.currency
        if not ref_ccy:
            return
        FinanceCurrency.objects.filter(
            organization=instance.organization, code=ref_ccy.code,
        ).update(is_active=False)
    except Exception as e:
        logger.error(f"[OrgCurrency mirror] delete failed for {instance}: {e}")


# =============================================================================
# PAYMENT → VAT RELEASE (existing)
# =============================================================================

@receiver(post_save, sender='finance.Payment')
def handle_payment_posted(sender, instance, **kwargs):
    """
    Fires when a Payment is saved.
    - POSTED + SUPPLIER_PAYMENT + REAL company type → trigger cash-basis VAT release
    """
    if instance.status != 'POSTED':
        return

    if instance.type == 'SUPPLIER_PAYMENT':
        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(instance.organization)
            company_type = settings.get('companyType', 'REGULAR')
            declare_tva = settings.get('declareTVA', False)

            if company_type == 'REAL' and declare_tva:
                from apps.finance.payment_service import PaymentService
                PaymentService.release_vat_on_payment(
                    organization=instance.organization,
                    payment=instance
                )
                logger.info(f"[SIGNAL] Cash-basis VAT released for payment #{instance.id}")
        except Exception as e:
            logger.error(f"[SIGNAL] Failed cash-basis VAT release: {e}")

    elif instance.type == 'CUSTOMER_RECEIPT':
        logger.info(f"[SIGNAL] Customer receipt #{instance.id} posted — balance updated by service")


# =============================================================================
# GAP 6 FIX: PaymentAllocation → Invoice Auto-Status
# When a payment is allocated to an invoice, auto-update invoice status
# =============================================================================

@receiver(post_save, sender='finance.PaymentAllocation')
def handle_payment_allocation_created(sender, instance, created, **kwargs):
    """
    When a PaymentAllocation is saved, update the linked invoice's
    paid_amount and auto-transition status (PARTIAL_PAID → PAID).
    """
    if not created:
        return

    try:
        invoice = instance.invoice
        if invoice:
            invoice.record_payment(instance.allocated_amount)
            logger.info(
                f"[SIGNAL] Invoice {invoice.invoice_number} updated: "
                f"+{instance.allocated_amount} → status={invoice.status}"
            )

            # Also update CustomerBalance if it's a sales invoice
            if invoice.type == 'SALES' and invoice.contact_id:
                from apps.finance.payment_models import CustomerBalance
                bal, _ = CustomerBalance.objects.get_or_create(
                    organization=invoice.organization,
                    contact=invoice.contact,
                    defaults={'current_balance': 0}
                )
                bal.current_balance -= instance.allocated_amount
                from django.utils import timezone
                bal.last_payment_date = timezone.now().date()
                bal.save(update_fields=['current_balance', 'last_payment_date', 'updated_at'])

    except Exception as e:
        logger.error(f"[SIGNAL] Failed to update invoice on payment allocation: {e}")


# =============================================================================
# GAP 11 FIX: Invoice → JournalEntry Auto-Posting
# When an invoice transitions to SENT, create a GL journal entry
# =============================================================================

@receiver(post_save, sender='finance.Invoice')
def handle_invoice_gl_posting(sender, instance, **kwargs):
    """
    When an Invoice is saved with status SENT and no journal_entry yet,
    auto-create a JournalEntry (Debit AR / Credit Revenue for sales).
    """
    if instance.status != 'SENT' or instance.journal_entry_id:
        return

    try:
        from apps.finance.models import ChartOfAccount

        # Find AR and Revenue accounts
        ar_account = ChartOfAccount.objects.filter(
            organization=instance.organization,
            type='RECEIVABLE'
        ).first()
        revenue_account = ChartOfAccount.objects.filter(
            organization=instance.organization,
            type='REVENUE'
        ).first()

        if not ar_account or not revenue_account:
            logger.warning(
                f"[SIGNAL] Cannot auto-post invoice {instance.id}: "
                f"Missing AR or Revenue account in chart of accounts"
            )
            return

        # Create journal entry via canonical service (auto-links fiscal year/period)
        from django.utils import timezone
        from apps.finance.services.ledger_core import LedgerCoreMixin
        je = LedgerCoreMixin.create_journal_entry(
            organization=instance.organization,
            transaction_date=timezone.now(),
            description=f"Invoice {instance.invoice_number} to {instance.contact_name or 'N/A'}",
            reference=f"INV-{instance.invoice_number or instance.id}",
            lines=[
                {
                    'account_id': ar_account.id,
                    'debit': instance.total_amount, 'credit': 0,
                    'description': f"AR: Invoice {instance.invoice_number}",
                    'contact_id': instance.contact_id,
                },
                {
                    'account_id': revenue_account.id,
                    'debit': 0, 'credit': instance.total_amount,
                    'description': f"Revenue: Invoice {instance.invoice_number}",
                },
            ],
            status='POSTED',
            scope=instance.scope,
            source_module='finance',
            source_model='Invoice',
            source_id=instance.id,
        )

        # Link JE back to invoice
        instance.journal_entry = je
        instance.save(update_fields=['journal_entry'])

        # Update CustomerBalance (increase AR)
        if instance.type == 'SALES' and instance.contact_id:
            from apps.finance.payment_models import CustomerBalance
            bal, _ = CustomerBalance.objects.get_or_create(
                organization=instance.organization,
                contact=instance.contact,
                defaults={'current_balance': 0}
            )
            bal.current_balance += instance.total_amount
            bal.last_invoice_date = timezone.now().date()
            bal.save(update_fields=['current_balance', 'last_invoice_date', 'updated_at'])

        logger.info(
            f"[SIGNAL] Auto-posted JournalEntry #{je.id} for Invoice {instance.invoice_number}"
        )

    except Exception as e:
        logger.error(f"[SIGNAL] Failed to auto-post invoice GL: {e}")
