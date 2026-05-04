"""
Phase 7 of the AI assistant feature.

Adds the cache table for AI category-rule suggestion reviews. Sibling
of `inventory_ai_scope_review` from Phase 6 — same shape, different FK
target (Category instead of ProductAttribute) so a single
AIScopeSuggesterConfig governs both pipelines (one toggle, one daily
token cap, but partitioned cache rows).
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_ai_scope_models'),
        ('inventory', '0006_product_brand_count_indexes'),
        ('erp', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AICategoryRuleReview',
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
                ('field_verdicts', models.JSONField(blank=True, default=dict)),
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
                ('category', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ai_rule_reviews',
                    to='inventory.category',
                )),
            ],
            options={
                'db_table': 'inventory_ai_category_rule_review',
                'indexes': [
                    models.Index(fields=['organization', 'category', 'input_hash'], name='inv_ai_cr_org_cat_hash_idx'),
                    models.Index(fields=['created_at'], name='inv_ai_cr_created_idx'),
                ],
                'unique_together': {('category', 'input_hash')},
            },
        ),
    ]
