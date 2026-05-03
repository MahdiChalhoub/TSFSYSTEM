"""Add `code` column to inventory.Brand.

Mirrors Category's split between `short_name` (readable abbreviation
like "P&G") and `code` (short ISO-like identifier like "PNG"). The form
populates each from a different input — short_name from the Short Name
field, code from the LockableCodeInput.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='brand',
            name='code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
