"""
Create PackageUpload model for Package Storage Center.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ('erp', '0003_remove_organization_is_read_only_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='PackageUpload',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('package_type', models.CharField(choices=[('kernel', 'Backend Kernel'), ('frontend', 'Frontend Kernel'), ('module', 'Module')], max_length=20)),
                ('name', models.CharField(max_length=100)),
                ('version', models.CharField(max_length=50)),
                ('file', models.FileField(blank=True, null=True, upload_to='packages/')),
                ('file_size', models.BigIntegerField(default=0)),
                ('upload_progress', models.IntegerField(default=0)),
                ('checksum', models.CharField(blank=True, max_length=64, null=True)),
                ('status', models.CharField(choices=[('uploading', 'Uploading'), ('ready', 'Ready'), ('scheduled', 'Scheduled'), ('applying', 'Applying'), ('applied', 'Applied'), ('failed', 'Failed'), ('rolled_back', 'Rolled Back')], default='uploading', max_length=20)),
                ('changelog', models.TextField(blank=True)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('scheduled_for', models.DateTimeField(blank=True, null=True)),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('manifest', models.JSONField(blank=True, default=dict)),
                ('backup_path', models.CharField(blank=True, max_length=500, null=True)),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_packages', to=settings.AUTH_USER_MODEL)),
                ('applied_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='applied_packages', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'PackageUpload',
                'ordering': ['-uploaded_at'],
            },
        ),
    ]
