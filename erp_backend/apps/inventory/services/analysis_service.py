import math
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta

class AnalysisService:
    @staticmethod
    def get_purchase_suggestions(organization, days=None):
        from erp.services import ConfigurationService
        from apps.inventory.models import Product, Inventory, InventoryMovement

        if days is None:
            days = ConfigurationService.get_setting(organization, 'purchase_analysis_days', 30)
            
        cutoff = timezone.now() - timedelta(days=days)
        suggestions = []

        # 1. Calculate sales velocity per product
        sales_data = InventoryMovement.objects.filter(
            organization=organization,
            type='OUT',
            created_at__gte=cutoff
        ).values('product_id').annotate(
            total_sold=Sum('quantity')
        )
        velocity_map = {item['product_id']: Decimal(str(item['total_sold'])) / Decimal(str(days)) for item in sales_data}

        # 2. Analyze all active products
        products = Product.objects.filter(organization=organization, status='ACTIVE', is_active=True)
        
        for p in products:
            agg_stock = Inventory.objects.filter(product=p, organization=organization).aggregate(total=Sum('quantity'))['total']
            current_stock = Decimal(str(agg_stock or '0'))
            
            daily_velocity = velocity_map.get(p.id, Decimal('0'))
            safety_stock = Decimal(str(p.min_stock_level or 0))
            
            # Prediction: Stock needed for the next 14 days + safety stock
            expected_demand = daily_velocity * Decimal('14')
            target_stock = expected_demand + safety_stock
            
            if current_stock < target_stock:
                shortage = target_stock - current_stock
                suggested_qty = math.ceil(float(shortage))
                
                if suggested_qty > 0:
                    suggestions.append({
                        "product_id": p.id,
                        "product_name": p.name,
                        "sku": p.sku,
                        "current_stock": float(current_stock),
                        "daily_velocity": float(daily_velocity),
                        "suggested_qty": suggested_qty,
                        "priority": "HIGH" if current_stock < safety_stock else "MEDIUM",
                        "reason": "Low Stock" if current_stock < safety_stock else "Projected Demand"
                    })

        return sorted(suggestions, key=lambda x: (x['priority'] == 'HIGH', x['suggested_qty']), reverse=True)
