"""Add created_at and updated_at timestamps to PrintSession.

Fixes models.E012 and models.E015 — Meta.ordering and Meta.indexes
referenced 'created_at' which didn't exist on the model.
"""
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0040_seed_system_label_templates'),
    ]

    operations = [
        migrations.AlterField(
            model_name='printsession',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='printsession',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
