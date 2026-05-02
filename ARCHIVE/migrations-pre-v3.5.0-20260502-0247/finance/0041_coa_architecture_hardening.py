"""
Migration 0041 — COA Architecture Hardening

Adds:
  COATemplate:
    - version, is_active, superseded_by, base_template
    - UniqueConstraint on (key, version, organization)

  COATemplateAccount:
    - semantic_group, is_dirty, last_mapped_at
    - UniqueConstraint on (template, system_role) where system_role IS NOT NULL
    - Indexes on semantic_group and is_dirty
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0040_add_coa_migration_session_and_account_plan'),
    ]

    operations = [
        # ══════════════════════════════════════
        # COATemplate — Versioning & Customization
        # ══════════════════════════════════════

        migrations.AddField(
            model_name='coatemplate',
            name='version',
            field=models.CharField(
                default='2025', max_length=20,
                help_text='Template version identifier, e.g. 2023, 2025, 2025.1'
            ),
        ),
        migrations.AddField(
            model_name='coatemplate',
            name='is_active',
            field=models.BooleanField(
                default=True,
                help_text='Only active templates appear in selection UIs'
            ),
        ),
        migrations.AddField(
            model_name='coatemplate',
            name='superseded_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='supersedes',
                to='finance.coatemplate',
                help_text='Points to the newer version of this template',
            ),
        ),
        migrations.AddField(
            model_name='coatemplate',
            name='base_template',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='derived_templates',
                to='finance.coatemplate',
                help_text='For custom templates: the system template this was forked from',
            ),
        ),

        # Template uniqueness: key + version + organization
        migrations.AddConstraint(
            model_name='coatemplate',
            constraint=models.UniqueConstraint(
                fields=['key', 'version', 'organization'],
                name='unique_template_key_version_org',
            ),
        ),

        # ══════════════════════════════════════
        # COATemplateAccount — Semantic Group & Dirty Tracking
        # ══════════════════════════════════════

        migrations.AddField(
            model_name='coatemplateaccount',
            name='semantic_group',
            field=models.CharField(
                blank=True, max_length=30, null=True,
                help_text='Fine-grained semantic sub-classification for Level 4+ matching'
            ),
        ),
        migrations.AddField(
            model_name='coatemplateaccount',
            name='is_dirty',
            field=models.BooleanField(
                default=True,
                help_text='True when account changed since last mapping rebuild'
            ),
        ),
        migrations.AddField(
            model_name='coatemplateaccount',
            name='last_mapped_at',
            field=models.DateTimeField(
                blank=True, null=True,
                help_text='When this account was last included in a mapping rebuild'
            ),
        ),

        # Indexes
        migrations.AddIndex(
            model_name='coatemplateaccount',
            index=models.Index(
                fields=['template', 'semantic_group'],
                name='coatplacct_semgrp_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='coatemplateaccount',
            index=models.Index(
                fields=['template', 'is_dirty'],
                name='coatplacct_dirty_idx'
            ),
        ),

        # System role uniqueness per template (excluding NULL roles)
        migrations.AddConstraint(
            model_name='coatemplateaccount',
            constraint=models.UniqueConstraint(
                fields=['template', 'system_role'],
                condition=models.Q(system_role__isnull=False),
                name='unique_role_per_template',
            ),
        ),
    ]
