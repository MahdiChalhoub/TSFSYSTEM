# This migration was superseded by 0010_coupon_couponusage.
# Made a no-op to avoid table conflicts, merged via 0011_merge_0010_coupon.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('client_portal', '0009_alter_clientorder_delivery_rating_and_more'),
        ('crm', '0001_initial'),
    ]

    operations = [
        # No-op: tables were already created by 0010_coupon_couponusage
    ]
