"""
Phase 6.1 — COA Migration Session & Account Plan models.

Adds:
- finance_coa_migration_session: Top-level migration lifecycle tracker
- finance_coa_migration_account_plan: Per-account migration decision
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0039_populate_template_accounts'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── COAMigrationSession ──
        migrations.CreateModel(
            name='COAMigrationSession',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                    help_text='Tenant organization',
                )),
                ('source_template', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='migration_sessions_as_source',
                    to='finance.coatemplate',
                    help_text='Template being migrated FROM',
                )),
                ('target_template', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='migration_sessions_as_target',
                    to='finance.coatemplate',
                    help_text='Template being migrated TO',
                )),
                ('migration_date', models.DateTimeField(null=True, blank=True, help_text='Cutover datetime')),
                ('status', models.CharField(max_length=20, default='DRAFT', help_text='Lifecycle stage')),
                ('approved_at', models.DateTimeField(null=True, blank=True)),
                ('approved_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True, blank=True, related_name='approved_coa_migrations',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('executed_at', models.DateTimeField(null=True, blank=True)),
                ('executed_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True, blank=True, related_name='executed_coa_migrations',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('phase_a_completed_at', models.DateTimeField(null=True, blank=True)),
                ('phase_b_completed_at', models.DateTimeField(null=True, blank=True)),
                ('dry_run_report', models.JSONField(null=True, blank=True)),
                ('execution_report', models.JSONField(null=True, blank=True)),
                ('error_report', models.JSONField(null=True, blank=True)),
                ('validation_report', models.JSONField(null=True, blank=True)),
                ('version', models.PositiveIntegerField(default=1)),
                ('is_locked', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'finance_coa_migration_session',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='coamigrationsession',
            index=models.Index(fields=['organization', 'status'], name='coamig_org_status_idx'),
        ),

        # ── COAMigrationAccountPlan ──
        migrations.CreateModel(
            name='COAMigrationAccountPlan',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='account_plans',
                    to='finance.coamigrationsession',
                )),
                ('source_account', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True, blank=True, related_name='migration_plans_as_source',
                    to='finance.chartofaccount',
                )),
                ('target_account_code', models.CharField(max_length=20, blank=True, default='')),
                ('target_account_name', models.CharField(max_length=200, blank=True, default='')),
                ('migration_mode', models.CharField(max_length=30, default='MANUAL_REVIEW')),
                ('is_mode_overridden', models.BooleanField(default=False)),
                ('balance_at_migration', models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)),
                ('journal_line_count', models.PositiveIntegerField(default=0)),
                ('posting_rule_count', models.PositiveIntegerField(default=0)),
                ('financial_account_count', models.PositiveIntegerField(default=0)),
                ('children_count', models.PositiveIntegerField(default=0)),
                ('historically_locked', models.BooleanField(default=False)),
                ('has_posting_rules', models.BooleanField(default=False)),
                ('has_financial_accounts', models.BooleanField(default=False)),
                ('allocation_percent', models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)),
                ('group_key', models.CharField(max_length=50, blank=True, default='')),
                ('is_executed', models.BooleanField(default=False)),
                ('execution_notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'finance_coa_migration_account_plan',
                'ordering': ['source_account__code'],
            },
        ),
        migrations.AddIndex(
            model_name='coamigrationaccountplan',
            index=models.Index(fields=['session', 'migration_mode'], name='coamigacct_mode_idx'),
        ),
        migrations.AddIndex(
            model_name='coamigrationaccountplan',
            index=models.Index(fields=['session', 'is_executed'], name='coamigacct_exec_idx'),
        ),
    ]
