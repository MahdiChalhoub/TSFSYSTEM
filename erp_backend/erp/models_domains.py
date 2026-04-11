"""
Custom Domain Module
====================
Allows organizations to link their own domains to the platform.

Domain Types:
  - SHOP:     whatever.com       → Maps to storefront (/organization/[slug]/...)
  - PLATFORM: platform.whatever.com → Maps to admin panel (/dashboard, /finance, etc.)

Flow:
  1. Tenant admin adds domain in Settings → Custom Domains
  2. System generates a DNS verification token (TXT record)
  3. Admin adds TXT record to their DNS
  4. System verifies DNS → marks domain as verified
  5. SSL certificate is provisioned (manual/auto)
  6. Domain becomes active → middleware routes traffic
"""
import uuid
from django.db import models


class CustomDomain(models.Model):
    """
    Maps a custom domain to an organization.

    Example:
        domain: "shop.acme.com"
        organization: (FK → Organization with slug="acme")
        domain_type: "SHOP"
        is_verified: True
        is_active: True
    """
    DOMAIN_TYPE_CHOICES = [
        ('SHOP', 'Storefront / Shop'),
        ('PLATFORM', 'Control Panel / Admin'),
    ]
    SSL_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROVISIONING', 'Provisioning'),
        ('ACTIVE', 'Active'),
        ('FAILED', 'Failed'),
        ('EXPIRED', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    domain = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text='The custom domain, e.g. "shop.acme.com" or "platform.acme.com"'
    )
    organization = models.ForeignKey(
        'Organization',
        on_delete=models.CASCADE,
        related_name='custom_domains',
        db_column='tenant_id',
        help_text='The organization this domain belongs to'
    )
    domain_type = models.CharField(
        max_length=10,
        choices=DOMAIN_TYPE_CHOICES,
        default='SHOP',
        help_text='SHOP = storefront, PLATFORM = admin/control panel'
    )

    # Verification
    is_verified = models.BooleanField(default=False, help_text='DNS verification passed')
    verification_token = models.CharField(
        max_length=64,
        blank=True,
        help_text='DNS TXT record value for domain verification'
    )

    # SSL
    ssl_status = models.CharField(
        max_length=15,
        choices=SSL_STATUS_CHOICES,
        default='PENDING'
    )

    # Status
    is_active = models.BooleanField(
        default=False,
        help_text='Domain is verified AND SSL is active → traffic is routed'
    )
    is_primary = models.BooleanField(
        default=False,
        help_text='Primary domain for this org + type combo (used for canonical URLs)'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    ssl_provisioned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'custom_domain'
        ordering = ['-is_primary', '-is_active', 'domain']
        constraints = [
            # Only one primary domain per org per type
            models.UniqueConstraint(
                fields=['organization', 'domain_type'],
                condition=models.Q(is_primary=True),
                name='unique_primary_domain_per_org_type'
            ),
        ]

    def __str__(self):
        status = '✅' if self.is_active else ('⏳' if self.is_verified else '❌')
        return f"{status} {self.domain} → {self.organization.slug} ({self.domain_type})"

    def generate_verification_token(self):
        """Generate a unique DNS TXT verification token."""
        import hashlib
        raw = f"{self.domain}:{self.organization.slug}:{uuid.uuid4().hex}"
        self.verification_token = f"tsf-verify={hashlib.sha256(raw.encode()).hexdigest()[:32]}"
        return self.verification_token

    def get_txt_record_name(self):
        """Return the DNS TXT record name to use."""
        return f"_tsf-verification.{self.domain}"

    def save(self, *args, **kwargs):
        # Auto-generate verification token on first save
        if not self.verification_token:
            self.generate_verification_token()
        # Normalize domain to lowercase
        self.domain = self.domain.lower().strip()
        # Active requires verified + SSL
        if not self.is_verified or self.ssl_status != 'ACTIVE':
            self.is_active = False
        super().save(*args, **kwargs)
