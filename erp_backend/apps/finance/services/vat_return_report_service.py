"""
VATReturnReportService
======================
Generates a comprehensive VAT return report for a given period,
aggregating from OrderLineTaxEntry (the transactional tax ledger).

Uses explicit subqueries via OrderLine / Order IDs rather than ORM
relations, since order_line_id is stored as a plain IntegerField.

Report sections:
    1. VAT on Sales     (TVA Collectée)
    2. VAT on Purchases (TVA Récupérable) — recoverable portion only
    3. AIRSI Withheld   (from purchase lines)
    4. Purchase Tax     (from purchase lines)
    5. Reverse Charge   (from purchase lines)
    6. Net VAT Position (1 - 2)
    7. Period Accruals  (from PeriodicTaxAccrual)

Usage:
    from apps.finance.services.vat_return_report_service import VATReturnReportService
    report = VATReturnReportService.run(org, '2026-01-01', '2026-01-31')
"""
from decimal import Decimal
from django.db.models import Sum


class VATReturnReportService:

    @staticmethod
    def run(organization, period_start, period_end):
        """
        Build the full VAT return report for the period.
        Returns a dict serializable to JSON.
        """
        from erp.connector_registry import connector
        Order = connector.require('pos.orders.get_model', org_id=0, source='finance')
        OrderLine = connector.require('pos.order_lines.get_model', org_id=0, source='finance')
        OrderLineTaxEntry = connector.require('pos.order_lines.get_tax_entry_model', org_id=0, source='finance')
        if not Order:
            raise ValueError('POS module is required.')
        from apps.finance.models import PeriodicTaxAccrual

        # ── Resolve completed order IDs in the period ──────────────────
        sale_order_ids = list(Order.objects.filter(
            organization=organization,
            type='SALE',
            status='COMPLETED',
            created_at__date__range=[period_start, period_end],
        ).values_list('id', flat=True))

        purchase_order_ids = list(Order.objects.filter(
            organization=organization,
            type='PURCHASE',
            status='COMPLETED',
            created_at__date__range=[period_start, period_end],
        ).values_list('id', flat=True))

        # ── Get relevant OrderLine IDs ─────────────────────────────────
        sale_line_ids = list(
            OrderLine.objects.filter(order_id__in=sale_order_ids)
            .values_list('id', flat=True)
        )
        purchase_line_ids = list(
            OrderLine.objects.filter(order_id__in=purchase_order_ids)
            .values_list('id', flat=True)
        )

        def _sum(org, line_ids, tx_type, tax_type):
            """Aggregate base + amount + cost_impact for given criteria."""
            if not line_ids:
                return {'base': Decimal('0'), 'tax': Decimal('0'), 'cost_impact': Decimal('0')}
            qs = OrderLineTaxEntry.objects.filter(
                organization=org,
                order_line_id__in=line_ids,
                transaction_type=tx_type,
                tax_type=tax_type,
            ).aggregate(
                base=Sum('base_amount'),
                tax=Sum('amount'),
                cost_impact=Sum('cost_impact_amount'),
            )
            return {
                'base':        qs['base']        or Decimal('0'),
                'tax':         qs['tax']         or Decimal('0'),
                'cost_impact': qs['cost_impact'] or Decimal('0'),
            }

        # ── Section 1: VAT on Sales ────────────────────────────────────
        s1 = _sum(organization, sale_line_ids, 'SALE', 'VAT')
        vat_collected = {
            'base_ht':       float(s1['base']),
            'vat_collected': float(s1['tax']),
        }

        # ── Section 2: VAT on Purchases (recoverable) ─────────────────
        s2 = _sum(organization, purchase_line_ids, 'PURCHASE', 'VAT')
        total_purchase_vat = float(s2['tax'])
        non_recov_vat      = float(s2['cost_impact'])
        vat_recoverable = {
            'base_ht':              float(s2['base']),
            'vat_total':            total_purchase_vat,
            'vat_non_recoverable':  non_recov_vat,
            'vat_recoverable':      round(total_purchase_vat - non_recov_vat, 2),
        }

        # ── Section 3: AIRSI ──────────────────────────────────────────
        s3 = _sum(organization, purchase_line_ids, 'PURCHASE', 'AIRSI')
        airsi_summary = {
            'base':           float(s3['base']),
            'airsi_withheld': float(s3['tax']),
        }

        # ── Section 4: Purchase Tax ────────────────────────────────────
        s4 = _sum(organization, purchase_line_ids, 'PURCHASE', 'PURCHASE_TAX')
        purchase_tax_summary = {
            'base':             float(s4['base']),
            'purchase_tax_due': float(s4['tax']),
        }

        # ── Section 5: Reverse Charge ──────────────────────────────────
        s5 = _sum(organization, purchase_line_ids, 'PURCHASE', 'VAT_REVERSE_CHARGE')
        reverse_charge_summary = {
            'base':               float(s5['base']),
            'reverse_charge_vat': float(s5['tax']),
        }

        # ── Section 6: Net VAT Position ────────────────────────────────
        net_vat = round(
            vat_collected['vat_collected'] - vat_recoverable['vat_recoverable'],
            2
        )

        # ── Section 7: Periodic Accruals ───────────────────────────────
        accruals = list(
            PeriodicTaxAccrual.objects.filter(
                organization=organization,
                period_start__gte=period_start,
                period_end__lte=period_end,
                status='POSTED',
            ).values('tax_type', 'base_amount', 'accrual_amount', 'policy_name')
        )
        for a in accruals:
            a['base_amount']    = float(a['base_amount'])
            a['accrual_amount'] = float(a['accrual_amount'])

        return {
            'period':   f'{period_start} to {period_end}',
            'currency': 'XOF',

            # Core VAT
            'vat_on_sales':      vat_collected,
            'vat_on_purchases':  vat_recoverable,
            'net_vat_due':       net_vat,
            'net_vat_direction': 'PAYABLE' if net_vat >= 0 else 'REFUND',

            # Other taxes
            'airsi':             airsi_summary,
            'purchase_tax':      purchase_tax_summary,
            'reverse_charge':    reverse_charge_summary,

            # Period accruals
            'periodic_accruals': accruals,

            # Grand total
            'total_tax_due': round(
                max(net_vat, 0)
                + airsi_summary['airsi_withheld']
                + purchase_tax_summary['purchase_tax_due'],
                2
            ),
        }
