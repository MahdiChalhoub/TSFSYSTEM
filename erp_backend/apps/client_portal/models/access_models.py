import uuid
from django.db import models
from erp.models import TenantModel

class ClientPortalAccess(TenantModel):
    PERMISSION_CHOICES = (
        ('VIEW_ORDER_HISTORY', 'View Order History'),
        ('PLACE_ORDERS', 'Place eCommerce Orders'),
        ('VIEW_WALLET', 'View Wallet & Loyalty'),
        ('REDEEM_LOYALTY', 'Redeem Loyalty Points'),
        ('SUBMIT_TICKETS', 'Submit Support Tickets'),
        ('VIEW_CATALOG', 'Browse Product Catalog'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending Verification'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('REVOKED', 'Revoked'),
    )

    contact = models.OneToOneField(
        'crm.Contact', on_delete=models.CASCADE,
        related_name='client_portal_access',
        limit_choices_to={'type': 'CUSTOMER'},
    )
    user = models.OneToOneField('erp.User', on_delete=models.CASCADE, related_name='client_access')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    permissions = models.JSONField(default=list, blank=True)
    granted_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='client_accesses_granted',
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)
    barcode = models.CharField(max_length=50, unique=True, null=True, blank=True)

    class Meta:
        db_table = 'client_portal_access'
        verbose_name_plural = 'Client Portal Accesses'

    def __str__(self):
        return f"ClientAccess: {self.contact} → {self.user}"

    def has_permission(self, perm_code):
        return perm_code in (self.permissions or [])

    def generate_barcode(self):
        if not self.barcode:
            self.barcode = f"CLT-{uuid.uuid4().hex[:10].upper()}"
            self.save(update_fields=['barcode'])
        return self.barcode
