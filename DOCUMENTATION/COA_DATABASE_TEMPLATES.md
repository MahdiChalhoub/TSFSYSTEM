# Database-Driven COA Templates

## Goal
Replace all hardcoded Chart of Accounts (COA) template definitions with a database-driven system using JSON seed files.

## Architecture

### Data Flow
```
JSON seed files → seed_coa_templates command → COATemplate DB table → LedgerService.apply_coa_template → ChartOfAccount DB table
```

### Where Templates Are READ From
- **Database table**: `coa_template` (model: `apps.finance.models.COATemplate`)
- **API endpoint**: `GET /api/v1/finance/coa/templates/` returns all templates with full nested account trees
- **Frontend**: `getAllTemplates()` in `src/app/actions/finance/coa-templates.ts` fetches from API

### Where Templates Are SAVED To
- **JSON seed files**: `erp_backend/apps/finance/seeds/*.json`
- **Database**: via `python manage.py seed_coa_templates`

## Variables / Objects

### COATemplate Model (Global, not tenant-scoped)
| Field | Type | Description |
|---|---|---|
| key | CharField(50) | Unique template key (e.g., IFRS_COA) |
| name | CharField(100) | Display name |
| description | TextField | Template description |
| accounts | JSONField | Nested account tree |
| account_count | IntegerField | Flattened account count |
| root_count | IntegerField | Number of top-level classes |

### Available Templates
| Key | Name | Accounts | Root Classes |
|---|---|---|---|
| IFRS_COA | IFRS COA | 115 | 7 |
| LEBANESE_PCN | Lebanese PCN | 33 | 7 |
| FRENCH_PCG | French PCG | 44 | 7 |
| USA_GAAP | USA GAAP | 20 | 6 |
| SYSCOHADA_REVISED | SYSCOHADA Revised | 38 | 7 |

## Step-by-Step Workflow

### 1. Adding/Modifying a Template
1. Edit JSON seed file in `erp_backend/apps/finance/seeds/<KEY>.json`
2. Run `python manage.py seed_coa_templates` (creates/updates in DB)
3. Templates immediately available via API

### 2. Applying a Template to an Organization
1. Frontend: User selects template on `/finance/chart-of-accounts/templates` page
2. Frontend calls `importChartOfAccountsTemplate(key, { reset })` 
3. API POST to `/api/v1/finance/coa/apply_template/`
4. Backend: `LedgerService.apply_coa_template(org, key, reset)` reads from `COATemplate` table
5. Accounts created in `ChartOfAccount` table for that organization

### 3. Resetting an Organization's COA
```bash
python manage.py reset_coa <org_slug> --template IFRS_COA
```

### 4. Initial Server Setup
```bash
# 1. Create migration for COATemplate model
python manage.py makemigrations finance

# 2. Apply migration
python manage.py migrate

# 3. Seed templates into database
python manage.py seed_coa_templates

# 4. (Optional) Reset org COA
python manage.py reset_coa saas --template IFRS_COA
```

## Files Modified

### Created
- `apps/finance/models.py` → Added `COATemplate` model
- `apps/finance/seeds/IFRS_COA.json` → 109-account IFRS template
- `apps/finance/seeds/LEBANESE_PCN.json` → Lebanese PCN template
- `apps/finance/seeds/FRENCH_PCG.json` → French PCG template
- `apps/finance/seeds/USA_GAAP.json` → USA GAAP template
- `apps/finance/seeds/SYSCOHADA_REVISED.json` → SYSCOHADA template
- `apps/finance/management/commands/seed_coa_templates.py` → Seeder command

### Modified
- `apps/finance/services.py` → `apply_coa_template` reads from DB
- `apps/finance/views.py` → `/coa/templates/` endpoint reads from DB
- `src/app/actions/finance/coa-templates.ts` → Removed ALL hardcoded templates, reads from API
- `erp/management/commands/reset_coa.py` → Validates template from DB
- `seed.py` → Uses `LedgerService.apply_coa_template` instead of hardcoded accounts

### Deleted (hardcoded data removed from)
- `erp/coa_templates.py` → No longer imported anywhere (can be deleted)
- `src/app/actions/finance/coa-templates.ts` → Removed 350+ lines of hardcoded template data

## Tables Affected
| Table | Read By | Written By |
|---|---|---|
| coa_template | LedgerService, COA Templates API | seed_coa_templates command |
| chartofaccount | All finance pages | LedgerService.apply_coa_template |
