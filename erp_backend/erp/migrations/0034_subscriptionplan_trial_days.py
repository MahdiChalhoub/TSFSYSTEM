"""
Manual migration: Add trial_days to SubscriptionPlan.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0033_add_plan_addon_and_visibility'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionplan',
            name='trial_days',
            field=models.IntegerField(default=0, help_text='Free trial duration in days. 0 = no trial.'),
        ),
    ]
