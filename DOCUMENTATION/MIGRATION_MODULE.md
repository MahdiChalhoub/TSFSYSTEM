# Data Migration Module (UltimatePOS → TSF)

## Goal
Migrate all business data from UltimatePOS (Laravel/MySQL) into the TSF ERP system. Handles SQL dump file uploads, parses INSERT statements, maps source data to TSF models, and imports in dependency order with full rollback capability.

## Architecture

```
Frontend (page.tsx)           Backend (apps/migration/)
┌──────────────────────┐     ┌───────────────────────────────────────┐
│ Upload .sql file ────────→ │ views.py (upload endpoint)            │
│ Preview tables   ────────→ │ parsers.py → SQLDumpParser            │
│ Start migration  ────────→ │ services.py → MigrationService        │
│ Poll progress    ────────→ │                ↓                      │
│ View results     ────────→ │ mappers.py → entity-specific mappers  │
│ Rollback         ────────→ │ services.py → MigrationRollbackService│
└──────────────────────┘     └───────────────────────────────────────┘
```

## Data Flow

### Where Data is READ From
- **SQL dump file** (.sql) uploaded by the user — stored in `media/migration_uploads/`
- OR **direct MySQL connection** to a remote UltimatePOS database

### Where Data is SAVED To
- **TSF PostgreSQL database** — into the following tables:

| UltimatePOS Table | TSF Model | TSF DB Table |
|---|---|---|
| `units` | `Unit` | `unit` |
| `categories` | `Category` | `category` |
| `brands` | `Brand` | `brand` |
| `products` + `variations` | `Product` | `product` |
| `contacts` | `Contact` | `contact` |
| `transactions` | `Order` | `order` |
| `transaction_sell_lines` | `OrderLine` | `order_line` |
| `purchase_lines` | `OrderLine` | `order_line` |
| `accounts` | `FinancialAccount` | `financial_account` |
| `business_locations` | `Site` | `site` |

### Tracking Tables
| Table | Purpose |
|---|---|
| `migration_job` | Tracks each migration run's status, progress, and statistics |
| `migration_mapping` | Stores old_id → new_id for idempotency and rollback |

## Variables User Interacts With
- **SQL file** — The .sql dump exported from phpMyAdmin
- **Migration name** — A label for the migration job (auto-generated with date)
- **Direct DB credentials** (optional) — host, port, database, user, password

## Step-by-Step Workflow

1. **User** exports their UltimatePOS database from phpMyAdmin as `.sql`
2. **User** opens `/migration` page in TSF
3. **User** uploads the `.sql` file via drag-and-drop
4. **System** creates a `MigrationJob` (status: PENDING) and saves the file
5. **User** clicks "Preview" → system parses the SQL and shows table row counts
6. **User** clicks "Start Migration"
7. **System** runs `MigrationService.run()` in a background thread:
   - Parses SQL dump (status: PARSING)
   - Runs imports in order (status: RUNNING): Sites → Units → Categories → Brands → Products → Contacts → Accounts → Transactions → Sell Lines → Purchase Lines
   - For each entity: checks idempotency via `MigrationMapping`, maps fields, creates object, saves mapping
   - Updates `progress` (0-100) and `current_step` on the job
8. **Frontend** polls the job every 2 seconds, showing live progress
9. **System** marks job as COMPLETED or FAILED
10. **User** sees results: entity counts, error log, mapping summary
11. **User** can **rollback** (deletes all imported data in reverse order)

## API Endpoints

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/migration/jobs/` | List all migration jobs |
| GET | `/api/migration/jobs/{id}/` | Get job details |
| POST | `/api/migration/jobs/upload/` | Upload SQL dump |
| POST | `/api/migration/jobs/connect/` | Create job via direct DB |
| GET | `/api/migration/jobs/{id}/preview/` | Preview table counts |
| POST | `/api/migration/jobs/{id}/start/` | Start migration |
| GET | `/api/migration/jobs/{id}/logs/` | Get error logs and mappings |
| POST | `/api/migration/jobs/{id}/rollback/` | Rollback migration |

## Key Files

| File | Purpose |
|---|---|
| `erp_backend/apps/migration/models.py` | MigrationJob, MigrationMapping models |
| `erp_backend/apps/migration/parsers.py` | SQL dump parser and direct DB reader |
| `erp_backend/apps/migration/mappers.py` | Entity-specific field mapping logic |
| `erp_backend/apps/migration/services.py` | Migration orchestrator and rollback service |
| `erp_backend/apps/migration/serializers.py` | DRF serializers |
| `erp_backend/apps/migration/views.py` | API ViewSet |
| `erp_backend/apps/migration/urls.py` | URL routing |
| `src/modules/migration/page.tsx` | Frontend wizard UI |
| `src/modules/migration/actions.ts` | Server actions |
| `src/modules/migration/manifest.json` | Module manifest |

## Missing UltimatePOS Features (No TSF Equivalent)
- Customer Groups (`customer_groups`)
- Selling Price Groups (`selling_price_groups`, `variation_group_prices`)
- Cash Registers (`cash_registers`, `cash_register_transactions`)
- Multi-Payment Splits (`transaction_payments` — partial)
- Warranties (`warranties`, `sell_line_warranties`)
- Expense Categories (`expense_categories` — partial via ChartOfAccount)

Unmapped data is preserved in `MigrationMapping.extra_data` (JSON) for reference.
