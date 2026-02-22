"""
Migration for OrgListDefault and UserListPreference models.
Supports the Universal List Component preference system.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrgListDefault',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('list_key', models.CharField(help_text="Unique list identifier, e.g. inventory.products, inventory.transfers", max_length=100)),
                ('visible_columns', models.JSONField(default=list, help_text='Ordered list of column keys to display')),
                ('default_filters', models.JSONField(default=dict, help_text='Default filter values as key:value pairs')),
                ('page_size', models.IntegerField(default=25)),
                ('sort_column', models.CharField(blank=True, default='', max_length=100)),
                ('sort_direction', models.CharField(choices=[('asc', 'Ascending'), ('desc', 'Descending')], default='asc', max_length=4)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='list_defaults', to='erp.organization')),
            ],
            options={
                'db_table': 'org_list_default',
                'unique_together': {('organization', 'list_key')},
            },
        ),
        migrations.CreateModel(
            name='UserListPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('list_key', models.CharField(max_length=100)),
                ('visible_columns', models.JSONField(default=list, help_text='Ordered list of column keys to display')),
                ('default_filters', models.JSONField(default=dict, help_text='Saved filter values')),
                ('page_size', models.IntegerField(default=25)),
                ('sort_column', models.CharField(blank=True, default='', max_length=100)),
                ('sort_direction', models.CharField(choices=[('asc', 'Ascending'), ('desc', 'Descending')], default='asc', max_length=4)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_list_preferences', to='erp.organization')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='list_preferences', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_list_preference',
                'unique_together': {('user', 'organization', 'list_key')},
            },
        ),
    ]
