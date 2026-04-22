"""
UnitPackage safety hardening:
  - parent FK: CASCADE → PROTECT (stops silent chain deletion)
  - unit FK: CASCADE → PROTECT (stops silent cross-model nuke)
  - PackagingSuggestionRule.packaging FK: CASCADE → PROTECT
  - Add `is_archived` + `archived_at` for soft-delete
  - Add partial unique constraint: only one default per (unit, organization)
    where is_default=True AND is_archived=False
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0057_unitpackage_chain'),
    ]

    operations = [
        migrations.AddField(
            model_name='unitpackage',
            name='is_archived',
            field=models.BooleanField(
                default=False, db_index=True,
                help_text='Soft-deleted templates are hidden from default listings',
            ),
        ),
        migrations.AddField(
            model_name='unitpackage',
            name='archived_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AlterField(
            model_name='unitpackage',
            name='unit',
            field=models.ForeignKey(
                on_delete=models.deletion.PROTECT,
                related_name='unit_packages',
                to='inventory.unit',
            ),
        ),
        migrations.AlterField(
            model_name='unitpackage',
            name='parent',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=models.deletion.PROTECT,
                related_name='children',
                to='inventory.unitpackage',
                help_text='Previous step in the packaging chain (None for base-level)',
            ),
        ),
        migrations.AlterField(
            model_name='packagingsuggestionrule',
            name='packaging',
            field=models.ForeignKey(
                on_delete=models.deletion.PROTECT,
                related_name='suggestion_rules',
                to='inventory.unitpackage',
                help_text='The packaging template this rule suggests',
            ),
        ),
        migrations.AddConstraint(
            model_name='unitpackage',
            constraint=models.UniqueConstraint(
                fields=['unit', 'organization'],
                condition=models.Q(is_default=True, is_archived=False),
                name='unique_default_package_per_unit_tenant',
            ),
        ),
    ]
