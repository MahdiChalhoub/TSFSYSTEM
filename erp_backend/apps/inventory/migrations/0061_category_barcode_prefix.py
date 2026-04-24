"""
Add per-category barcode prefix.

Leading digits the barcode rules engine prepends to the category's
incremental counter when auto-generating product barcodes. Lives on the
Category row itself (simple, no join) rather than on CategoryCreationRule
so the default workflow (create product → auto-barcode) works without
requiring a separate rule record.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0060_reference_code_batch'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='barcode_prefix',
            field=models.CharField(
                max_length=10, blank=True, default='',
                help_text='Leading digits for barcodes created under this category',
            ),
        ),
    ]
