"""
Migration 0008 — Fix organization field on EmployeeBadge, EmployeeScorePeriod, ScoreRule

Migration 0007 accidentally removed the organization FK from these models
despite them inheriting from TenantModel which requires it. This migration
re-adds the field as nullable to avoid data issues, then constraints
can be enforced later.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workforce', '0007_rename_workforce_ese_tes_idx_workforce_s_organization__d4e395_idx_and_more'),
        ('erp', '0021_alter_approvalrule_organization_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeebadge',
            name='organization',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                to='erp.organization',
                null=True,
                blank=True,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='employeescoreperiod',
            name='organization',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                to='erp.organization',
                null=True,
                blank=True,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='scorerule',
            name='organization',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                to='erp.organization',
                null=True,
                blank=True,
            ),
            preserve_default=False,
        ),
    ]
