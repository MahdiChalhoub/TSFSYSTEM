"""Scalable catalogue i18n — one JSONB column for arbitrary locale codes.

Replaces the fixed `name_fr` / `name_ar` design with a single `translations`
dict keyed by ISO locale code. The tenant picks which locales to expose via
`Organization.settings.catalogue_languages`; the form renders one input per
enabled locale.

Legacy `name_fr` / `name_ar` columns are kept for backward compat."""
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('inventory', '0063_category_multilang_names')]
    operations = [
        migrations.AddField(
            model_name='category',
            name='translations',
            field=models.JSONField(default=dict, blank=True,
                help_text='Localised names keyed by locale code'),
        ),
    ]
