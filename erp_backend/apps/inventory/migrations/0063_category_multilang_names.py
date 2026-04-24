"""Localised display names on Category (French + Arabic).

Empty strings mean "fall back to `name`" at the display layer. No unique
constraints — multiple categories can share a translation (e.g. identical
French names across tenants)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0062_category_barcode_prefix_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='name_fr',
            field=models.CharField(blank=True, default='', max_length=255,
                help_text='French display name (falls back to `name` if empty)'),
        ),
        migrations.AddField(
            model_name='category',
            name='name_ar',
            field=models.CharField(blank=True, default='', max_length=255,
                help_text='Arabic display name (falls back to `name` if empty)'),
        ),
    ]
