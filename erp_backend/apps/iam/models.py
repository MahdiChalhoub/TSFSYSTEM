"""
IAM Module — Identity & Access Models

ContactPortalAccess: Bridge between User (login identity) and Contact (business entity).
PortalApprovalRequest: Generic approval lifecycle for portal access requests.

Design principles:
- User = identity only (no business semantics)
- ContactPortalAccess = explicit portal grant (default deny)
- PortalApprovalRequest = approval orchestration (before access is created)
- Audit-first: every state change is traceable
"""

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from erp.models import TenantModel


class ContactPortalAccess(TenantModel):
    """
    Bridge: User ↔ Contact with portal-specific access control.

    One supplier company can have multiple portal users (owner, accountant, logistics).
    One user can represent multiple contacts if needed.
    Access can be approved/revoked without touching CRM core records.
    Every portal access is auditable.

    IMPORTANT: This record should only be created AFTER approval is complete.
    For supplier registrations, create a PortalApprovalRequest first.
    """

    PORTAL_TYPES = (
        ('CLIENT', 'Client Portal'),
        ('SUPPLIER', 'Supplier Portal'),
    )
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('BLOCKED', 'Blocked'),
        ('REVOKED', 'Revoked'),
    )
    RELATIONSHIP_ROLES = (
        ('OWNER', 'Business Owner'),
        ('REPRESENTATIVE', 'Representative'),
        ('ACCOUNTING', 'Accounting Contact'),
        ('LOGISTICS', 'Logistics Contact'),
        ('PURCHASER', 'Purchaser'),
        ('SELF', 'Self (Individual)'),
    )
    CREATED_VIA_CHOICES = (
        ('AUTO_LINK', 'Auto-linked on registration'),
        ('ADMIN_CREATE', 'Created by admin'),
        ('SELF_REGISTER', 'Self-registration'),
        ('APPROVAL', 'Created after approval'),
        ('TRANSFER', 'Persona transfer'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='portal_access_records',
        help_text='Login identity with portal access',
    )
    contact = models.ForeignKey(
        'crm.Contact',
        on_delete=models.CASCADE,
        related_name='portal_access_records',
        help_text='Business entity this user represents',
    )
    portal_type = models.CharField(
        max_length=20,
        choices=PORTAL_TYPES,
        help_text='Which portal this access record controls',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE',
        help_text='Access grant status (ACTIVE/BLOCKED/REVOKED). '
                  'No PENDING here — use PortalApprovalRequest for pending state.',
    )
    relationship_role = models.CharField(
        max_length=20,
        choices=RELATIONSHIP_ROLES,
        default='SELF',
        help_text='Role of this user relative to the contact entity',
    )
    is_primary = models.BooleanField(
        default=True,
        help_text='Primary representative for this contact',
    )
    created_via = models.CharField(
        max_length=20,
        choices=CREATED_VIA_CHOICES,
        default='ADMIN_CREATE',
        help_text='How this access record was created (audit trail)',
    )

    # What they can access
    can_access_portal = models.BooleanField(
        default=True,
        help_text='Can access the portal dashboard',
    )
    can_access_ecommerce = models.BooleanField(
        default=True,
        help_text='Can access eCommerce storefront (clients only)',
    )
    visibility_scope = models.JSONField(
        default=dict,
        blank=True,
        help_text='Fine-grained visibility scope overrides (future)',
    )

    # Audit
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_access_granted',
        help_text='Admin who granted this access',
    )
    granted_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_access_revoked',
    )
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.TextField(null=True, blank=True)

    # Lifecycle
    last_portal_login = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'iam'
        db_table = 'iam_contact_portal_access'
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'user', 'contact', 'portal_type'],
                name='unique_portal_access_per_org_user_contact_type',
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'user', 'portal_type', 'status'],
                         name='idx_portal_user_type_status'),
            models.Index(fields=['organization', 'contact', 'portal_type', 'status'],
                         name='idx_portal_contact_type_status'),
            models.Index(fields=['organization', 'portal_type', 'status'],
                         name='idx_portal_org_type_status'),
            models.Index(fields=['organization', 'is_primary'],
                         name='idx_portal_org_primary'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} → {self.contact} ({self.get_portal_type_display()}) [{self.status}]"

    def clean(self):
        """Business validation rules — enforced at model level."""
        errors = {}

        # Rule 1: CLIENT portal requires customer-compatible contact type
        if self.portal_type == 'CLIENT' and hasattr(self, 'contact') and self.contact_id:
            try:
                contact = self.contact
                if contact.type not in ('CUSTOMER', 'BOTH', 'LEAD'):
                    errors['contact'] = (
                        f'Client portal access requires a CUSTOMER/BOTH contact, '
                        f'not {contact.type}.'
                    )
            except Exception:
                pass

        # Rule 2: SUPPLIER portal requires supplier-compatible contact type
        if self.portal_type == 'SUPPLIER' and hasattr(self, 'contact') and self.contact_id:
            try:
                contact = self.contact
                if contact.type not in ('SUPPLIER', 'BOTH'):
                    errors['contact'] = (
                        f'Supplier portal access requires a SUPPLIER/BOTH contact, '
                        f'not {contact.type}.'
                    )
            except Exception:
                pass

        # Rule 3: eCommerce access only for CLIENT portal
        if self.can_access_ecommerce and self.portal_type != 'CLIENT':
            errors['can_access_ecommerce'] = (
                'eCommerce access is only available for CLIENT portal type.'
            )

        # Rule 4: User account must not be rejected/blocked
        if hasattr(self, 'user') and self.user_id:
            try:
                if self.user.account_status in ('REJECTED', 'BLOCKED', 'SUSPENDED'):
                    errors['user'] = (
                        f'Cannot grant portal access to user with '
                        f'account_status={self.user.account_status}.'
                    )
            except Exception:
                pass

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # Run clean() on every save unless explicitly skipped
        if not kwargs.pop('skip_validation', False):
            self.clean()
        super().save(*args, **kwargs)

    @property
    def is_active_access(self):
        """Is this access currently usable?"""
        return self.status == 'ACTIVE' and self.can_access_portal

    def revoke(self, revoked_by=None, reason=''):
        """Revoke access."""
        from django.utils import timezone
        self.status = 'REVOKED'
        self.revoked_by = revoked_by
        self.revoked_at = timezone.now()
        self.revoke_reason = reason
        self.save(update_fields=['status', 'revoked_by', 'revoked_at', 'revoke_reason', 'updated_at'],
                  skip_validation=True)

    def block(self):
        """Temporarily block access."""
        self.status = 'BLOCKED'
        self.save(update_fields=['status', 'updated_at'], skip_validation=True)

    def reactivate(self, granted_by=None):
        """Reactivate blocked/revoked access."""
        from django.utils import timezone
        self.status = 'ACTIVE'
        self.granted_by = granted_by
        self.granted_at = timezone.now()
        self.save(update_fields=['status', 'granted_by', 'granted_at', 'updated_at'],
                  skip_validation=True)


class PortalApprovalRequest(TenantModel):
    """
    Generic approval lifecycle for portal access.

    Created BEFORE ContactPortalAccess.
    Supplier registrations → create this first, admin reviews, then creates access.
    Client registrations → may auto-approve and skip this for strong matches.

    Future extensible: can handle employee portal invitations,
    partner access requests, contact link changes, etc.
    """

    REQUEST_TYPES = (
        ('CLIENT_REGISTRATION', 'Client Portal Registration'),
        ('SUPPLIER_REGISTRATION', 'Supplier Portal Registration'),
        ('PORTAL_LINK_CHANGE', 'Portal Link Change'),
        ('ACCESS_REACTIVATION', 'Access Reactivation Request'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('NEEDS_CORRECTION', 'Needs Correction'),
        ('CANCELLED', 'Cancelled'),
    )

    request_type = models.CharField(
        max_length=30,
        choices=REQUEST_TYPES,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
    )

    # Who is requesting
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='portal_approval_requests',
        help_text='The user requesting access',
    )

    # What they want to access (nullable until admin links)
    target_contact = models.ForeignKey(
        'crm.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_approval_requests',
        help_text='The contact to link to (may be set by admin during approval)',
    )

    # Result pointer (set after approval creates the access record)
    resulting_access = models.ForeignKey(
        ContactPortalAccess,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approval_request',
        help_text='The ContactPortalAccess created as a result of this approval',
    )

    # Submitted data (preserved for audit even after approval)
    submitted_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Registration form data submitted by the user '
                  '(company name, phone, tax ID, etc.)',
    )

    # Review lifecycle
    review_notes = models.TextField(null=True, blank=True)
    correction_notes = models.TextField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_approvals_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'iam'
        db_table = 'iam_portal_approval_request'
        indexes = [
            models.Index(fields=['organization', 'status', 'request_type'],
                         name='idx_approval_org_status_type'),
            models.Index(fields=['organization', 'target_user'],
                         name='idx_approval_org_user'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return (f"[{self.get_request_type_display()}] {self.target_user} "
                f"→ {self.target_contact or '(pending link)'} [{self.status}]")

    def approve(self, reviewed_by, contact=None, review_notes=''):
        """
        Approve the request. For supplier registrations, admin must provide
        the contact to link. Creates ContactPortalAccess automatically.
        """
        from django.utils import timezone

        if self.status != 'PENDING':
            raise ValidationError(f'Cannot approve request in {self.status} status.')

        # For supplier, admin must specify contact
        if self.request_type == 'SUPPLIER_REGISTRATION' and not contact and not self.target_contact:
            raise ValidationError(
                'Supplier registration approval requires linking to a Contact.'
            )

        if contact:
            self.target_contact = contact

        self.status = 'APPROVED'
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        self.review_notes = review_notes

        # Determine portal type from request type
        portal_type = 'SUPPLIER' if 'SUPPLIER' in self.request_type else 'CLIENT'

        # Create the actual portal access record
        access = ContactPortalAccess.objects.create(
            organization=self.organization,
            user=self.target_user,
            contact=self.target_contact,
            portal_type=portal_type,
            status='ACTIVE',
            created_via='APPROVAL',
            can_access_portal=True,
            can_access_ecommerce=portal_type == 'CLIENT',
            granted_by=reviewed_by,
            granted_at=timezone.now(),
        )
        self.resulting_access = access

        # Activate user if pending
        if self.target_user.account_status == 'PENDING':
            self.target_user.account_status = 'ACTIVE'
            self.target_user.save(update_fields=['account_status'])

        self.save()
        return access

    def reject(self, reviewed_by, reason=''):
        """Reject the request permanently."""
        from django.utils import timezone
        if self.status != 'PENDING':
            raise ValidationError(f'Cannot reject request in {self.status} status.')
        self.status = 'REJECTED'
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        self.review_notes = reason
        self.save()

        # Reject user account if this was a registration
        if 'REGISTRATION' in self.request_type:
            self.target_user.account_status = 'REJECTED'
            self.target_user.save(update_fields=['account_status'])

    def request_correction(self, reviewed_by, notes):
        """Ask user to fix their submission."""
        from django.utils import timezone
        if self.status != 'PENDING':
            raise ValidationError(f'Cannot request correction for {self.status} status.')
        self.status = 'NEEDS_CORRECTION'
        self.correction_notes = notes
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        self.save()

    def resubmit(self, updated_data=None):
        """User resubmits after correction."""
        if self.status != 'NEEDS_CORRECTION':
            raise ValidationError('Can only resubmit after correction request.')
        self.status = 'PENDING'
        if updated_data:
            self.submitted_data.update(updated_data)
        self.save()
