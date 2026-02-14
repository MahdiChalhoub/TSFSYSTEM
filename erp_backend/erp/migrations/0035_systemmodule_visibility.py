"""
Manual migration: Add visibility, description, icon to SystemModule.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0034_subscriptionplan_trial_days'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemmodule',
            name='visibility',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('public', 'Public – shown on landing page'),
                    ('organization', 'Organization – only visible to assigned orgs'),
                    ('private', 'Private – hidden/internal only'),
                ],
                default='public',
            ),
        ),
        migrations.AddField(
            model_name='systemmodule',
            name='description',
            field=models.TextField(blank=True, default='', help_text='Short description shown on landing page and plan pages'),
        ),
        migrations.AddField(
            model_name='systemmodule',
            name='icon',
            field=models.CharField(max_length=50, blank=True, default='', help_text="Lucide icon name (e.g. 'shopping-cart', 'bar-chart')"),
        ),
    ]
