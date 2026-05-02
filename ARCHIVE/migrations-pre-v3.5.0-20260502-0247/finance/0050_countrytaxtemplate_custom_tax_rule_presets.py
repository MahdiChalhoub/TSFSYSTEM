"""
Add custom_tax_rule_presets JSON field to CountryTaxTemplate.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0049_phase3_tax_engine_ext'),
    ]

    operations = [
        migrations.AddField(
            model_name='countrytaxtemplate',
            name='custom_tax_rule_presets',
            field=models.JSONField(
                blank=True, default=list,
                help_text='Default custom tax rules for this country.',
            ),
        ),
    ]
