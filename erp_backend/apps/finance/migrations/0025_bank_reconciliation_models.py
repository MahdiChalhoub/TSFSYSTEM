# Generated migration for bank reconciliation models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0024_add_performance_indexes'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BankStatement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('statement_date', models.DateField()),
                ('statement_number', models.CharField(blank=True, max_length=100, null=True)),
                ('opening_balance', models.DecimalField(decimal_places=2, max_digits=15)),
                ('closing_balance', models.DecimalField(decimal_places=2, max_digits=15)),
                ('calculated_closing', models.DecimalField(decimal_places=2, default='0.00', max_digits=15)),
                ('total_debits', models.DecimalField(decimal_places=2, default='0.00', max_digits=15)),
                ('total_credits', models.DecimalField(decimal_places=2, default='0.00', max_digits=15)),
                ('file', models.FileField(blank=True, null=True, upload_to='bank_statements/%Y/%m/')),
                ('status', models.CharField(choices=[('IMPORTED', 'Imported'), ('MATCHING', 'Matching in Progress'), ('PARTIAL', 'Partially Matched'), ('MATCHED', 'Fully Matched'), ('RECONCILED', 'Reconciled')], default='IMPORTED', max_length=20)),
                ('matched_count', models.IntegerField(default=0)),
                ('unmatched_count', models.IntegerField(default=0)),
                ('total_lines', models.IntegerField(default=0)),
                ('reconciled_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('account', models.ForeignKey(help_text='Bank account for this statement', on_delete=django.db.models.deletion.PROTECT, related_name='bank_statements', to='finance.financialaccount')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_bankstatement_set', to='erp.organization')),
                ('reconciled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reconciled_statements', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'bank_statement',
                'ordering': ['-statement_date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='BankStatementLine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('line_number', models.IntegerField(default=0)),
                ('transaction_date', models.DateField()),
                ('value_date', models.DateField(blank=True, null=True)),
                ('description', models.CharField(max_length=500)),
                ('reference', models.CharField(blank=True, max_length=100)),
                ('debit_amount', models.DecimalField(decimal_places=2, default='0.00', max_digits=15)),
                ('credit_amount', models.DecimalField(decimal_places=2, default='0.00', max_digits=15)),
                ('balance', models.DecimalField(decimal_places=2, max_digits=15)),
                ('is_matched', models.BooleanField(default=False)),
                ('match_confidence', models.FloatField(blank=True, null=True)),
                ('suggested_entry_id', models.IntegerField(blank=True, null=True)),
                ('match_reason', models.CharField(blank=True, max_length=200)),
                ('matched_at', models.DateTimeField(blank=True, null=True)),
                ('category', models.CharField(blank=True, max_length=100)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('matched_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bank_line_matches', to=settings.AUTH_USER_MODEL)),
                ('matched_entry', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='matched_bank_lines', to='finance.journalentryline')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_bankstatementline_set', to='erp.organization')),
                ('statement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='finance.bankstatement')),
            ],
            options={
                'db_table': 'bank_statement_line',
                'ordering': ['statement', 'line_number', 'transaction_date'],
            },
        ),
        migrations.CreateModel(
            name='ReconciliationSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('duration_seconds', models.IntegerField(blank=True, null=True)),
                ('auto_matched_count', models.IntegerField(default=0)),
                ('manual_matched_count', models.IntegerField(default=0)),
                ('unmatched_count', models.IntegerField(default=0)),
                ('status', models.CharField(choices=[('IN_PROGRESS', 'In Progress'), ('COMPLETED', 'Completed'), ('ABANDONED', 'Abandoned')], default='IN_PROGRESS', max_length=20)),
                ('notes', models.TextField(blank=True, null=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_reconciliationsession_set', to='erp.organization')),
                ('started_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='started_reconciliation_sessions', to=settings.AUTH_USER_MODEL)),
                ('statement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sessions', to='finance.bankstatement')),
            ],
            options={
                'db_table': 'reconciliation_session',
                'ordering': ['-started_at'],
            },
        ),
        # Add indexes
        migrations.AddIndex(
            model_name='bankstatement',
            index=models.Index(fields=['organization', 'account', 'statement_date'], name='bank_stmt_org_acct_date_idx'),
        ),
        migrations.AddIndex(
            model_name='bankstatement',
            index=models.Index(fields=['organization', 'status'], name='bank_stmt_org_status_idx'),
        ),
        migrations.AddIndex(
            model_name='bankstatementline',
            index=models.Index(fields=['organization', 'statement', 'is_matched'], name='bank_line_org_stmt_match_idx'),
        ),
        migrations.AddIndex(
            model_name='bankstatementline',
            index=models.Index(fields=['organization', 'transaction_date'], name='bank_line_org_date_idx'),
        ),
        migrations.AddIndex(
            model_name='reconciliationsession',
            index=models.Index(fields=['organization', 'statement'], name='recon_sess_org_stmt_idx'),
        ),
        migrations.AddIndex(
            model_name='reconciliationsession',
            index=models.Index(fields=['organization', 'status', 'started_at'], name='recon_sess_org_status_idx'),
        ),
    ]
