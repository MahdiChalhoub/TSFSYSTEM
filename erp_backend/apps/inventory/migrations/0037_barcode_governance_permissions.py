"""
Add granular barcode governance permissions to BarcodePolicy.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0036_backfill_product_barcodes'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='barcodepolicy',
            options={
                'permissions': [
                    ('generate_barcode', 'Can auto/manual generate barcodes'),
                    ('change_barcode', 'Can modify existing barcodes'),
                    ('verify_packaging', 'Can verify a packaging level'),
                    ('reprint_label', 'Can request label reprint'),
                    ('edit_barcode_policy', 'Can modify BarcodePolicy settings'),
                    ('approve_barcode_change', 'Can approve BarcodeChangeRequests'),
                ],
            },
        ),
    ]
