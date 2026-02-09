# Hand-written migration: SaaSClient model + Organization.client FK
# Replaces billing_contact_id with proper FK relationship

import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0036_subscriptionpayment_invoice_type'),
    ]

    operations = [
        # 1. Create SaaSClient table
        migrations.CreateModel(
            name='SaaSClient',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('first_name', models.CharField(max_length=100)),
                ('last_name', models.CharField(max_length=100)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('phone', models.CharField(blank=True, default='', max_length=50)),
                ('company_name', models.CharField(blank=True, default='', help_text='Legal company name if different from person name', max_length=255)),
                ('address', models.TextField(blank=True, default='')),
                ('city', models.CharField(blank=True, default='', max_length=100)),
                ('country', models.CharField(blank=True, default='', max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'SaaSClient',
                'ordering': ['-created_at'],
            },
        ),

        # 2. Remove old billing_contact_id from Organization
        migrations.RemoveField(
            model_name='organization',
            name='billing_contact_id',
        ),

        # 3. Add client FK to Organization
        migrations.AddField(
            model_name='organization',
            name='client',
            field=models.ForeignKey(
                blank=True,
                help_text='Account owner / billing contact',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='organizations',
                to='erp.saasclient',
            ),
        ),
    ]
