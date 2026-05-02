"""
Migration: Add FinancialAccountCategory model and FK on FinancialAccount.
Seeds 8 default categories with friendly names, icons, and colors.
Backfills existing FinancialAccount rows by matching type → category code.
"""
from django.db import migrations, models
import django.db.models.deletion


DEFAULT_CATEGORIES = [
    {'code': 'CASH',       'name': 'Cash Drawers',      'icon': 'banknote',     'color': '#16a34a', 'description': 'Physical cash registers & drawers',     'sort_order': 1},
    {'code': 'BANK',       'name': 'Bank Accounts',     'icon': 'building',     'color': '#2563eb', 'description': 'Business bank accounts',                 'sort_order': 2},
    {'code': 'MOBILE',     'name': 'Electronic Money',  'icon': 'smartphone',   'color': '#f59e0b', 'description': 'Wave, Orange Money, Mobile Wallets',     'sort_order': 3},
    {'code': 'PETTY_CASH', 'name': 'Petty Cash',        'icon': 'briefcase',    'color': '#8b5cf6', 'description': 'Small expense funds',                    'sort_order': 4},
    {'code': 'SAVINGS',    'name': 'Savings',           'icon': 'piggy-bank',   'color': '#06b6d4', 'description': 'Savings & reserve accounts',             'sort_order': 5},
    {'code': 'FOREIGN',    'name': 'Foreign Currency',  'icon': 'globe-2',      'color': '#ec4899', 'description': 'Multi-currency accounts',                'sort_order': 6},
    {'code': 'ESCROW',     'name': 'Escrow',            'icon': 'lock',         'color': '#64748b', 'description': 'Held funds & escrow accounts',           'sort_order': 7},
    {'code': 'INVESTMENT', 'name': 'Investments',       'icon': 'trending-up',  'color': '#ea580c', 'description': 'Investment & growth accounts',           'sort_order': 8},
]


def seed_categories(apps, schema_editor):
    """Seed default categories for every organization, then backfill FinancialAccount.category."""
    FinancialAccountCategory = apps.get_model('finance', 'FinancialAccountCategory')
    FinancialAccount = apps.get_model('finance', 'FinancialAccount')
    Organization = apps.get_model('erp', 'Organization')

    for org in Organization.objects.all():
        code_to_cat = {}
        for cat_data in DEFAULT_CATEGORIES:
            cat, _ = FinancialAccountCategory.objects.get_or_create(
                organization=org,
                code=cat_data['code'],
                defaults={
                    'name': cat_data['name'],
                    'icon': cat_data['icon'],
                    'color': cat_data['color'],
                    'description': cat_data['description'],
                    'sort_order': cat_data['sort_order'],
                    'is_active': True,
                }
            )
            code_to_cat[cat_data['code']] = cat

        # Backfill: link existing FinancialAccount rows to their matching category
        for fa in FinancialAccount.objects.filter(organization=org, category__isnull=True):
            if fa.type and fa.type in code_to_cat:
                fa.category = code_to_cat[fa.type]
                fa.save(update_fields=['category'])


def reverse_seed(apps, schema_editor):
    """No-op reverse — categories will be dropped with the table."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0041_coa_architecture_hardening'),
        ('erp', '0001_initial'),
    ]

    operations = [
        # 1. Create FinancialAccountCategory table
        migrations.CreateModel(
            name='FinancialAccountCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Friendly name (e.g. "Cash Drawers", "Electronic Money")', max_length=100)),
                ('code', models.CharField(help_text='Machine code (e.g. "CASH", "MOBILE")', max_length=30)),
                ('icon', models.CharField(blank=True, default='wallet', help_text='Lucide icon name', max_length=50)),
                ('color', models.CharField(blank=True, default='#6366f1', help_text='Hex color', max_length=20)),
                ('description', models.TextField(blank=True, default='')),
                ('sort_order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='+',
                    to='erp.organization',
                )),
                ('coa_parent', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='financial_account_categories',
                    to='finance.chartofaccount',
                    help_text='Parent COA account — new financial accounts become sub-accounts of this'
                )),
            ],
            options={
                'db_table': 'financial_account_category',
                'ordering': ['sort_order', 'name'],
                'unique_together': {('organization', 'code')},
            },
        ),

        # 2. Add category FK on FinancialAccount
        migrations.AddField(
            model_name='financialaccount',
            name='category',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='accounts',
                to='finance.financialaccountcategory',
                help_text='Dynamic category (replaces hardcoded type field)'
            ),
        ),

        # 3. Seed default categories and backfill
        migrations.RunPython(seed_categories, reverse_seed),
    ]
