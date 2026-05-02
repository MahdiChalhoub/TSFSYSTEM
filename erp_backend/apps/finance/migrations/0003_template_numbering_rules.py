"""Template numbering rules + per-account default scope override.

Adds:
  • COATemplate.numbering_rules (JSON)  — per-template code-suggestion rule
  • COATemplateAccount.default_scope_mode (CharField) — optional scope hint
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='coatemplate',
            name='numbering_rules',
            field=models.JSONField(
                blank=True, default=dict,
                help_text='Per-template numbering convention used to suggest child codes',
            ),
        ),
        migrations.AddField(
            model_name='coatemplateaccount',
            name='default_scope_mode',
            field=models.CharField(
                blank=True, default='', max_length=20,
                choices=[
                    ('tenant_wide', 'Tenant-wide (one shared balance)'),
                    ('branch_split', 'Branch-split (per-branch slice)'),
                    ('branch_located', 'Branch-located (lives at one site)'),
                ],
                help_text='Optional default branch-scope when the account is seeded into an org',
            ),
        ),
    ]
