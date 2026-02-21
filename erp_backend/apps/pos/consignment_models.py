from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User

class ConsignmentSettlement(TenantModel):
    SETTLEMENT_STATUS = (
        ('PENDING', 'Pending Payment'),
        ('PARTIAL', 'Partially Paid'),
        ('PAID', 'Paid / Finalized'),
        ('CANCELLED', 'Cancelled'),
    )

    reference = models.CharField(max_length=100, unique=True, null=True, blank=True)
    supplier = models.ForeignKey('crm.Contact', on_delete=models.CASCADE, related_name='consignment_settlements')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=SETTLEMENT_STATUS, default='PENDING')
    
    notes = models.TextField(null=True, blank=True)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pos_consignment_settlement'
        ordering = ['-created_at']

    def __str__(self):
        return f"SETTLE-{self.id} for {self.supplier.name}"

    def update_total(self):
        """Recalculate total amount from lines."""
        self.total_amount = self.lines.aggregate(
            total=models.Sum('payout_amount')
        )['total'] or Decimal('0.00')
        self.save(update_fields=['total_amount'])


class ConsignmentSettlementLine(TenantModel):
    settlement = models.ForeignKey(ConsignmentSettlement, on_delete=models.CASCADE, related_name='lines')
    order_line = models.OneToOneField('pos.OrderLine', on_delete=models.CASCADE, related_name='consignment_settlement_link')
    
    payout_amount = models.DecimalField(max_digits=15, decimal_places=2)
    
    class Meta:
        db_table = 'pos_consignment_settlement_line'

    def __str__(self):
        return f"Line for {self.order_line.product.name} in {self.settlement.reference}"
