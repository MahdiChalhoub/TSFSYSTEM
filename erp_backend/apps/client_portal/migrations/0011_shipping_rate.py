# Superseded by 0012_cartpromotion_cartpromotionusage_shippingrate.
# Made a no-op to avoid table conflicts. Merged via 0013_merge_0012.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('client_portal', '0010_coupon_discount_engine'),
        ('pos', '0001_initial'),
    ]

    operations = [
        # No-op: ecommerce_shipping_rate was already created by
        # 0012_cartpromotion_cartpromotionusage_shippingrate (auto-generated Django migration)
    ]
