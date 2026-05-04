"""
Phase 6 of the scoped-attribute-values feature.

Adds two tables to power the AI ranker on top of the deterministic
suggester from Phase 3:

    inventory_ai_scope_config  — per-tenant opt-in config (off by default)
    inventory_ai_scope_review  — cache of LLM verdicts keyed by input hash

The AI layer is opt-in and idle until an operator turns it on under
Settings → AI. Until then this migration just provisions empty tables
— no behaviour change, no token spend.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_attribute_value_scopes'),
        ('mcp', '0001_initial'),
        ('erp', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AIScopeSuggesterConfig',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enabled', models.BooleanField(default=False)),
                ('daily_token_cap', models.IntegerField(default=100000)),
                ('tokens_used_today', models.IntegerField(default=0)),
                ('tokens_reset_at', models.DateTimeField(blank=True, null=True)),
                ('min_ai_confidence', models.FloatField(default=0.6)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.OneToOneField(
                    db_column='tenant_id',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ai_scope_suggester_config',
                    to='erp.organization',
                )),
                ('provider', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to='mcp.mcpprovider',
                )),
            ],
            options={'db_table': 'inventory_ai_scope_config'},
        ),
        migrations.CreateModel(
            name='AIScopeReview',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('input_hash', models.CharField(db_index=True, max_length=64)),
                ('verdict', models.CharField(choices=[
                    ('accept', 'Accept'),
                    ('partial', 'Partial — some axes are wrong'),
                    ('reject', 'Reject'),
                    ('error', 'LLM error / unparseable'),
                ], max_length=10)),
                ('confidence', models.FloatField(default=0.0)),
                ('rationale', models.TextField(blank=True)),
                ('axis_verdicts', models.JSONField(blank=True, default=dict)),
                ('provider_name', models.CharField(blank=True, max_length=50)),
                ('model_name', models.CharField(blank=True, max_length=100)),
                ('input_tokens', models.IntegerField(default=0)),
                ('output_tokens', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(
                    db_column='tenant_id',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='+',
                    to='erp.organization',
                )),
                ('value', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ai_scope_reviews',
                    to='inventory.productattribute',
                )),
            ],
            options={
                'db_table': 'inventory_ai_scope_review',
                'indexes': [
                    models.Index(fields=['organization', 'value', 'input_hash'], name='inv_ai_rev_org_val_hash_idx'),
                    models.Index(fields=['created_at'], name='inv_ai_rev_created_idx'),
                ],
                'unique_together': {('value', 'input_hash')},
            },
        ),
    ]
