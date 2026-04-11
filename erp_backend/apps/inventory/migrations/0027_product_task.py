"""
Migration 0027: Create ProductTask model for the task/notification engine.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0026_governance_models'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('task_type', models.CharField(choices=[
                    ('PRINT_LABEL', 'Print Label'),
                    ('SHELF_PLACEMENT', 'Shelf Placement'),
                    ('VERIFY_PRODUCT', 'Verify Product Data'),
                    ('REVIEW_PRICE', 'Review Price Change'),
                    ('COMPLETE_DATA', 'Complete Missing Data'),
                    ('PHOTO_UPLOAD', 'Upload Product Photo'),
                    ('CUSTOM', 'Custom Task'),
                ], max_length=20)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('priority', models.CharField(choices=[
                    ('LOW', 'Low'), ('MEDIUM', 'Medium'),
                    ('HIGH', 'High'), ('URGENT', 'Urgent'),
                ], default='MEDIUM', max_length=10)),
                ('status', models.CharField(choices=[
                    ('OPEN', 'Open'), ('IN_PROGRESS', 'In Progress'),
                    ('DONE', 'Done'), ('CANCELLED', 'Cancelled'),
                ], default='OPEN', max_length=15)),
                ('assigned_role', models.CharField(blank=True, default='', help_text='Role hint (e.g. shelf_manager, print_center, controller)', max_length=50)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('source_event', models.CharField(blank=True, default='', help_text='Governance event that triggered this task', max_length=20)),
                ('source_id', models.PositiveIntegerField(blank=True, help_text='ID of the source entity', null=True)),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='inventory.product')),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='product_tasks', to=settings.AUTH_USER_MODEL)),
                ('completed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='completed_product_tasks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'product_task',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='producttask',
            index=models.Index(fields=['organization', 'status', 'priority'], name='ptask_org_status_prio_idx'),
        ),
        migrations.AddIndex(
            model_name='producttask',
            index=models.Index(fields=['assigned_to', 'status'], name='ptask_assignee_status_idx'),
        ),
        migrations.AddIndex(
            model_name='producttask',
            index=models.Index(fields=['product', 'task_type'], name='ptask_product_type_idx'),
        ),
    ]
