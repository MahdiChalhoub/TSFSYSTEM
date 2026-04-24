"""Scalable catalogue i18n for Brand and Parfum (attribute groups).

Adds a `translations` JSONB column mirroring the Category design. The dict is
keyed by ISO locale code and each value carries per-field localisations, e.g.
`{"fr": {"name": "Boissons", "short_name": "BOI"}}`.
"""
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('inventory', '0064_category_translations_jsonb')]
    operations = [
        migrations.AddField(
            model_name='brand',
            name='translations',
            field=models.JSONField(default=dict, blank=True,
                help_text='Localised brand names keyed by locale code'),
        ),
        migrations.AddField(
            model_name='parfum',
            name='translations',
            field=models.JSONField(default=dict, blank=True,
                help_text='Localised attribute names keyed by locale code'),
        ),
    ]
