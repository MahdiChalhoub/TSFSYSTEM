"""
UnitPackage chain: add `parent` + `parent_ratio` so packages can form a
pipeline (pc → pack → box → pallet → TC). `ratio` (total base units)
stays as-is for fast lookups.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0056_packaging_suggestion_rule'),
    ]

    operations = [
        migrations.AddField(
            model_name='unitpackage',
            name='parent',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=models.deletion.CASCADE,
                related_name='children',
                to='inventory.unitpackage',
                help_text='Previous step in the packaging chain (None for base-level)',
            ),
        ),
        migrations.AddField(
            model_name='unitpackage',
            name='parent_ratio',
            field=models.DecimalField(
                blank=True, null=True, max_digits=15, decimal_places=4,
                help_text='How many of `parent` this package contains (e.g. 4 boxes per pallet)',
            ),
        ),
    ]
