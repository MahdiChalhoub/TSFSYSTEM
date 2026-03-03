"""
AIRSI Remittance Service
========================
Handles the periodic settlement of AIRSI Payable to the DGI.

When a purchase is made from an AIRSI-subject supplier, the purchase_service
withholds AIRSI from the AP payment and credits 'purchases.airsi_payable'.
This service posts the remittance when the company physically pays DGI:

  DR AIRSI Payable    (amount withheld in the period)
    CR Bank           (cash paid to DGI)

Typically done monthly, matching the AIRSI reporting calendar.

Posting rule keys used:
  purchases.airsi_payable  — AIRSI Payable liability account
  (bank_account_id)        — passed explicitly by caller
"""
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum


class AIRSIRemittanceService:

    @staticmethod
    def calculate_airsi_payable(organization, period_start, period_end):
        """
        Sums the AIRSI Payable balance for a given period without posting.

        Returns a dict:
          {
            'airsi_withheld':      Decimal,   # credits on airsi_payable in the period
            'airsi_paid':          Decimal,   # any debits already posted (prior remittances)
            'airsi_net_payable':   Decimal,   # withheld - already paid
            'period':              str,
            'airsi_payable_account': int | None,
          }
        """
        from apps.finance.models import JournalEntryLine
        from erp.services import ConfigurationService

        rules = ConfigurationService.get_posting_rules(organization)
        airsi_payable_acc = rules.get('purchases', {}).get('airsi_payable')

        if not airsi_payable_acc:
            raise ValidationError(
                "Cannot calculate AIRSI remittance: 'purchases.airsi_payable' account not configured "
                "in Finance → Posting Rules."
            )

        qs = JournalEntryLine.objects.filter(
            organization=organization,
            account_id=airsi_payable_acc,
            journal_entry__status='POSTED',
            journal_entry__transaction_date__range=[period_start, period_end],
        ).aggregate(total_credit=Sum('credit'), total_debit=Sum('debit'))

        airsi_withheld = qs['total_credit'] or Decimal('0')
        airsi_paid = qs['total_debit'] or Decimal('0')
        net = airsi_withheld - airsi_paid

        return {
            'airsi_withheld': airsi_withheld.quantize(Decimal('0.01')),
            'airsi_paid': airsi_paid.quantize(Decimal('0.01')),
            'airsi_net_payable': net.quantize(Decimal('0.01')),
            'period': f"{period_start} to {period_end}",
            'airsi_payable_account': airsi_payable_acc,
        }

    @staticmethod
    def post_remittance(organization, period_start, period_end, bank_account_id, amount=None, user=None):
        """
        Posts the AIRSI remittance journal entry:

          DR AIRSI Payable    (amount)
            CR Bank           (amount)

        If amount is None, uses the net payable from calculate_airsi_payable.
        If amount is provided, it overrides the calculated amount (for partial remittances).

        Raises ValidationError if:
          - No AIRSI payable account configured
          - No AIRSI balance to remit
          - Amount exceeds net payable balance
        """
        from apps.finance.services.ledger_service import LedgerService
        from django.utils import timezone

        with transaction.atomic():
            report = AIRSIRemittanceService.calculate_airsi_payable(
                organization, period_start, period_end
            )
            net_payable = report['airsi_net_payable']
            airsi_payable_acc = report['airsi_payable_account']

            if net_payable <= Decimal('0'):
                raise ValidationError(
                    f"No AIRSI balance to remit for period {report['period']}. "
                    f"Net payable: {net_payable}"
                )

            remit_amount = Decimal(str(amount)) if amount is not None else net_payable
            remit_amount = remit_amount.quantize(Decimal('0.01'))

            if remit_amount > net_payable:
                raise ValidationError(
                    f"Remittance amount ({remit_amount}) exceeds net AIRSI payable "
                    f"({net_payable}) for period {report['period']}."
                )

            from erp.services import ConfigurationService
            posting_rules = ConfigurationService.get_posting_rules(organization)

            lines = [
                {
                    'account_id': airsi_payable_acc,
                    'debit': remit_amount,
                    'credit': Decimal('0'),
                    'description': f'AIRSI Remittance to DGI — Period {report["period"]}'
                },
                {
                    'account_id': bank_account_id,
                    'debit': Decimal('0'),
                    'credit': remit_amount,
                    'description': f'AIRSI Remittance paid — Period {report["period"]}'
                },
            ]

            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=(
                    f"AIRSI Remittance — {report['period']} | Amount: {remit_amount}"
                ),
                reference=f"AIRSI-REMITTANCE-{period_start}",
                status='POSTED',
                scope='OFFICIAL',
                user=user,
                lines=lines,
                internal_bypass=True
            )

            return {
                'journal_entry_id': entry.id,
                'amount_remitted': remit_amount,
                'report': report,
            }
