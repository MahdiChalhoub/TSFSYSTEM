"""
Migration 0030: Phase B — Contextual Posting Rules
===================================================
- ContextualPostingRule model (context-aware overrides)
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0031_merge_compound_tax_and_enterprise_posting'),
        ('erp', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContextualPostingRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_code', models.CharField(db_index=True, help_text='Copied from base_rule for fast lookup', max_length=80)),
                ('context_type', models.CharField(
                    choices=[
                        ('WAREHOUSE', 'Per Warehouse'), ('BRANCH', 'Per Branch'),
                        ('PRODUCT_CATEGORY', 'Per Product Category'),
                        ('COUNTERPARTY_TYPE', 'Per Counterparty Type'),
                        ('PAYMENT_METHOD', 'Per Payment Method'),
                        ('CURRENCY', 'Per Currency'), ('CUSTOM', 'Custom Context'),
                    ],
                    help_text='Primary context dimension', max_length=20,
                )),
                ('context_value', models.CharField(help_text='Value to match', max_length=100)),
                ('priority', models.SmallIntegerField(default=0, help_text='Higher priority wins')),
                ('description', models.CharField(blank=True, default='', max_length=200)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('base_rule', models.ForeignKey(
                    help_text='Base posting rule this overrides',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='contextual_overrides',
                    to='finance.postingrule',
                )),
                ('account', models.ForeignKey(
                    help_text='Override GL account',
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='contextual_posting_rules',
                    to='finance.chartofaccount',
                )),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                )),
            ],
            options={
                'db_table': 'finance_contextual_posting_rule',
                'ordering': ['-priority', 'event_code'],
            },
        ),
        migrations.AddIndex(
            model_name='contextualpostingrule',
            index=models.Index(fields=['organization', 'event_code', 'is_active'], name='cpr_org_event_idx'),
        ),
        migrations.AddIndex(
            model_name='contextualpostingrule',
            index=models.Index(fields=['organization', 'context_type', 'context_value'], name='cpr_ctx_idx'),
        ),
    ]
