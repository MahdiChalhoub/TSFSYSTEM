"""
VAT Settlement Service
======================
Handles the periodic (monthly) settlement of:
  - TVA Collectée  (collected from clients, held as liability)
  - TVA Récupérable (paid to suppliers, held as asset)

At end of period, posts the net DGI payment entry:
  DR TVA Collectée   → clear the liability
  CR TVA Récupérable → clear the asset
  CR/DR Bank         → net amount paid to / refunded from DGI

Usage:
    report = VATSettlementService.calculate_settlement(org, '2026-01-01', '2026-01-31')
    entry  = VATSettlementService.post_settlement(org, '2026-01-01', '2026-01-31', bank_account_id=5, user=request.user)
"""
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum, F


class VATSettlementService:

    @staticmethod
    def calculate_settlement(organization, period_start, period_end):
        """
        Calculates the TVA position for the given period WITHOUT posting any entry.

        Returns a dict:
          {
            'vat_collected':    Decimal,   # TVA Collectée (credits posted to sales.tax account)
            'vat_recoverable':  Decimal,   # TVA Récupérable (debits posted to purchases.tax account)
            'net_due':          Decimal,   # > 0 = we owe DGI | < 0 = DGI owes us
            'period':           str,
          }
        """
        from apps.finance.models import JournalEntryLine, ChartOfAccount
        from erp.services import ConfigurationService

        rules = ConfigurationService.get_posting_rules(organization)
        sales_tax_coa_id = rules.get('sales', {}).get('tax')
        purchases_tax_coa_id = rules.get('purchases', {}).get('tax')

        if not sales_tax_coa_id or not purchases_tax_coa_id:
            raise ValidationError(
                "Cannot calculate VAT settlement: 'sales.tax' (TVA Collectée) and/or "
                "'purchases.tax' (TVA Récupérable) accounts not configured in Finance → Posting Rules."
            )

        # TVA Collectée: credits on the sales.tax account in the period
        collected_qs = JournalEntryLine.objects.filter(
            organization=organization,
            account_id=sales_tax_coa_id,
            journal_entry__status='POSTED',
            journal_entry__transaction_date__range=[period_start, period_end],
        ).aggregate(total_credit=Sum('credit'), total_debit=Sum('debit'))

        vat_collected = (collected_qs['total_credit'] or Decimal('0')) - (collected_qs['total_debit'] or Decimal('0'))

        # TVA Récupérable: debits on the purchases.tax account in the period
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
    def post_settlement(organization, period_start, period_end, bank_account_id, user=None):
        """
        Posts the period-end DGI settlement journal entry.

        If net_due > 0 (we owe DGI):
          DR TVA Collectée      (net_collected)
          CR TVA Récupérable    (net_recoverable)
          CR Bank / DGI Payable (net_due)

        If net_due < 0 (DGI owes us a refund):
          DR TVA Collectée      (net_collected)
          DR Bank / DGI Refund  (abs(net_due))
          CR TVA Récupérable    (net_recoverable)
        """
        from apps.finance.services.ledger_service import LedgerService
        from django.utils import timezone

        with transaction.atomic():
            report = VATSettlementService.calculate_settlement(organization, period_start, period_end)

            vat_collected = report['vat_collected']
            vat_recoverable = report['vat_recoverable']
            net_due = report['net_due']

            if vat_collected == Decimal('0') and vat_recoverable == Decimal('0'):
                raise ValidationError(
                    f"No TVA movements found for period {report['period']}. Nothing to settle."
                )

            sales_tax_acc = report['sales_tax_account']
            purchases_tax_acc = report['purchases_tax_account']

            lines = []

            # Clear TVA Collectée (debit the liability to zero it out)
            if vat_collected > Decimal('0'):
                lines.append({
                    'account_id': sales_tax_acc,
                    'debit': vat_collected,
                    'credit': Decimal('0'),
                    'description': 'TVA Collectée — Settlement clearing'
                })

            # Clear TVA Récupérable (credit the asset to zero it out)
            if vat_recoverable > Decimal('0'):
                lines.append({
                    'account_id': purchases_tax_acc,
                    'debit': Decimal('0'),
                    'credit': vat_recoverable,
                    'description': 'TVA Récupérable — Settlement clearing'
                })

            # Net cash movement
            if net_due > Decimal('0'):
                # We owe DGI → credit bank
                lines.append({
                    'account_id': bank_account_id,
                    'debit': Decimal('0'),
                    'credit': net_due,
                    'description': f'Net TVA payment to DGI — Period {report["period"]}'
                })
            elif net_due < Decimal('0'):
                # DGI owes us → debit bank (refund receivable)
                lines.append({
                    'account_id': bank_account_id,
                    'debit': abs(net_due),
                    'credit': Decimal('0'),
                    'description': f'Net TVA refund from DGI — Period {report["period"]}'
                })

            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=(
                    f"TVA Settlement — {report['period']} | "
                    f"Collectée: {vat_collected} | Récupérable: {vat_recoverable} | Net due: {net_due}"
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
            }
