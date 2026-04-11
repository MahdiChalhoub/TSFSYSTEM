from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_org_tax_policy_counterparty_profile'),
    ]

    operations = [
        migrations.CreateModel(
            name='PeriodicTaxAccrual',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    db_column='organization_id',
                    on_delete=models.CASCADE,
                    to='erp.organization',
                )),
                ('period_start', models.DateField()),
                ('period_end',   models.DateField()),
                ('tax_type', models.CharField(
                    max_length=10,
                    choices=[
                        ('TURNOVER', 'Turnover Tax'),
                        ('PROFIT',   'Profit Tax'),
                        ('FORFAIT',  'Fixed Forfait'),
                    ]
                )),
                ('base_amount',    models.DecimalField(decimal_places=2, default='0.00', max_digits=15)),
                ('rate',           models.DecimalField(decimal_places=4, default='0.0000', max_digits=6)),
                ('accrual_amount', models.DecimalField(decimal_places=2, default='0.00', max_digits=15)),
                ('journal_entry_id', models.IntegerField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[('DRAFT', 'Draft'), ('POSTED', 'Posted'), ('REVERSED', 'Reversed')],
                    default='DRAFT', max_length=10
                )),
                ('policy_name',  models.CharField(blank=True, max_length=150, null=True)),
                ('created_at',   models.DateTimeField(auto_now_add=True, null=True)),
                ('created_by_id', models.IntegerField(blank=True, null=True)),
            ],
            options={'db_table': 'periodic_tax_accrual', 'ordering': ['-period_end', 'tax_type']},
        ),
        migrations.AlterUniqueTogether(
            name='periodictaxaccrual',
            unique_together={('organization', 'period_start', 'period_end', 'tax_type')},
        ),
    ]
