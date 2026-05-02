"""
Add Product Lifecycle Management fields:
- data_completeness_level (0-8)
- completeness_status (DRAFT -> VERIFIED)
- is_verified (manual flag)
- product_completeness_idx index
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0023_productpackaging_first_class'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='data_completeness_level',
            field=models.IntegerField(
                default=0,
                choices=[
                    (0, 'Draft'), (1, 'Identified'), (2, 'Priced'),
                    (3, 'Inventoried'), (4, 'Grouped'), (5, 'Packaged'),
                    (6, 'Sourced'), (7, 'Complete'), (8, 'Verified'),
                ],
                help_text='Auto-computed maturity level (0=Draft → 8=Verified)',
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='completeness_status',
            field=models.CharField(
                max_length=15,
                default='DRAFT',
                choices=[
                    ('DRAFT', 'Draft'), ('IDENTIFIED', 'Identified'),
                    ('PRICED', 'Priced'), ('INVENTORIED', 'Inventoried'),
                    ('GROUPED', 'Grouped'), ('PACKAGED', 'Packaged'),
                    ('SOURCED', 'Sourced'), ('COMPLETE', 'Complete'),
                    ('VERIFIED', 'Verified'),
                ],
                help_text='Human-readable status derived from data_completeness_level',
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='is_verified',
            field=models.BooleanField(
                default=False,
                help_text='Manually set by controller/manager to mark product as fully verified',
            ),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(
                fields=['organization', 'data_completeness_level'],
                name='product_completeness_idx',
            ),
        ),
    ]
