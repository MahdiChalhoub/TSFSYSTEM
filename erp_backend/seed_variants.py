from apps.inventory.models import Product, ProductVariant, ProductAttribute, ProductAttributeValue
from erp.models import Organization
from decimal import Decimal

def seed_variants():
    org = Organization.objects.get(slug='tsf-global')
    product = Product.objects.get(id=1, organization=org)
    
    # Create Attributes
    size_attr, _ = ProductAttribute.objects.get_or_create(
        organization=org,
        name='Size',
        defaults={'code': 'SIZE'}
    )
    color_attr, _ = ProductAttribute.objects.get_or_create(
        organization=org,
        name='Color',
        defaults={'code': 'COLOR'}
    )
    
    # Create Attribute Values
    size_l = ProductAttributeValue.objects.get_or_create(attribute=size_attr, value='L')[0]
    size_xl = ProductAttributeValue.objects.get_or_create(attribute=size_attr, value='XL')[0]
    color_red = ProductAttributeValue.objects.get_or_create(attribute=color_attr, value='Red')[0]
    color_blue = ProductAttributeValue.objects.get_or_create(attribute=color_attr, value='Blue')[0]
    
    # Create Variants
    v1, _ = ProductVariant.objects.get_or_create(
        product=product,
        organization=org,
        sku=f"{product.sku}-L-RED",
        defaults={'price_override': Decimal('150.00')}
    )
    v1.attribute_values.set([size_l, color_red])
    
    v2, _ = ProductVariant.objects.get_or_create(
        product=product,
        organization=org,
        sku=f"{product.sku}-XL-BLUE",
        defaults={'price_override': Decimal('160.00')}
    )
    v2.attribute_values.set([size_xl, color_blue])
    
    print(f"Created 2 variants for {product.name}")

if __name__ == "__main__":
    seed_variants()
