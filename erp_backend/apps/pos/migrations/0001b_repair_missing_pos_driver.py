"""
Repair migration: heal cumulative pos schema drift.

Background
----------
The dev DB inherited migration drift from a long-ago squash + restore
cycle: pos.0001_initial got marked applied without actually running,
later migrations 0002/0003 had AddFields manually applied for SOME
columns (procurement_request.is_recovered, purchase_order.driver_source,
etc.) but NOT for others (the entire pos_driver table, plus its
0002+0003 follow-on columns). Result: model state and DB state
disagree on which columns exist where.

This repair migration sits BETWEEN 0001_initial and 0002_rename...
and applies every additive schema piece from 0001 + 0002 + 0003 using
idempotent DDL (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN
IF NOT EXISTS). On healthy DBs every statement is a no-op. On the
drifted dev DB, the missing pieces get backfilled.

After this runs, 0002 + 0003 + 0004 can be `--fake`d because their
schema effects are now all present.

Reversal: refuses to drop pos_driver if it has rows (to avoid data
loss). Leaves the ALTER TABLE additions in place — those are cheap
and safe.
"""
from django.db import migrations


# ── Forward: heal everything 0002+0003 should have done ──
# Each statement is idempotent (IF NOT EXISTS) so re-running this
# migration on a healthy DB is a no-op. Order matters only in that
# pos_driver must exist before its ALTER TABLEs run.
HEAL_SQL = r"""
-- 1. Create pos_driver if missing (the original 0001_initial CreateModel).
CREATE TABLE IF NOT EXISTS pos_driver (
    id              BIGSERIAL PRIMARY KEY,
    phone           VARCHAR(50),
    license_number  VARCHAR(100),
    vehicle_info    VARCHAR(200),
    status          VARCHAR(20)  NOT NULL DEFAULT 'OFFLINE',
    is_active_fleet BOOLEAN      NOT NULL DEFAULT TRUE,
    commission_type VARCHAR(10)  NOT NULL DEFAULT 'FLAT',
    commission_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_deliveries INTEGER     NOT NULL DEFAULT 0,
    total_earned    NUMERIC(15,2) NOT NULL DEFAULT 0,
    last_latitude   NUMERIC(10,7),
    last_longitude  NUMERIC(10,7),
    last_location_at TIMESTAMPTZ,
    tenant_id       UUID         NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    user_id         BIGINT       NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_driver_tenant_idx ON pos_driver(tenant_id);

-- 2. 0002 AddField on driver — three columns added in the squash era.
ALTER TABLE pos_driver ADD COLUMN IF NOT EXISTS available_for_purchase BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pos_driver ADD COLUMN IF NOT EXISTS available_for_sales    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE pos_driver ADD COLUMN IF NOT EXISTS vehicle_plate          VARCHAR(50);

-- 3. 0003 AddField — vehicle_type with default + choices enforced at app level.
ALTER TABLE pos_driver ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20) NOT NULL DEFAULT 'MOTORCYCLE';

-- 4. 0002 AddFields on procurement_request (some already in DB — IF NOT EXISTS no-ops).
ALTER TABLE procurement_request ADD COLUMN IF NOT EXISTS is_recovered BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE procurement_request ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;

-- 5. 0002 AddFields on purchase_order — driver source + assignee + the
--    soon-to-be-removed external_driver_name/_phone (kept here so 0004's
--    RemoveField has something to drop on a fresh restore).
ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS assignee_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS driver_source VARCHAR(20);
ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS driver_user_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS external_driver_name VARCHAR(200);
ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS external_driver_phone VARCHAR(50);
"""


REVERSE_SQL = r"""
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM pos_driver) = 0 THEN
        DROP TABLE pos_driver;
    ELSE
        RAISE EXCEPTION 'Refusing to drop non-empty pos_driver. Manual cleanup required.';
    END IF;
END
$$;
-- ALTER TABLE additions are intentionally not reversed: they're safe
-- to keep in place, and dropping them risks deleting operator data.
"""


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0001_initial'),
        # erp tables we FK to (organization, user) live in the erp app.
        ('erp', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=HEAL_SQL,
            reverse_sql=REVERSE_SQL,
            # `state_operations=[]` tells Django this migration changes
            # the DB schema only — model state is already declared by
            # 0001_initial / 0002 / 0003. We're catching up the actual
            # tables, not redeclaring the models.
            state_operations=[],
        ),
    ]
