from decimal import Decimal
from django.db.models import Sum
from django.core.exceptions import ValidationError

class TaxService:
    @staticmethod
    def get_declared_report(organization, start_date, end_date):
        """
        Generates the 'Virtual Reclassification' Report for Mixed/Regular modes.
        """
        # Gated cross-module import
        try:
            from apps.pos.models import Order, OrderLine
        except ImportError:
            raise ValidationError("POS module is required for tax reports.")
        from erp.services import ConfigurationService
        from django.db.models import Sum
        
        settings = ConfigurationService.get_global_settings(organization)
        company_type = settings.get('companyType', 'REGULAR')
        
        if company_type == 'MICRO':
            sales = Order.objects.filter(
                organization=organization,
                type='SALE',
                scope='OFFICIAL',
                created_at__range=[start_date, end_date]
            ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
            
            micro_rate = Decimal(str(settings.get('microTaxPercentage', 0))) / 100
            tax_due = sales * micro_rate
            
            return {
                "type": "MICRO",
                "period": f"{start_date} to {end_date}",
                "sales_revenue": sales,
                "tax_due": tax_due,
                "note": f"Calculated at {micro_rate*100}% of Revenue"
            }
            
        else:
            purchase_lines = OrderLine.objects.filter(
                organization=organization,
                order__type='PURCHASE',
                order__scope='OFFICIAL',
                order__status__in=['COMPLETED', 'RECEIVED'],
                order__created_at__range=[start_date, end_date]
            )
            
            total_ht = Decimal('0')
            total_vat_recoverable = Decimal('0')
            total_ttc = Decimal('0')
            
            for line in purchase_lines:
                qty = line.quantity
                ht = line.unit_cost_ht * qty
                vat = line.vat_amount * qty
                ttc = line.total
                
                total_ht += ht
                total_vat_recoverable += vat
                total_ttc += ttc
                
            return {
                "type": "STANDARD_RECLASSIFIED",
                "period": f"{start_date} to {end_date}",
                "purchases_ht": total_ht,
                "vat_recoverable": total_vat_recoverable,
                "purchases_ttc_internal": total_ttc,
                "note": "Virtual Reclassification: Ledger=TTC, Report=HT+VAT"
            }
