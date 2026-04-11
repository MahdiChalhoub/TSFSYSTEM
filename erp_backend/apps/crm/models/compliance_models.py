from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from django.conf import settings

class ComplianceRule(AuditLogMixin, TenantOwnedModel):
    """
    Enterprise Compliance Rule Engine.
    Defines which documents are required for specific contact traits.
    """
    BLOCK_LEVELS = (
        ('WARNING',            'Warning Only (No block)'),
        ('BLOCK_CONFIRMATION', 'Block Order Confirmation'),
        ('BLOCK_INVOICE',      'Block Invoicing'),
        ('BLOCK_PAYMENT',      'Block Payment Processing'),
        ('STRICT',             'Strict (Block All Transactions)'),
    )

    document_type = models.CharField(
        max_length=50,
        help_text='Internal code for the document (e.g. NCC, RCCM, DFE, ID_CARD)'
    )
    name = models.CharField(max_length=255, help_text='Display name of the requirement')
    
    # Conditional logic
    country_code = models.CharField(max_length=3, default='CI', help_text='ISO alpha-3 code')
    entity_type = models.CharField(
        max_length=20, 
        choices=(('INDIVIDUAL', 'Individual'), ('BUSINESS', 'Business'), ('BOTH', 'Any')),
        default='BOTH'
    )
    contact_type = models.CharField(
        max_length=20,
        choices=(('CUSTOMER', 'Customer'), ('SUPPLIER', 'Supplier'), ('BOTH', 'Any')),
        default='BOTH'
    )
    tax_regime = models.CharField(max_length=100, null=True, blank=True, help_text='Filter by commercial_category/tax regime')

    is_mandatory = models.BooleanField(default=True)
    block_level = models.CharField(max_length=30, choices=BLOCK_LEVELS, default='BLOCK_INVOICE')
    renewal_days_before = models.IntegerField(default=30, help_text='Days before expiry to trigger renewal task')
    grace_period_days = models.IntegerField(default=0, help_text='Additional days allowed after expiry before blocking')
    
    is_active = models.BooleanField(default=True)
    version = models.IntegerField(default=1)
    
    # Hierarchy & Scoping (§Missing 15)
    branch_id = models.IntegerField(null=True, blank=True, help_text='Specific branch scope (Optional)')
    
    # Escalation Chain (§Missing 9, 18)
    # Format: [{"days": 0, "notify": "OWNER"}, {"days": 7, "notify": "MANAGER"}, {"days": 15, "notify": "LEGAL"}]
    escalation_chain = models.JSONField(default=list, blank=True)
    
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'compliance_rules'
        verbose_name = 'Compliance Rule'
        verbose_name_plural = 'Compliance Rules'

    def __str__(self):
        return f"[{self.country_code}] {self.name} ({self.document_type})"


class ComplianceEvent(AuditLogMixin, TenantOwnedModel):
    """
    Audit trail for compliance changes and violations.
    Used for enterprise risk monitoring and reporting.
    """
    EVENT_TYPES = (
        ('STATUS_CHANGE',    'Compliance Status Changed'),
        ('DOC_UPLOADED',     'Document Uploaded'),
        ('DOC_EXPIRED',      'Document Expired'),
        ('DOC_REJECTED',     'Document Rejected'),
        ('VIOLATION_BLOCK',  'Transaction Blocked by Compliance'),
        ('MANUAL_OVERRIDE',  'Manual Compliance Override'),
    )

    contact = models.ForeignKey('crm.Contact', on_delete=models.CASCADE, related_name='compliance_events')
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES)
    
    document = models.ForeignKey(
        'crm.ContactComplianceDocument', 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='audit_events'
    )
    
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, blank=True
    )
    
    risk_level = models.CharField(
        max_length=20,
        choices=(('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')),
        default='LOW'
    )
    
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'compliance_events'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.contact.name} - {self.event_type} @ {self.created_at}"


class ComplianceOverride(AuditLogMixin, TenantOwnedModel):
    """
    Manual bypass for compliance blocks. (§Missing 5)
    Authorized by managers to allow operations during document renewal.
    """
    contact = models.ForeignKey('crm.Contact', on_delete=models.CASCADE, related_name='compliance_overrides')
    rule = models.ForeignKey(ComplianceRule, on_delete=models.CASCADE, null=True, blank=True)
    
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reason = models.TextField()
    
    start_date = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateTimeField(help_text='When this override expires')
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'compliance_overrides'

    def __str__(self):
        return f"Override for {self.contact.name} (Exp: {self.expiry_date})"
