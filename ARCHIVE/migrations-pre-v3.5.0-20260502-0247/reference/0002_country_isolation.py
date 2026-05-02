"""
Add SourcingCountry model to reference app.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('reference', '0001_initial'),
        ('erp', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SourcingCountry',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
                ('organization', models.ForeignKey(
                    db_column='tenant_id',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set',
                    to='erp.organization',
                )),
                ('country', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sourcing_activations',
                    to='reference.country',
                )),
                ('is_enabled', models.BooleanField(default=True)),
                ('notes', models.CharField(blank=True, default='', help_text='Optional notes', max_length=255)),
                ('display_order', models.PositiveIntegerField(default=0)),
            ],
            options={
                'db_table': 'ref_sourcing_countries',
                'ordering': ['display_order', 'country__name'],
            },
        ),
        migrations.AddConstraint(
            model_name='sourcingcountry',
            constraint=models.UniqueConstraint(
                fields=['organization', 'country'],
                name='unique_sourcing_country_per_org',
            ),
        ),
        migrations.AddIndex(
            model_name='sourcingcountry',
            index=models.Index(fields=['organization', 'is_enabled'], name='ref_sourci_org_idx'),
        ),
    ]
