# This migration was superseded by 0012_cartpromotion_cartpromotionusage_shippingrate.
# Made a no-op to avoid table conflicts. Merged via 0013_merge_0012.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('client_portal', '0011_shipping_rate'),
        ('crm', '0001_initial'),
    ]

    operations = [
        # No-op: tables were already created by 0012_cartpromotion_cartpromotionusage_shippingrate
    ]
