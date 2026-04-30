# Migration Chain Recovery — `erp_contract` drift

## Symptom

```
$ python3 manage.py migrate finance 0075
…
django.db.utils.ProgrammingError: relation "erp_contract" does not exist
```

…even though `python3 manage.py showmigrations erp` shows `[X] 0010_auditlog_audittrail_confighistory_contract_and_more` (which is what created `erp_contract` originally).

## Diagnosis

`django_migrations` records `erp 0010` as applied — it was, at one point.
But the `erp_contract` table no longer exists in the public schema. That
means somewhere along the way the table was dropped (manual `DROP TABLE`,
schema rebuild, or a since-deleted migration that did the drop). When
`erp 0028_remove_approvalrule_organization_and_more` runs, it tries to
alter `erp_contract` and fails because the table was supposed to be there.

```
public schema reality:        only modulecontract exists, no erp_contract
django_migrations table says: 0010 ran, contract was created
```

This is a state mismatch between Django's view of the world and the DB.

## Why it doesn't actually break the app

`finance/0061+` and `erp/0028+` are pending — but the runtime tables those
migrations would have *changed* are largely already in their target state
because earlier prod deploys ran them and someone pruned the migration
records. The app boots, queries work, the FX rebuild works.

The breakage is exclusively in `manage.py migrate` — which means new
schema changes (like `finance/0075`) can't be applied through the normal
flow.

## Recovery options (lowest-risk first)

### Option 1: Fake the broken migrations *if you've verified prod state matches them*

```bash
python3 manage.py migrate erp 0028 --fake
python3 manage.py migrate erp        # auto-runs 0029+ (if any) normally
python3 manage.py migrate finance     # finance/0061..0076 should now flow
```

**Only safe if you have independently confirmed** that the schema changes
in `0028..0029` are already physically present in the public schema. Run
`\d <table>` for each table named in those migration `operations` and
compare to the migration's `AlterField` / `AddField` definitions.

### Option 2: Recreate erp_contract from `0010` definition

If you actually *do* need contract functionality (the codebase still
imports `Contract` somewhere), restore the table:

1. Read `erp/migrations/0010_auditlog_audittrail_confighistory_contract_and_more.py`
   for the `CreateModel('Contract', …)` block.
2. Hand-write the matching `CREATE TABLE erp_contract (…)` SQL.
3. Apply it.
4. Run `python3 manage.py migrate` normally.

Verify nothing in the codebase references contract (`grep -r "Contract\b"
erp/ apps/`) before assuming you don't need it.

### Option 3: Squash the chain (nuclear)

If many migrations are pending and the chain is fundamentally lying
about state:

1. `python3 manage.py squashmigrations erp 0001 0029` (latest).
2. Inspect the squashed migration manually — it will likely not match
   what's in the DB.
3. `python3 manage.py migrate erp --fake-initial` to mark it applied.
4. Same for `finance`.

**Don't do this on production without a full backup.** Squashing is hard
to undo if you got the diagnosis wrong.

## What this affects in our work

The new `finance/0075_revaluation_overhaul` and `0076_backfill_monetary_classification`
migrations are blocked behind this chain. The schema changes are **safe** —
they're additive (new columns, new model fields) and reversible — but the
runner won't get to them until the upstream rot is fixed.

## Workaround for FX revaluation specifically

If you need the FX feature live before the chain is fixed:

```sql
-- Run as DB superuser. Equivalent to manually applying 0075 + 0076.
ALTER TABLE finance_chartofaccount
    ADD COLUMN IF NOT EXISTS monetary_classification VARCHAR(20) NOT NULL DEFAULT 'MONETARY';

ALTER TABLE finance_currency_revaluation
    ADD COLUMN IF NOT EXISTS materiality_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS excluded_account_ids JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS auto_reverse_at_period_start BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS reversal_journal_entry_id BIGINT NULL,
    ADD COLUMN IF NOT EXISTS approved_by_id BIGINT NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE finance_currency_revaluation_line
    ADD COLUMN IF NOT EXISTS rate_type_used VARCHAR(20) NOT NULL DEFAULT 'CLOSING',
    ADD COLUMN IF NOT EXISTS classification VARCHAR(20) NOT NULL DEFAULT 'MONETARY';

-- Backfill (mirror of migration 0076's logic)
UPDATE finance_chartofaccount SET monetary_classification = 'INCOME_EXPENSE'
    WHERE type IN ('INCOME', 'EXPENSE') AND monetary_classification = 'MONETARY';
UPDATE finance_chartofaccount SET monetary_classification = 'NON_MONETARY'
    WHERE (type = 'EQUITY' OR system_role IN ('INVENTORY', 'INVENTORY_ASSET', 'WIP', 'ACCUM_DEPRECIATION'))
    AND monetary_classification = 'MONETARY';

-- Then mark migrations as applied so future migrate doesn't try to re-run them:
INSERT INTO django_migrations (app, name, applied) VALUES
    ('finance', '0075_revaluation_overhaul', NOW()),
    ('finance', '0076_backfill_monetary_classification', NOW())
ON CONFLICT DO NOTHING;
```

Done outside Django's migration tooling — this is *only* the right call
when the chain itself is rotten and there's no fast path through.

## Long-term

The real fix is a process one: every prod deploy should run
`manage.py migrate` cleanly. If a migration is intentionally manual,
`--fake` it on the spot. If a table is intentionally dropped, write a
proper `RemoveField` / `DeleteModel` migration. Drift accumulates
silently until something like `finance/0075` tries to ride through.
