# Manual migration: rename site → branch on POSRegister, point to Warehouse
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_alter_category_barcode_sequence_and_more'),
        ('pos', '0007_cashieraddressbook_approved_at_and_more'),
    ]

    operations = [
        # 1. Drop old unique_together that references 'site'
        migrations.AlterUniqueTogether(
            name='posregister',
            unique_together=set(),
        ),
        # 2. Remove the old 'site' FK (if it still exists in DB)
        migrations.RemoveField(
            model_name='posregister',
            name='site',
        ),
        # 3. Add 'branch' FK pointing to inventory.Warehouse
        migrations.AddField(
            model_name='posregister',
            name='branch',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='pos_registers',
                to='inventory.warehouse',
                help_text='Branch/location this register belongs to',
                null=True,  # temporarily nullable for migration
            ),
            preserve_default=False,
        ),
        # 4. New unique_together with branch
        migrations.AlterUniqueTogether(
            name='posregister',
            unique_together={('name', 'branch', 'organization')},
        ),
        # 5. Fix ordering
        migrations.AlterModelOptions(
            name='posregister',
            options={'db_table': 'pos_register', 'ordering': ['branch__name', 'name']},
        ),
    ]
