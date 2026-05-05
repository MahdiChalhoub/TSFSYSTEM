"""
Repair migration: re-create pos_driver if it's missing.

Background
----------
At some point during the long-ago squash + restore cycle, this app's
0001_initial got marked as applied on the dev DB without actually
running. Most of pos_initial's tables happened to be there from the
pre-squash schema, but a handful — including pos_driver — were lost.

Result: the model exists, ORM expects it, queries return
ProgrammingError. Subsequent migrations (0002+) try to AddField on
the missing table and crash.

This repair migration sits BETWEEN 0001_initial and 0002_rename...
in the dep chain. It uses CREATE TABLE IF NOT EXISTS so it's a no-op
on healthy DBs and a heal on drifted DBs. The schema mirrors the
0001_initial CreateModel for Driver verbatim — later migrations
(0002 add_fields, 0003 vehicle_type) then run cleanly on top.

Reversal: drops the table only if it's empty. Refuses to drop
non-empty tables to prevent accidental data loss on rollback.
"""
from django.db import migrations


CREATE_SQL = """
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
"""


REVERSE_SQL = """
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM pos_driver) = 0 THEN
        DROP TABLE pos_driver;
    ELSE
        RAISE EXCEPTION 'Refusing to drop non-empty pos_driver. Manual cleanup required.';
    END IF;
END
$$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0001_initial'),
        # erp.0001_initial creates erp_organization and erp_user, the FK
        # targets above. Spelling out the cross-app dep makes the order
        # explicit even though it's also implied by the FK.
        ('erp', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=CREATE_SQL,
            reverse_sql=REVERSE_SQL,
            # `state_operations=[]` tells Django this migration changes the
            # DB schema only — not the model state Django tracks. The
            # Driver model's state is already declared by 0001_initial's
            # CreateModel; we're just catching up the actual table.
            state_operations=[],
        ),
    ]
