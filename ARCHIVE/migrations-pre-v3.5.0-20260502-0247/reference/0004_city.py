"""
Migration 0004: Add City reference table.

Creates the ref_cities table for global city data linked to countries.
Used for cascading Country → City dropdowns in warehouse and other forms.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('reference', '0003_remove_sourcingcountry_unique_sourcing_country_per_org_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='City',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='City name (e.g., Beirut, Abidjan, Paris)', max_length=255)),
                ('state_province', models.CharField(blank=True, default='', help_text='State/Province/Region (e.g., Mount Lebanon, Île-de-France)', max_length=255)),
                ('is_capital', models.BooleanField(default=False, help_text='Whether this is the country capital')),
                ('is_active', models.BooleanField(default=True)),
                ('country', models.ForeignKey(
                    help_text='The country this city belongs to',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='cities',
                    to='reference.country',
                )),
            ],
            options={
                'db_table': 'ref_cities',
                'ordering': ['-is_capital', 'name'],
                'unique_together': {('country', 'name')},
                'verbose_name': 'City',
                'verbose_name_plural': 'Cities',
            },
        ),
        migrations.AddIndex(
            model_name='city',
            index=models.Index(fields=['country', 'is_active'], name='ref_cities_country_active_idx'),
        ),
    ]
