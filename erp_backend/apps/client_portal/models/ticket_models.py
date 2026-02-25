import uuid
from django.db import models
from django.utils import timezone
from erp.models import TenantModel

class ClientTicket(TenantModel):
    TICKET_TYPES = (
        ('GENERAL', 'General Inquiry'), ('ORDER_ISSUE', 'Order Issue'),
        ('DELIVERY_PROBLEM', 'Delivery Problem'), ('RETURN_REQUEST', 'Return Request'),
        ('PRODUCT_FEEDBACK', 'Product Feedback'), ('COMPLAINT', 'Complaint'),
        ('SUGGESTION', 'Suggestion'),
    )
    STATUS_CHOICES = (
        ('OPEN', 'Open'), ('IN_PROGRESS', 'In Progress'), ('WAITING_CLIENT', 'Waiting for Client'),
        ('RESOLVED', 'Resolved'), ('CLOSED', 'Closed'),
    )
    PRIORITY_CHOICES = (('LOW', 'Low'), ('NORMAL', 'Normal'), ('HIGH', 'High'), ('URGENT', 'Urgent'))

    ticket_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    ticket_type = models.CharField(max_length=20, choices=TICKET_TYPES, default='GENERAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')
    subject = models.CharField(max_length=255)
    description = models.TextField()

    related_order = models.ForeignKey('client_portal.ClientOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    assigned_to = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    resolution_notes = models.TextField(blank=True, default='')
    resolved_at = models.DateTimeField(null=True, blank=True)
    satisfaction_rating = models.IntegerField(null=True, blank=True)
    satisfaction_feedback = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_ticket'
        ordering = ['-created_at']

    def __str__(self):
        return self.ticket_number or f"TKT-{self.id}"

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = f"TKT-{timezone.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)
