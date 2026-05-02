# 0021_merge_20260311_0135.py
#
# MERGE STRATEGY:
#   - 0020_contact_compliance_last_checked_and_more  ✅ Applied (compliance fields + ComplianceEvent/Rule/Override tables)
#   - 0020_contact_assigned_owner_and_more           ❌ Skipped (was fake-applied via --fake)
#
# This migration adds ONLY the fields from 0020_contact_assigned_owner
# that were NOT already applied by 0020_contact_compliance_last_checked.
#
# Fields already in DB (skip):
#   compliance_last_checked, compliance_next_expiry, compliance_risk_level,
#   compliance_score, compliance_status, is_active, replaced_by, review_status,
#   version (on contactcompliancedocument)
#   ComplianceEvent, ComplianceRule, ComplianceOverride (tables)
#
# Fields to add here (NEW):
#   contact.assigned_owner, followup_status, interaction_score,
#   last_call_at, last_interaction_at, last_order_at, last_visit_at,
#   next_scheduled_activity_at, next_scheduled_activity_type
#   contactcompliancedocument.file_hash, is_immutable
#   Tables: ComplianceRule columns (version, escalation_chain, branch_id added),
#           FollowUpPolicy, InteractionLog, RelationshipAssignment,
#           ScheduledActivity, ActivityReminder, SupplierProductPolicy

import django.db.models.deletion
import django.utils.timezone
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0020_contact_assigned_owner_and_more'),
        ('crm', '0020_contact_compliance_last_checked_and_more'),
        ('crm', '0021_fix_interaction_models_choices'),
        ('erp', '0020_organization_finance_hard_locked_at_and_more'),
        ('inventory', '0021_goodsreceipt_approved_by_goodsreceipt_assigned_to_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Contact new fields ───────────────────────────────────
        migrations.AlterField(
            model_name='contact',
            name='assigned_owner',
            field=models.ForeignKey(
                blank=True,
                help_text='The primary user responsible for this contact',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assigned_contacts',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='contact',
            name='followup_status',
            field=models.CharField(
                choices=[
                    ('ON_TRACK', 'On Track'),
                    ('DUE_SOON', 'Follow-up Due Soon'),
                    ('OVERDUE', 'Follow-up Overdue'),
                    ('DORMANT', 'Dormant (No interaction >30d)'),
                    ('NO_OWNER', 'No Owner Assigned'),
                ],
                default='ON_TRACK',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='contact',
            name='interaction_score',
            field=models.IntegerField(
                default=0,
                help_text='Computed score based on interaction frequency and outcome',
            ),
        ),
        migrations.AlterField(
            model_name='contact',
            name='last_call_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='contact',
            name='last_interaction_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='contact',
            name='last_order_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='contact',
            name='last_visit_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='contact',
            name='next_scheduled_activity_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='contact',
            name='next_scheduled_activity_type',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        # ── ContactComplianceDocument new fields ─────────────────
        migrations.AlterField(
            model_name='contactcompliancedocument',
            name='file_hash',
            field=models.CharField(
                blank=True,
                help_text='SHA-256 Checksum for legal non-repudiation',
                max_length=64,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='contactcompliancedocument',
            name='is_immutable',
            field=models.BooleanField(
                default=False,
                help_text='If True, document cannot be deleted or modified',
            ),
        ),
        # ── ComplianceRule NEW columns (version, branch_id, escalation_chain) ──
        migrations.AddField(
            model_name='compliancerule',
            name='version',
            field=models.IntegerField(default=1),
        ),
        migrations.AddField(
            model_name='compliancerule',
            name='branch_id',
            field=models.IntegerField(
                blank=True,
                help_text='Specific branch scope (Optional)',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='compliancerule',
            name='escalation_chain',
            field=models.JSONField(blank=True, default=list),
        ),
        # ── New tables ───────────────────────────────────────────
        migrations.CreateModel(
            name='FollowUpPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('action_type', models.CharField(choices=[('CALL', 'Call'), ('VISIT', 'Visit'), ('WHATSAPP', 'WhatsApp'), ('EMAIL', 'Email'), ('MEETING', 'Meeting'), ('REORDER_REVIEW', 'Reorder Review'), ('PAYMENT_FOLLOWUP', 'Payment Follow-up')], max_length=30)),
                ('trigger_type', models.CharField(choices=[('FIXED_INTERVAL', 'Fixed Interval'), ('STOCK_LEVEL', 'Stock Level'), ('NO_ORDER_SINCE', 'No Order Since'), ('NO_INTERACTION_SINCE', 'No Interaction Since'), ('EXPIRY_WINDOW', 'Expiry Window'), ('MANUAL', 'Manual')], max_length=30)),
                ('interval_days', models.PositiveIntegerField(blank=True, help_text='Frequency in days', null=True)),
                ('lead_days', models.PositiveIntegerField(default=0, help_text='Days before due date to create the task')),
                ('preferred_weekday', models.PositiveIntegerField(blank=True, choices=[(0, 'Monday'), (1, 'Tuesday'), (2, 'Wednesday'), (3, 'Thursday'), (4, 'Friday'), (5, 'Saturday'), (6, 'Sunday')], null=True)),
                ('preferred_time', models.TimeField(blank=True, null=True)),
                ('stock_threshold', models.DecimalField(blank=True, decimal_places=3, max_digits=14, null=True)),
                ('no_order_days', models.PositiveIntegerField(blank=True, null=True)),
                ('no_interaction_days', models.PositiveIntegerField(blank=True, null=True)),
                ('is_mandatory', models.BooleanField(default=False)),
                ('auto_create_next', models.BooleanField(default=True, help_text='Automatically create next recurring activity upon completion')),
                ('active', models.BooleanField(default=True)),
                ('priority', models.CharField(default='NORMAL', max_length=20)),
                ('notes_template', models.TextField(blank=True, help_text='Pre-fill activity notes with this template')),
                ('auto_create_task', models.BooleanField(default=True)),
                ('auto_create_reminder', models.BooleanField(default=True)),
                ('reminder_offset_value', models.PositiveIntegerField(default=1)),
                ('reminder_offset_unit', models.CharField(choices=[('MINUTE', 'Minute'), ('HOUR', 'Hour'), ('DAY', 'Day')], default='DAY', max_length=10)),
                ('auto_schedule_next_from', models.CharField(choices=[('DUE_DATE', 'Due Date'), ('COMPLETION_DATE', 'Completion Date')], default='COMPLETION_DATE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('branch', models.ForeignKey(blank=True, help_text='Scope to a specific branch', null=True, on_delete=django.db.models.deletion.SET_NULL, to='inventory.warehouse')),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='followup_policies', to='crm.contact')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
            ],
            options={'db_table': 'crm_followup_policy'},
        ),
        migrations.CreateModel(
            name='InteractionLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(choices=[('CALL', 'Call'), ('VISIT', 'Visit'), ('WHATSAPP', 'WhatsApp'), ('EMAIL', 'Email'), ('MEETING', 'Meeting'), ('SYSTEM', 'System'), ('ORDER', 'Order')], max_length=20)),
                ('outcome', models.CharField(choices=[('SUCCESS', 'Success'), ('NO_ANSWER', 'No Answer'), ('POSTPONED', 'Postponed'), ('COMPLETED', 'Completed'), ('FAILED', 'Failed'), ('ORDER_CONFIRMED', 'Order Confirmed'), ('FOLLOW_UP_REQUIRED', 'Follow-up Required')], max_length=30)),
                ('subject', models.CharField(blank=True, max_length=255)),
                ('notes', models.TextField(blank=True)),
                ('interaction_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('next_action_type', models.CharField(blank=True, max_length=30)),
                ('next_action_at', models.DateTimeField(blank=True, null=True)),
                ('related_order_id', models.CharField(blank=True, max_length=50, null=True)),
                ('related_invoice_id', models.CharField(blank=True, max_length=50, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='interactions', to='crm.contact')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
                ('user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'crm_interaction_log', 'ordering': ['-interaction_at']},
        ),
        migrations.CreateModel(
            name='RelationshipAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entity_type', models.CharField(choices=[('CONTACT', 'Contact'), ('SUPPLIER', 'Supplier'), ('CUSTOMER', 'Customer')], max_length=20)),
                ('role', models.CharField(blank=True, help_text='e.g., Account Manager, Purchasing Officer, Sales Rep', max_length=50)),
                ('priority', models.CharField(choices=[('LOW', 'Low'), ('NORMAL', 'Normal'), ('HIGH', 'High'), ('STRATEGIC', 'Strategic')], default='NORMAL', max_length=20)),
                ('is_primary', models.BooleanField(default=True)),
                ('start_date', models.DateField(default=django.utils.timezone.now)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_relationship_assignments', to=settings.AUTH_USER_MODEL)),
                ('assigned_to', models.ForeignKey(help_text='The user responsible for this relationship', on_delete=django.db.models.deletion.CASCADE, related_name='owned_relationships', to=settings.AUTH_USER_MODEL)),
                ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inventory.warehouse')),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='crm.contact')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
            ],
            options={'db_table': 'crm_relationship_assignment', 'ordering': ['-is_active', '-is_primary', 'priority']},
        ),
        migrations.CreateModel(
            name='ScheduledActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action_type', models.CharField(choices=[('CALL', 'Call'), ('VISIT', 'Visit'), ('WHATSAPP', 'WhatsApp'), ('EMAIL', 'Email'), ('MEETING', 'Meeting'), ('REORDER_REVIEW', 'Reorder Review'), ('PAYMENT_FOLLOWUP', 'Payment Follow-up')], max_length=30)),
                ('source_type', models.CharField(choices=[('POLICY', 'Policy'), ('MANUAL', 'Manual'), ('SYSTEM', 'System'), ('COMPLIANCE', 'Compliance'), ('SALES', 'Sales'), ('PROCUREMENT', 'Procurement')], max_length=30)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('scheduled_for', models.DateTimeField()),
                ('due_date', models.DateTimeField()),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('priority', models.CharField(default='NORMAL', max_length=20)),
                ('status', models.CharField(choices=[('PLANNED', 'Planned'), ('DUE', 'Due'), ('OVERDUE', 'Overdue'), ('DONE', 'Done'), ('CANCELLED', 'Cancelled'), ('SKIPPED', 'Skipped'), ('RESCHEDULED', 'Rescheduled')], default='PLANNED', max_length=20)),
                ('is_auto_generated', models.BooleanField(default=True)),
                ('requires_note', models.BooleanField(default=False)),
                ('is_recurring', models.BooleanField(default=False)),
                ('recurrence_key', models.CharField(blank=True, help_text='Unique key to identify a chain of recurring tasks', max_length=100)),
                ('last_reminder_at', models.DateTimeField(blank=True, null=True)),
                ('next_reminder_at', models.DateTimeField(blank=True, null=True)),
                ('overdue_since', models.DateTimeField(blank=True, null=True)),
                ('postponed_count', models.PositiveIntegerField(default=0)),
                ('completion_note', models.TextField(blank=True)),
                ('reschedule_reason', models.TextField(blank=True)),
                ('manager_notified_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_scheduled_activities', to=settings.AUTH_USER_MODEL)),
                ('assigned_to', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='scheduled_activities', to=settings.AUTH_USER_MODEL)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activities', to='crm.contact')),
                ('followup_policy', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='crm.followuppolicy')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
            ],
            options={'db_table': 'crm_scheduled_activity', 'ordering': ['due_date', 'priority']},
        ),
        migrations.CreateModel(
            name='ActivityReminder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(choices=[('IN_APP', 'In App'), ('EMAIL', 'Email'), ('SMS', 'SMS'), ('WHATSAPP', 'WhatsApp'), ('PUSH', 'Push')], default='IN_APP', max_length=20)),
                ('remind_at', models.DateTimeField()),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('SENT', 'Sent'), ('FAILED', 'Failed'), ('CANCELLED', 'Cancelled')], default='PENDING', max_length=20)),
                ('message', models.TextField(blank=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True)),
                ('is_auto_generated', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activity_reminders', to=settings.AUTH_USER_MODEL)),
                ('scheduled_activity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reminders', to='crm.scheduledactivity')),
            ],
            options={'db_table': 'crm_activity_reminder', 'ordering': ['remind_at']},
        ),
        migrations.CreateModel(
            name='SupplierProductPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reorder_mode', models.CharField(choices=[('FIXED_DAYS', 'Fixed Days'), ('MIN_STOCK', 'Minimum Stock'), ('SALES_VELOCITY', 'Sales Velocity'), ('MANUAL', 'Manual')], default='MIN_STOCK', max_length=30)),
                ('review_every_days', models.PositiveIntegerField(blank=True, null=True)),
                ('min_stock_level', models.DecimalField(blank=True, decimal_places=3, max_digits=14, null=True)),
                ('safety_stock', models.DecimalField(blank=True, decimal_places=3, max_digits=14, null=True)),
                ('lead_time_days', models.PositiveIntegerField(default=0)),
                ('preferred_supplier', models.BooleanField(default=False)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_buyer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inventory.warehouse')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='inventory.product')),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='supplier_product_policies', to='crm.contact')),
            ],
            options={
                'db_table': 'crm_supplier_product_policy',
                'unique_together': {('organization', 'supplier', 'product', 'branch')},
            },
        ),
    ]
