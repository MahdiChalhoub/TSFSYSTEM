"""
Add settings JSONField to Organization model.
Fixes ProgrammingError: column Organization.settings does not exist.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0030_create_systemmodulelog'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='settings',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
