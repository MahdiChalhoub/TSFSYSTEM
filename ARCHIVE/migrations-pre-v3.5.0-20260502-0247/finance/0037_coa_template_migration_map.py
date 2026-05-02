"""
Migration: COATemplateMigrationMap
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0036_coa_template'),
    ]

    operations = [
        migrations.CreateModel(
            name='COATemplateMigrationMap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_account_code', models.CharField(help_text='Account code in the source template', max_length=20)),
                ('target_account_code', models.CharField(help_text='Corresponding account code in the target template', max_length=20)),
                ('notes', models.CharField(blank=True, default='', help_text='Optional notes about this mapping', max_length=200)),
                ('source_template', models.ForeignKey(
                    help_text='Source COA template',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='migration_maps_from',
                    to='finance.coatemplate',
                )),
                ('target_template', models.ForeignKey(
                    help_text='Target COA template',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='migration_maps_to',
                    to='finance.coatemplate',
                )),
            ],
            options={
                'db_table': 'finance_coa_template_migration_map',
                'ordering': ['source_account_code'],
                'unique_together': {('source_template', 'target_template', 'source_account_code')},
            },
        ),
    ]
