# Generated manually for store_mode fields on 2026-02-19

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('client_portal', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientportalconfig',
            name='store_mode',
            field=models.CharField(
                choices=[
                    ('B2C', 'B2C eCommerce — standard retail prices'),
                    ('B2B', 'B2B Order Portal — tier/negotiated prices'),
                    ('CATALOG_QUOTE', 'Catalog + Quote — browse and request quotes'),
                    ('HYBRID', 'Hybrid — B2C interface, B2B pricing for wholesale/retail clients'),
                ],
                default='HYBRID',
                help_text='Controls pricing logic and checkout behavior',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='clientportalconfig',
            name='show_stock_levels',
            field=models.BooleanField(
                default=False,
                help_text='Show exact stock quantities (vs just In Stock / Out of Stock)',
            ),
        ),
        migrations.AddField(
            model_name='clientportalconfig',
            name='allow_guest_browsing',
            field=models.BooleanField(
                default=True,
                help_text='Allow unauthenticated users to browse the catalog',
            ),
        ),
        migrations.AddField(
            model_name='clientportalconfig',
            name='require_approval_for_orders',
            field=models.BooleanField(
                default=False,
                help_text='Orders require admin approval before processing (B2B mode)',
            ),
        ),
        migrations.AddField(
            model_name='clientportalconfig',
            name='storefront_title',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Custom title for the storefront (blank = org name)',
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name='clientportalconfig',
            name='storefront_tagline',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Tagline shown on the storefront landing page',
                max_length=500,
            ),
        ),
    ]
