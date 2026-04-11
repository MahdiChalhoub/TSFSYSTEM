"""
Add country_of_origin FK and origin_countries M2M for country isolation.
Product gets country_of_origin -> reference.Country
Brand gets origin_countries M2M -> reference.Country
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0032_add_country_to_warehouse'),
        ('reference', '0002_country_isolation'),
    ]

    operations = [
        # Product: add country_of_origin FK to reference.Country
        migrations.AddField(
            model_name='product',
            name='country_of_origin',
            field=models.ForeignKey(
                blank=True,
                help_text='Country of origin/fabrication (from ref_countries sourcing list)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='origin_products',
                to='reference.country',
            ),
        ),
        # Brand: add origin_countries M2M to reference.Country
        migrations.AddField(
            model_name='brand',
            name='origin_countries',
            field=models.ManyToManyField(
                blank=True,
                help_text='Countries of origin for this brand (from ref_countries)',
                related_name='origin_brands',
                to='reference.country',
            ),
        ),
    ]
