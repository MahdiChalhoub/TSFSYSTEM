---
description: Mandatory checklist when creating database migrations — ensures MIGRATIONS.md is updated and deploy guard stays accurate
---

# Migration Governance

Every time you create a new Django migration file, you **MUST** follow this checklist:

## Checklist

### 1. Create the migration
```bash
python3 manage.py makemigrations <app_name> --name <descriptive_name>
```
If `makemigrations` hangs on interactive prompts from unrelated apps, write the migration file manually at:
```
erp_backend/apps/<app>/migrations/XXXX_<name>.py
```

### 2. Update `MIGRATIONS.md` (MANDATORY)
Add an entry at the **top** of the manifest (above the previous latest version):

```markdown
## v3.5.0-AG-YYMMDD

### <Module Name>
| Migration | Description |
|---|---|
| `XXXX_migration_name` | Brief description of what changed |
```

> [!CAUTION]
> If you skip this step, deployers will have no visibility into what DB changes are pending.
> The deploy guard (`check_migrations.sh`) will show pending migrations at deploy time,
> but without `MIGRATIONS.md` entries there is no human-readable context.

### 3. Run the migration locally
```bash
python3 manage.py migrate <app_name>
```

### 4. Verify
Confirm the migration applied:
```bash
python3 manage.py showmigrations <app_name> | tail -5
```

## Rules

1. **Never skip MIGRATIONS.md** — every migration must have a manifest entry
2. **Never run `makemigrations` on the server** — migrations are created locally and deployed via rsync
3. **Use `--noinput`** on the server — the deploy pipeline runs `migrate --noinput` automatically
4. **Manual migration files are OK** — when `makemigrations` can't run cleanly due to unrelated app issues, write the migration by hand
5. **Group related changes** — prefer one migration per logical change (e.g., "add security rules to POS settings"), not one per field
