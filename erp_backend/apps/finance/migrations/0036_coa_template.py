"""
Migration: COATemplate and COATemplatePostingRule
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0001_initial'),
        ('finance', '0035_merge_tax_account_and_policy_fks'),
    ]

    operations = [
        migrations.CreateModel(
            name='COATemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(db_index=True, help_text='Unique identifier, e.g. IFRS_COA', max_length=40)),
                ('name', models.CharField(help_text='Display name', max_length=100)),
                ('region', models.CharField(default='International', max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('icon', models.CharField(default='Globe', help_text='Lucide icon name for the frontend', max_length=30)),
                ('accent_color', models.CharField(default='var(--app-info)', help_text='CSS color for the template card accent', max_length=50)),
                ('is_system', models.BooleanField(default=False, help_text='System templates are seeded and cannot be deleted')),
                ('is_custom', models.BooleanField(default=False, help_text='Custom templates are user-created and per-organization')),
                ('accounts', models.JSONField(default=list, help_text='Full nested account tree as JSON array')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    blank=True, null=True,
                    help_text='Only set for custom (per-org) templates; NULL for system templates',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='coa_templates',
                    to='erp.organization',
                )),
            ],
            options={
                'db_table': 'finance_coa_template',
                'ordering': ['is_custom', 'name'],
            },
        ),
        migrations.AddIndex(
            model_name='coatemplate',
            index=models.Index(fields=['key', 'organization'], name='coatpl_key_org_idx'),
        ),
        migrations.CreateModel(
            name='COATemplatePostingRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_code', models.CharField(db_index=True, help_text='Posting event code, e.g. sales.invoice.receivable', max_length=80)),
                ('account_code', models.CharField(help_text='Target account code within this template', max_length=20)),
                ('module', models.CharField(default='', help_text='Module derived from event_code prefix', max_length=20)),
                ('description', models.CharField(blank=True, default='', help_text='Human-readable description', max_length=200)),
                ('template', models.ForeignKey(
                    help_text='Parent template',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='posting_rules',
                    to='finance.coatemplate',
                )),
            ],
            options={
                'db_table': 'finance_coa_template_posting_rule',
                'ordering': ['module', 'event_code'],
                'unique_together': {('template', 'event_code')},
            },
        ),
    ]
