"""
Refactor Product Lifecycle Management fields:
- Remove completeness_status (redundant with data_completeness_level)
- Remove product_completeness_idx (redundant with db_index=True on field)
- Change data_completeness_level from IntegerField to PositiveSmallIntegerField
- Add verified_at (DateTimeField)
- Add verified_by (FK → User)
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0024_product_completeness_level'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Remove completeness_status column
        migrations.RemoveField(
            model_name='product',
            name='completeness_status',
        ),

        # 2. Remove the composite index (field already has db_index=True)
        migrations.RemoveIndex(
            model_name='product',
            name='product_completeness_idx',
        ),

        # 3. Change IntegerField → PositiveSmallIntegerField
        migrations.AlterField(
            model_name='product',
            name='data_completeness_level',
            field=models.PositiveSmallIntegerField(
                default=0, db_index=True,
                help_text='Data maturity level (0=Draft → 7=Complete). Computed by service, not save().',
            ),
        ),

        # 4. Add verified_at
        migrations.AddField(
            model_name='product',
            name='verified_at',
            field=models.DateTimeField(
                null=True, blank=True,
                help_text='When the product was last verified',
            ),
        ),

        # 5. Add verified_by
        migrations.AddField(
            model_name='product',
            name='verified_by',
            field=models.ForeignKey(
                null=True, blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='verified_products',
                to=settings.AUTH_USER_MODEL,
                help_text='Controller/manager who verified this product',
            ),
        ),
    ]
