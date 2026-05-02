from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('client_portal', '0004_clientportalconfig_storefront_theme'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientportalconfig',
            name='storefront_type',
            field=models.CharField(
                choices=[
                    ('PRODUCT_STORE', 'Product Store — full e-commerce with cart and checkout'),
                    ('CATALOGUE', 'Catalogue — browse products, request quotes, no direct checkout'),
                    ('SUBSCRIPTION', 'Subscription Store — recurring plans and pricing tiers'),
                    ('LANDING_PAGE', 'Landing Page — company website with hero, about, and contact'),
                    ('PORTFOLIO', 'Portfolio — showcase projects, case studies, and inquiries'),
                ],
                default='PRODUCT_STORE',
                help_text='Type of storefront layout',
                max_length=30,
            ),
        ),
    ]
