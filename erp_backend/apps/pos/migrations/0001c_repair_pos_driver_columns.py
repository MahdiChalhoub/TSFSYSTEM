"""
Repair migration #2: backfill pos_driver columns 0002 + 0003 will add.

Background
----------
The first repair (0001b) created the pos_driver table with the
0001_initial schema only. After that record was inserted, we discovered
0002+0003 also add columns to pos_driver, and the dev DB is missing
all of them. We can't rewrite 0001b because Django won't re-run an
already-applied migration. So this 0001c migration backfills only
the additional columns idempotently — letting us then fake-apply
0002+0003 since their effects are now in place.

Order of dependencies:
    0001_initial → 0001b_repair_missing_pos_driver → 0001c (THIS)
                                                  ↓
                                              0002_rename_*

On healthy DBs every ALTER TABLE is a no-op (IF NOT EXISTS).
"""
from django.db import migrations


HEAL_SQL = r"""
-- 0002 AddField on driver — three columns added in the squash era.
ALTER TABLE pos_driver ADD COLUMN IF NOT EXISTS available_for_purchase BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pos_driver ADD COLUMN IF NOT EXISTS available_for_sales    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE pos_driver ADD COLUMN IF NOT EXISTS vehicle_plate          VARCHAR(50);

-- 0003 AddField — vehicle_type with default + choices enforced at app level.
ALTER TABLE pos_driver ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20) NOT NULL DEFAULT 'MOTORCYCLE';
"""

REVERSE_SQL = "-- column additions are intentionally not reversed (cheap to keep, risky to drop)"


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0001b_repair_missing_pos_driver'),
    ]

    operations = [
        migrations.RunSQL(
            sql=HEAL_SQL,
            reverse_sql=REVERSE_SQL,
            state_operations=[],
        ),
    ]
