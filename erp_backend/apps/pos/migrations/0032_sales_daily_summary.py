"""
Migration 0032 — SalesDailySummary
=====================================
Gap 9 (ERP Roadmap): Adds sales_daily_summary table.
Pre-aggregated daily analytics per site + scope.
"""
from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0031_sales_audit_log'),
        ('inventory', '0008_stock_ledger'),
    ]

    operations = [
        migrations.CreateModel(
            name='SalesDailySummary',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                )),
                ('date',  models.DateField(db_index=True)),
                ('site',  models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='daily_summaries',
                    to='inventory.warehouse',
                )),
                ('scope', models.CharField(max_length=20, default='OFFICIAL')),
                # Order counts
                ('orders_total',     models.IntegerField(default=0)),
                ('orders_confirmed', models.IntegerField(default=0)),
                ('orders_delivered', models.IntegerField(default=0)),
                ('orders_paid',      models.IntegerField(default=0)),
                ('orders_cancelled', models.IntegerField(default=0)),
                ('orders_draft',     models.IntegerField(default=0)),
                # Revenue
                ('revenue_ht',      models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('revenue_ttc',     models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('tax_collected',   models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('airsi_withheld',  models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('discount_total',  models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                # COGS & Margin
                ('cogs_total',       models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('gross_margin',     models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('gross_margin_pct', models.DecimalField(max_digits=7,  decimal_places=2, default=Decimal('0'))),
                # Payment breakdown
                ('cash_total',   models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('mobile_total', models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('credit_total', models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('bank_total',   models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                ('other_total',  models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))),
                # Line metrics
                ('items_sold',       models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))),
                ('unique_products',  models.IntegerField(default=0)),
                ('unique_customers', models.IntegerField(default=0)),
                # Metadata
                ('computed_at', models.DateTimeField(auto_now=True)),
                ('order_ids',   models.JSONField(default=list, blank=True)),
            ],
            options={
                'db_table': 'sales_daily_summary',
                'ordering': ['-date', 'scope'],
                'indexes': [
                    models.Index(
                        fields=['organization', 'date', 'scope'],
                        name='sds_org_date_scope_idx',
                    ),
                    models.Index(
                        fields=['organization', 'site', 'date'],
                        name='sds_org_site_date_idx',
                    ),
                ],
            },
        ),
        migrations.AlterUniqueTogether(
            name='salesdailysummary',
            unique_together={('organization', 'site', 'scope', 'date')},
        ),
    ]
