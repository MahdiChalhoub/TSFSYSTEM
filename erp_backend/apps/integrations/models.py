from django.db import models
from erp.models import TenantModel, Product
from apps.client_portal.models import ClientOrder

class EcommerceIntegration(TenantModel):
    """Configuration for external e-commerce store connections."""
    PLATFORM_CHOICES = (
        ('SHOPIFY', 'Shopify'),
        ('WOOCOMMERCE', 'WooCommerce'),
    )

    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    display_name = models.CharField(max_length=100)
    api_url = models.URLField(help_text="Store base URL (e.g., https://mystore.myshopify.com)")
    
    # Encrypted credentials
    api_key_encrypted = models.TextField(null=True, blank=True)
    api_secret_encrypted = models.TextField(null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ecommerce_integration'
        unique_together = ('organization', 'platform', 'api_url')

    def __str__(self):
        return f"{self.display_name} ({self.platform})"

    def set_api_key(self, raw_key):
        from apps.finance.cryptography import encrypt_value
        self.api_key_encrypted = encrypt_value(raw_key)

    def get_api_key(self):
        if not self.api_key_encrypted: return None
        from apps.finance.cryptography import decrypt_value
        return decrypt_value(self.api_key_encrypted)

    def set_api_secret(self, raw_secret):
        from apps.finance.cryptography import encrypt_value
        self.api_secret_encrypted = encrypt_value(raw_secret)

    def get_api_secret(self):
        if not self.api_secret_encrypted: return None
        from apps.finance.cryptography import decrypt_value
        return decrypt_value(self.api_secret_encrypted)


class ExternalProductMapping(TenantModel):
    """Maps local Products to their external platform identities."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='external_mappings')
    integration = models.ForeignKey(EcommerceIntegration, on_delete=models.CASCADE, related_name='product_mappings')
    external_id = models.CharField(max_length=255)
    external_variant_id = models.CharField(max_length=255, null=True, blank=True)
    last_sync_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'external_product_mapping'
        unique_together = ('integration', 'external_id', 'external_variant_id')


class ExternalOrderMapping(TenantModel):
    """Maps local ClientOrders to their external platform identities."""
    order = models.ForeignKey(ClientOrder, on_delete=models.CASCADE, related_name='external_mappings')
    integration = models.ForeignKey(EcommerceIntegration, on_delete=models.CASCADE, related_name='order_mappings')
    external_id = models.CharField(max_length=255)
    external_number = models.CharField(max_length=100, null=True, blank=True)
    last_sync_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'external_order_mapping'
        unique_together = ('integration', 'external_id')
