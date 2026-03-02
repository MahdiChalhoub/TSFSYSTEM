"""
CRM Migration 0007: Add commercial_category and tax_profile_id to Contact.
These support the new universal tax engine (CounterpartyTaxProfile).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0006_contact_client_type'),
        ('finance', '0006_org_tax_policy_counterparty_profile'),
    ]

    operations = [
        migrations.AddField(
            model_name='contact',
            name='commercial_category',
            field=models.CharField(
                blank=True, null=True, default='NORMAL', max_length=20,
                help_text='Commercial label only — no fiscal effect.'
            ),
        ),
        migrations.AddField(
            model_name='contact',
            name='tax_profile_id',
            field=models.IntegerField(
                blank=True, null=True, db_column='tax_profile_id',
                help_text='FK to CounterpartyTaxProfile'
            ),
        ),
    ]
