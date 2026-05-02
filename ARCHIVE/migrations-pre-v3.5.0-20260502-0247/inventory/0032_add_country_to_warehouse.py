# Generated manually — Django makemigrations was blocked by local DB connectivity

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('reference', '0001_initial'),
        ('inventory', '0031_fresh_media_catalog'),
    ]

    operations = [
        migrations.AddField(
            model_name='warehouse',
            name='country',
            field=models.ForeignKey(
                blank=True,
                help_text='Country this location operates in (multi-country feature)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='warehouses',
                to='reference.country',
            ),
        ),
        migrations.AlterModelOptions(
            name='producttask',
            options={'ordering': ['-pk']},
        ),
    ]
