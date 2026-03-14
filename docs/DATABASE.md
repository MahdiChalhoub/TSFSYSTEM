# Database Strategy & Operations

## Schema Overview

TSFSYSTEM uses PostgreSQL 16 with Django ORM. Every business table is tenant-scoped via an `organization` ForeignKey.

### Core Entities
| Table | Module | Purpose |
|---|---|---|
| `erp_organization` | Core | Multi-tenant root entity |
| `erp_user` | Core | Authentication + org binding |
| `finance_chartofaccount` | Finance | GL accounts (IFRS/PCG/OHADA) |
| `finance_journalentry` | Finance | Double-entry ledger |
| `finance_postingrule` | Finance | Dynamic COA resolution |
| `finance_orgtaxpolicy` | Finance | Tax engine configuration |
| `pos_order` | POS | Sales/Purchase transactions |
| `pos_orderline` | POS | Per-product line items |
| `inventory_product` | Inventory | Product catalog |
| `inventory_stockledger` | Inventory | Audit-grade stock movements |
| `crm_contact` | CRM | Customers/Suppliers/Leads |

## Migration Strategy

### Rules
1. **Forward-only** — no rollback migrations in production
2. **Reviewed** — every migration is reviewed before deploy
3. **Documented** — significant migrations documented in `MIGRATIONS.md`
4. **Data-safe** — `RunPython` operations are idempotent

### Creating Migrations
```bash
cd erp_backend
python3 manage.py makemigrations <app_name>
python3 manage.py migrate --plan  # preview
python3 manage.py migrate          # apply
```

### Pre-Deploy Verification
```bash
python3 manage.py migrate --check  # exits non-zero if unapplied
python3 manage.py showmigrations | grep '\[ \]'  # show unapplied
```

## Backup & Recovery

### Automated Daily Backup
```bash
pg_dump -Fc -f /backups/tsfdb_$(date +%Y%m%d).dump tsfdb
```

### Point-in-Time Recovery
```bash
pg_restore -d tsfdb_restored /backups/tsfdb_20260314.dump
```

### Emergency Rollback
If a migration causes issues:
1. Identify the problematic migration via `showmigrations`
2. Apply the reverse: `python3 manage.py migrate <app> <previous_migration_number>`
3. Remove the migration file
4. Redeploy

## Index Strategy

- Every `organization` FK is indexed (Django default)
- Composite indexes on high-frequency query patterns:
  - `(organization, status)` on orders
  - `(organization, created_at)` on journal entries
  - `(organization, code)` on chart of accounts
- Periodically review with: `SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0`

## Query Optimization Guidelines

1. **Always filter by organization first** — enables partition pruning
2. **Use `select_related` / `prefetch_related`** — avoid N+1 queries
3. **Target <100ms p95** — use `django-debug-toolbar` in dev
4. **Aggregate on DB** — use `annotate()` not Python loops
5. **Paginate** — never unbounded `filter().all()` in views
