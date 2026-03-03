# Repaired by Gap 10 fix — original RenameIndex operations referenced indexes
# that never existed in the database (they were defined in an earlier unapplied migration).
# Replaced with no-op so the migration chain can proceed cleanly.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0036_merge_0035_merge_20260302_2226_0035_stock_move'),
    ]

    operations = [
        # Originally tried to rename 5 indexes that don't exist in the DB.
        # Safe to skip — the indexes will be created fresh by migration 0041.
        migrations.RunSQL("SELECT 1", "SELECT 1"),
    ]
