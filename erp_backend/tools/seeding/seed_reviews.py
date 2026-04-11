import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.client_portal.models import ProductReview, ClientPortalAccess
from apps.inventory.models import Product
from erp.models import Organization

def seed_reviews():
    org = Organization.objects.get(slug='test-org')
    products = Product.objects.filter(organization=org)
    
    review_templates = [
        {"title": "Amazing quality!", "content": "I am really impressed with the build quality. Well worth the price."},
        {"title": "Great value", "content": "Best in its class. Highly recommended for everyone looking for a reliable product."},
        {"title": "Good but could be better", "content": "The product is fine, but shipping took longer than expected. Still satisfied."},
        {"title": "Life changing", "content": "I don't know how I lived without this before. Absolutely essential."},
        {"title": "Premium feel", "content": "The materials used are top notch. You can feel the luxury."},
    ]
    
    names = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank"]
    
    for product in products:
        # Add 1-4 reviews per product
        num_reviews = random.randint(1, 4)
        for _ in range(num_reviews):
            template = random.choice(review_templates)
            ProductReview.objects.create(
                organization=org,
                product=product,
                name=random.choice(names),
                rating=random.randint(4, 5), # Seed with mostly good reviews for demo
                title=template["title"],
                content=template["content"],
                is_verified_purchase=True,
                is_visible=True
            )
    print(f"Seeded reviews for {products.count()} products.")

if __name__ == "__main__":
    seed_reviews()
