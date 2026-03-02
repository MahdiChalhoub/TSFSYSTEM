from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0027_remove_possettings_invoice_footer_text_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderLineTaxEntry',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    db_column='organization_id',
                    on_delete=models.CASCADE,
                    to='erp.organization',
                )),
                ('order_line_id', models.IntegerField(db_column='order_line_id')),
                ('transaction_type', models.CharField(
                    choices=[('SALE', 'Sale'), ('PURCHASE', 'Purchase')],
                    default='SALE', max_length=10
                )),
                ('tax_type', models.CharField(
                    choices=[
                        ('VAT', 'VAT'), ('VAT_REVERSE_CHARGE', 'VAT Reverse Charge'),
                        ('AIRSI', 'AIRSI'), ('PURCHASE_TAX', 'Purchase Tax'),
                        ('SALES_TAX', 'Sales Tax'), ('EXCISE', 'Excise'),
                        ('STAMP', 'Stamp'), ('OTHER', 'Other'),
                    ],
                    max_length=25
                )),
                ('rate', models.DecimalField(decimal_places=4, default=0, max_digits=7)),
                ('base_amount', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('amount', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('cost_impact_ratio', models.DecimalField(decimal_places=3, default=0, max_digits=4)),
                ('cost_impact_amount', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('journal_account_id', models.IntegerField(blank=True, null=True)),
                ('airsi_treatment', models.CharField(
                    blank=True, max_length=12,
                    choices=[('CAPITALIZE', 'Capitalize'), ('RECOVER', 'Recover'), ('EXPENSE', 'Expense')],
                    null=True
                )),
                ('scope', models.CharField(
                    choices=[('OFFICIAL', 'Official'), ('INTERNAL', 'Internal')],
                    default='OFFICIAL', max_length=10
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
            ],
            options={'db_table': 'order_line_tax_entry', 'ordering': ['order_line_id', 'tax_type']},
        ),
        migrations.AddIndex(
            model_name='orderlinetaxentry',
            index=models.Index(
                fields=['order_line_id', 'transaction_type'],
                name='tax_entry_line_idx'
            ),
        ),
    ]
