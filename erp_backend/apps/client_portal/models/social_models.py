from django.db import models
from erp.models import TenantModel

class ProductReview(TenantModel):
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='reviews')
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='product_reviews')
    name = models.CharField(max_length=255)
    rating = models.IntegerField(default=5)
    title = models.CharField(max_length=255, blank=True, default='')
    content = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'client_product_review'
        ordering = ['-created_at']

    def __str__(self):
        return f"Review: {self.product.name} ({self.rating} stars) by {self.name}"


class WishlistItem(TenantModel):
    contact = models.ForeignKey('crm.Contact', on_delete=models.CASCADE, related_name='wishlist_items')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='wishlisted_by')
    variant = models.ForeignKey('inventory.ProductVariant', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'client_wishlist_item'
        unique_together = ('contact', 'product', 'variant')
        ordering = ['-created_at']

    def __str__(self):
        return f"Wishlist: {self.contact} -> {self.product.name}"
