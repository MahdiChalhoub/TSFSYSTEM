"""
Manual migration: Add is_public, sort_order to SubscriptionPlan + Create PlanAddon table.
Safe: Does NOT touch any other models.
"""
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0032_enforce_user_org_required'),
    ]

    operations = [
        # Add is_public to SubscriptionPlan
        migrations.AddField(
            model_name='subscriptionplan',
            name='is_public',
            field=models.BooleanField(default=True, help_text='Public plans show on landing/pricing page. Private plans are org-specific.'),
        ),
        # Add sort_order to SubscriptionPlan
        migrations.AddField(
            model_name='subscriptionplan',
            name='sort_order',
            field=models.IntegerField(default=0, help_text='Display order on pricing pages (lower = first)'),
        ),
        # Create PlanAddon table
        migrations.CreateModel(
            name='PlanAddon',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('addon_type', models.CharField(choices=[
                    ('users', 'Extra Users'),
                    ('sites', 'Extra Sites'),
                    ('storage', 'Extra Storage (GB)'),
                    ('products', 'Extra Products'),
                    ('invoices', 'Extra Invoices/Month'),
                    ('customers', 'Extra Customers'),
                ], max_length=20)),
                ('quantity', models.IntegerField(help_text='How much this add-on provides (e.g. 10 users, 50 GB)')),
                ('monthly_price', models.DecimalField(decimal_places=2, max_digits=15)),
                ('annual_price', models.DecimalField(decimal_places=2, max_digits=15)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('plans', models.ManyToManyField(blank=True, help_text='Plans that can use this add-on. Empty = available to all.', related_name='addons', to='erp.subscriptionplan')),
            ],
            options={
                'db_table': 'PlanAddon',
                'ordering': ['addon_type', 'monthly_price'],
            },
        ),
    ]
