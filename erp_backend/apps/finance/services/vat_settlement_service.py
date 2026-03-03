"""
VAT Settlement Service
======================
Handles the periodic (monthly) settlement of:
  - TVA Collectée  (collected from clients, held as liability)
  - TVA Récupérable (paid to suppliers, held as asset)

2-Step Settlement (V2.2 production approach):
  Step 1 — Netting entry (close TVA Collectée + TVA Récupérable into VAT control account)
  Step 2 — Payment entry (post separately when DGI is physically paid / physically pays us)

Step 1 — net_due > 0 (we owe DGI):
  DR TVA Collectée        (total collected)
    CR TVA Récupérable    (total recoverable)
    CR VAT Payable        (net due to DGI)

Step 1 — net_due < 0 (DGI owes us a refund):
  DR TVA Collectée        (total collected)
  DR VAT Refund Receivable (abs net credit)
    CR TVA Récupérable    (total recoverable)

Step 2 (manual journal posted by accountant when cash moves):
  Payment:   DR VAT Payable     / CR Bank
  Refund in: DR Bank            / CR VAT Refund Receivable

Posting rule keys used:
  purchases.vat_recoverable  — TVA Récupérable account
  sales.vat_collected        — TVA Collectée account
  tax.vat_payable            — VAT Payable control account (netting)
  tax.vat_refund_receivable  — VAT Refund Receivable asset account

Notes:
  - INTERNAL-scope transactions never post to VAT accounts (scope guard upstream),
    so they are implicitly excluded from settlement calculations.
  - Rounding: net_due is rounded to 0.01 after summing all line amounts.
"""
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum


class VATSettlementService:

    @staticmethod
    def calculate_settlement(organization, period_start, period_end):
        """
        Calculates the TVA position for the given period WITHOUT posting any entry.

        Returns a dict:
          {
            'vat_collected':    Decimal,
            'vat_recoverable':  Decimal,
            'net_due':          Decimal,   # > 0 = we owe DGI | < 0 = DGI owes us
            'period':           str,
            'sales_tax_account':     int | None,
            'purchases_tax_account': int | None,
          }
        """
        from apps.finance.models import JournalEntryLine
        from erp.services import ConfigurationService

        rules = ConfigurationService.get_posting_rules(organization)
        sales_tax_coa_id = rules.get('sales', {}).get('vat_collected')
        purchases_tax_coa_id = rules.get('purchases', {}).get('vat_recoverable')

        if not sales_tax_coa_id or not purchases_tax_coa_id:
            raise ValidationError(
                "Cannot calculate VAT settlement: 'sales.vat_collected' (TVA Collectée) and/or "
                "'purchases.vat_recoverable' (TVA Récupérable) accounts not configured in "
                "Finance → Posting Rules."
            )

        # TVA Collectée: credits on the sales VAT account in the period
        collected_qs = JournalEntryLine.objects.filter(
            organization=organization,
            account_id=sales_tax_coa_id,
            journal_entry__status='POSTED',
            journal_entry__transaction_date__range=[period_start, period_end],
        ).aggregate(total_credit=Sum('credit'), total_debit=Sum('debit'))

        vat_collected = (collected_qs['total_credit'] or Decimal('0')) - (collected_qs['total_debit'] or Decimal('0'))

        # TVA Récupérable: debits on the purchases VAT account in the period
        recoverable_qs = JournalEntryLine.objects.filter(
            organization=organization,
            account_id=purchases_tax_coa_id,
            journal_entry__status='POSTED',
            journal_entry__transaction_date__range=[period_start, period_end],
        ).aggregate(total_debit=Sum('debit'), total_credit=Sum('credit'))

        vat_recoverable = (recoverable_qs['total_debit'] or Decimal('0')) - (recoverable_qs['total_credit'] or Decimal('0'))

        net_due = vat_collected - vat_recoverable

        return {
            'vat_collected': vat_collected.quantize(Decimal('0.01')),
            'vat_recoverable': vat_recoverable.quantize(Decimal('0.01')),
            'net_due': net_due.quantize(Decimal('0.01')),
            'period': f"{period_start} to {period_end}",
            'sales_tax_account': sales_tax_coa_id,
            'purchases_tax_account': purchases_tax_coa_id,
        }

    @staticmethod
    def post_settlement(organization, period_start, period_end, user=None):
        """
        Posts Step 1 of the 2-step VAT settlement:
          the netting journal entry that clears TVA Collectée + TVA Récupérable
          into the VAT Payable or VAT Refund Receivable control account.

        Step 2 (cash movement) is a separate manual journal entry posted by the
        accountant when payment is actually made to / received from DGI.

        Required posting rules:
          tax.vat_payable           — for net_due > 0
          tax.vat_refund_receivable — for net_due < 0

        Raises ValidationError if:
          - No TVA movements found for the period
          - Required control account not configured
        """
        from apps.finance.services.ledger_service import LedgerService
        from django.utils import timezone

        with transaction.atomic():
            report = VATSettlementService.calculate_settlement(organization, period_start, period_end)

            vat_collected = report['vat_collected']
            vat_recoverable = report['vat_recoverable']
            net_due = report['net_due']

            from erp.services import ConfigurationService
            posting_rules = ConfigurationService.get_posting_rules(organization)
            vat_payable_acc = posting_rules.get('tax', {}).get('vat_payable')
            vat_refund_receivable_acc = posting_rules.get('tax', {}).get('vat_refund_receivable')

            if vat_collected == Decimal('0') and vat_recoverable == Decimal('0'):
                raise ValidationError(
                    f"No TVA movements found for period {report['period']}. Nothing to settle."
                )

            sales_tax_acc = report['sales_tax_account']
            purchases_tax_acc = report['purchases_tax_account']

            lines = []

            # Clear TVA Collectée (DR to zero out the liability)
            if vat_collected > Decimal('0'):
                lines.append({
                    'account_id': sales_tax_acc,
                    'debit': vat_collected,
                    'credit': Decimal('0'),
                    'description': 'TVA Collectée — Settlement netting'
                })

            # Clear TVA Récupérable (CR to zero out the asset)
            if vat_recoverable > Decimal('0'):
                lines.append({
                    'account_id': purchases_tax_acc,
                    'debit': Decimal('0'),
                    'credit': vat_recoverable,
                    'description': 'TVA Récupérable — Settlement netting'
                })

            # Net into control account (no bank movement — Step 2 is separate)
            if net_due > Decimal('0'):
                # We owe DGI → credit VAT Payable
                if not vat_payable_acc:
                    raise ValidationError(
                        "Cannot post VAT settlement: 'tax.vat_payable' account not configured in "
                        "Finance → Posting Rules. This is required for the netting entry."
                    )
                lines.append({
                    'account_id': vat_payable_acc,
                    'debit': Decimal('0'),
                    'credit': net_due,
                    'description': f'VAT Payable to DGI — Period {report["period"]}'
                })

            elif net_due < Decimal('0'):
                # DGI owes us → DR VAT Refund Receivable
                if not vat_refund_receivable_acc:
                    raise ValidationError(
                        "Cannot post VAT refund: 'tax.vat_refund_receivable' account not configured in "
                        "Finance → Posting Rules."
                    )
                lines.append({
                    'account_id': vat_refund_receivable_acc,
                    'debit': abs(net_due),
                    'credit': Decimal('0'),
                    'description': f'VAT Refund Receivable from DGI — Period {report["period"]}'
                })

            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=(
                    f"TVA Settlement (Step 1: Netting) — {report['period']} | "
                    f"Collectée: {vat_collected} | Récupérable: {vat_recoverable} | Net: {net_due}"
                ),
                reference=f"VAT-SETTLEMENT-{period_start}",
                status='POSTED',
                scope='OFFICIAL',
                user=user,
                lines=lines,
                internal_bypass=True
            )

            return {
                'journal_entry_id': entry.id,
                'report': report,
                'next_step': (
                    'Post Step 2 manually: DR VAT Payable / CR Bank when paying DGI, '
                    'or DR Bank / CR VAT Refund Receivable when DGI refund is received.'
                    if net_due != Decimal('0') else 'Net = 0, no payment step required.'
                )
            }
