"""
Payment Gateway Configuration Model
=====================================
Stores encrypted API keys per organization for payment gateways (Stripe, etc.)
"""
from django.db import models
from erp.models import TenantModel


class GatewayConfig(TenantModel):
    """Payment gateway configuration — one per gateway type per organization."""
    GATEWAY_TYPES = (
        ('STRIPE', 'Stripe'),
        ('PAYPAL', 'PayPal'),
        ('SQUARE', 'Square'),
        ('MANUAL', 'Manual/Offline'),
    )

    gateway_type = models.CharField(max_length=20, choices=GATEWAY_TYPES)
    display_name = models.CharField(max_length=100, help_text='Friendly label')
    is_active = models.BooleanField(default=False)
    is_test_mode = models.BooleanField(default=True, help_text='Use sandbox/test keys')

    # Encrypted credentials — stored as encrypted text via AES-256
    api_key_encrypted = models.TextField(null=True, blank=True, help_text='Encrypted secret key')
    publishable_key = models.CharField(max_length=255, null=True, blank=True, help_text='Public/publishable key (safe for frontend)')
    webhook_secret_encrypted = models.TextField(null=True, blank=True, help_text='Encrypted webhook signing secret')

    # Optional config
    supported_currencies = models.JSONField(
        default=list, blank=True,
        help_text='List of supported currency codes, e.g. ["USD", "EUR", "LBP"]'
    )
    default_currency = models.CharField(max_length=3, default='USD')
    metadata = models.JSONField(default=dict, blank=True, help_text='Extra gateway-specific config')

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'gateway_config'
        unique_together = ['organization', 'gateway_type']

    def __str__(self):
        mode = 'TEST' if self.is_test_mode else 'LIVE'
        return f"{self.display_name} ({self.gateway_type}) [{mode}]"

    def set_api_key(self, raw_key):
        """Encrypt and store the API secret key."""
        from apps.finance.cryptography import encrypt_value
        self.api_key_encrypted = encrypt_value(raw_key)

    def get_api_key(self):
        """Decrypt and return the API secret key."""
        if not self.api_key_encrypted:
            return None
        from apps.finance.cryptography import decrypt_value
        return decrypt_value(self.api_key_encrypted)

    def set_webhook_secret(self, raw_secret):
        """Encrypt and store the webhook signing secret."""
        from apps.finance.cryptography import encrypt_value
        self.webhook_secret_encrypted = encrypt_value(raw_secret)

    def get_webhook_secret(self):
        """Decrypt and return the webhook signing secret."""
        if not self.webhook_secret_encrypted:
            return None
        from apps.finance.cryptography import decrypt_value
        return decrypt_value(self.webhook_secret_encrypted)
