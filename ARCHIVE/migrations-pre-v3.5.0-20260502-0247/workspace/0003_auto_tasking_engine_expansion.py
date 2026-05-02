"""
Auto-Tasking Engine Expansion:
- Add rule_type (EVENT/RECURRING), module grouping, code
- Add recurrence fields (interval, time, day_of_week, day_of_month, last_fired_at)
- Add task chain support (chain_parent, chain_delay_minutes)
- Add broadcast_to_role, priority override, stale_threshold_days
- Add is_system_default flag
- Expand trigger_event choices (19 → 47 events)
- Add indexes for performance
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0002_autotaskrule_assign_to_user_and_more'),
    ]

    operations = [
        # ── Rule Type ──
        migrations.AddField(
            model_name='autotaskrule',
            name='rule_type',
            field=models.CharField(
                choices=[('EVENT', 'Event-Based'), ('RECURRING', 'Time-Based Recurring')],
                default='EVENT', max_length=10,
            ),
        ),

        # ── Module Grouping ──
        migrations.AddField(
            model_name='autotaskrule',
            name='module',
            field=models.CharField(
                choices=[
                    ('inventory', 'Inventory'), ('purchasing', 'Purchasing'),
                    ('finance', 'Finance'), ('crm', 'CRM'),
                    ('sales', 'Sales / POS'), ('hr', 'HR'),
                    ('system', 'System / Admin'),
                ],
                default='system', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='autotaskrule',
            name='code',
            field=models.CharField(
                blank=True, help_text='Rule code e.g. INV-01, PUR-03.',
                max_length=10, null=True,
            ),
        ),

        # ── Recurrence ──
        migrations.AddField(
            model_name='autotaskrule',
            name='recurrence_interval',
            field=models.CharField(
                blank=True, choices=[
                    ('DAILY', 'Daily'), ('WEEKLY', 'Weekly'),
                    ('MONTHLY', 'Monthly'), ('QUARTERLY', 'Quarterly'),
                ],
                max_length=10, null=True,
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

        # ── Task Chain ──
        migrations.AddField(
            model_name='autotaskrule',
            name='chain_parent',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='chain_children', to='workspace.autotaskrule',
            ),
        ),
        migrations.AddField(
            model_name='autotaskrule',
            name='chain_delay_minutes',
            field=models.IntegerField(default=0),
        ),

        # ── Assignment enhancements ──
        migrations.AddField(
            model_name='autotaskrule',
            name='broadcast_to_role',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='autotaskrule',
            name='priority',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='autotaskrule',
            name='stale_threshold_days',
            field=models.IntegerField(default=3),
        ),
        migrations.AddField(
            model_name='autotaskrule',
            name='is_system_default',
            field=models.BooleanField(default=False),
        ),

        # ── Indexes ──
        migrations.AddIndex(
            model_name='autotaskrule',
            index=models.Index(fields=['module', 'is_active'], name='wk_atr_module_active_idx'),
        ),
        migrations.AddIndex(
            model_name='autotaskrule',
            index=models.Index(fields=['rule_type', 'is_active'], name='wk_atr_ruletype_active_idx'),
        ),
        migrations.AddIndex(
            model_name='autotaskrule',
            index=models.Index(fields=['trigger_event'], name='wk_atr_trigger_idx'),
        ),

        # ── Expand trigger_event max_length to accommodate new longer keys ──
        migrations.AlterField(
            model_name='autotaskrule',
            name='trigger_event',
            field=models.CharField(max_length=30),
        ),
    ]
