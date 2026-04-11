"""
Migration: Create ListViewPolicy table for SaaS-level column/filter governance.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0023_user_iam_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='ListViewPolicy',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('view_key', models.CharField(help_text='List view identifier, e.g. "inventory_products", "crm_contacts". Use "*" for global default.', max_length=100)),
                ('config', models.JSONField(default=dict, help_text='Policy configuration (hidden_columns, hidden_filters, forced_columns, etc.)')),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True, default='', help_text='Admin notes about why this policy exists')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    blank=True,
                    help_text='NULL = global default for all organizations',
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='listview_policies',
                    to='erp.organization',
                )),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_listview_policies',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'List View Policy',
                'verbose_name_plural': 'List View Policies',
                'db_table': 'listview_policy',
                'ordering': ['view_key', 'organization'],
                'unique_together': {('organization', 'view_key')},
            },
        ),
    ]
