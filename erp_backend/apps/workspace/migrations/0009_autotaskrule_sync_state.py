"""
State-only sync migration.

Prior migrations (0002, 0003, 0004, 0008) already added the following columns
and indexes to `workspace_auto_task_rule`, but models.py was later rewritten
and lost the corresponding field declarations. This left Django's model state
out of sync with the DB, causing FieldError at runtime when code referenced
`assign_to_user`, `broadcast_to_role`, `last_fired_at`, etc.

models.py now declares these fields. This migration uses
SeparateDatabaseAndState to advance Django's internal state WITHOUT touching
the database (the columns and indexes already exist).
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0008_auto_task_rule_v2_extended'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='autotaskrule',
                    name='assign_to_user',
                    field=models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='auto_task_rules_assigned',
                        to=settings.AUTH_USER_MODEL,
                        help_text='Assign generated task to this specific user (overrides role)',
                    ),
                ),
                migrations.AddField(
                    model_name='autotaskrule',
                    name='broadcast_to_role',
                    field=models.BooleanField(
                        default=False,
                        help_text='If True, create a task for EVERY user in the assigned role',
                    ),
                ),
                migrations.AddField(
                    model_name='autotaskrule',
                    name='recurrence_time',
                    field=models.TimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='autotaskrule',
                    name='recurrence_day_of_week',
                    field=models.IntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='autotaskrule',
                    name='recurrence_day_of_month',
                    field=models.IntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='autotaskrule',
                    name='last_fired_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='autotaskrule',
                    name='chain_delay_minutes',
                    field=models.IntegerField(default=0),
                ),
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='stale_threshold_days',
                    field=models.IntegerField(default=3),
                ),
                migrations.AddIndex(
                    model_name='autotaskrule',
                    index=models.Index(
                        fields=['module', 'is_active'],
                        name='workspace_a_module_0a58d8_idx',
                    ),
                ),
                migrations.AddIndex(
                    model_name='autotaskrule',
                    index=models.Index(
                        fields=['rule_type', 'is_active'],
                        name='workspace_a_rule_ty_5b215a_idx',
                    ),
                ),
                migrations.AddIndex(
                    model_name='autotaskrule',
                    index=models.Index(
                        fields=['trigger_event'],
                        name='workspace_a_trigger_f667c0_idx',
                    ),
                ),
            ],
        ),
    ]
