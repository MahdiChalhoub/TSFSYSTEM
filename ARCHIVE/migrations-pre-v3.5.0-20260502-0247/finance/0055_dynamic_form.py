from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0054_merge_20260412_0207'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FormDefinition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('organization', models.ForeignKey(db_column='tenant_id', on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
                ('key', models.SlugField(max_length=100)),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('schema', models.JSONField(default=dict)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('organization', 'key')},
            },
        ),
        migrations.CreateModel(
            name='FormResponse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('organization', models.ForeignKey(db_column='tenant_id', on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
                ('form_definition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='responses', to='finance.formdefinition')),
                ('entity_type', models.CharField(blank=True, max_length=100)),
                ('entity_id', models.PositiveIntegerField(blank=True, null=True)),
                ('data', models.JSONField(default=dict)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='form_responses', to=settings.AUTH_USER_MODEL)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
