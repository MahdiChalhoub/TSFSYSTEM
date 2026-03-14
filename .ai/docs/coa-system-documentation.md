# 📊 TSFSYSTEM — Chart of Accounts (COA) Complete Documentation

**Last Updated**: 2026-03-10
**Status**: Production — v3.5.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Backend Layer](#2-backend-layer)
   - 2.1 [Data Model](#21-data-model)
   - 2.2 [COA Templates (Backend)](#22-coa-templates-backend)
   - 2.3 [Services](#23-services)
   - 2.4 [API Endpoints](#24-api-endpoints)
   - 2.5 [ConfigurationService (Posting Rules Engine)](#25-configurationservice-posting-rules-engine)
3. [Frontend Layer](#3-frontend-layer)
   - 3.1 [Server Actions](#31-server-actions)
   - 3.2 [Pages & UI](#32-pages--ui)
   - 3.3 [COA Setup Wizard](#33-coa-setup-wizard)
   - 3.4 [Posting Rules Form](#34-posting-rules-form)
   - 3.5 [COA Migration Modal](#35-coa-migration-modal)
4. [Workflows](#4-workflows)
   - 4.1 [Initial COA Setup (New Organization)](#41-initial-coa-setup-new-organization)
   - 4.2 [Import / Switch Template](#42-import--switch-template)
   - 4.3 [Migrate Between Standards](#43-migrate-between-standards)
   - 4.4 [Auto Posting Rules](#44-auto-posting-rules)
5. [Features](#5-features)
6. [Posting Rules Governance](#6-posting-rules-governance)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Architecture Overview

The COA system follows a strict **3-tier architecture**:

```
┌────────────────────────────────────────────────────────────────────┐
│                       FRONTEND (Next.js)                           │
│                                                                    │
│  Pages:                                                            │
│  ├─ /finance/setup           → COA Setup Wizard (4-step)          │
│  ├─ /finance/chart-of-accounts → COA Tree View (browse/manage)    │
│  ├─ /finance/chart-of-accounts/templates → Template selector      │
│  ├─ /finance/chart-of-accounts/migrate → Balance migration tool   │
│  ├─ /finance/chart-of-accounts/[id] → Account detail/statement    │
│  └─ /finance/settings/posting-rules → Posting rules form          │
│                                                                    │
│  Server Actions:                                                   │
│  ├─ coa-setup.ts        → Setup lifecycle status tracking         │
│  ├─ coa-templates.ts    → Template import, migration, preview     │
│  └─ posting-rules.ts    → Get/save/analyze/smart-apply rules      │
├────────────────────────────────────────────────────────────────────┤
│                       BACKEND (Django REST)                        │
│                                                                    │
│  ViewSets:                                                         │
│  └─ ChartOfAccountViewSet                                         │
│      ├─ GET  /coa/templates/     → List available templates       │
│      ├─ GET  /coa/coa/           → Get COA tree with balances     │
│      ├─ POST /coa/apply_template/→ Apply a template (reset mode)  │
│      ├─ POST /coa/migrate/       → Migrate balances between accts │
│      ├─ GET  /coa/{id}/statement/→ Account statement (drill-down) │
│      └─ GET  /coa/trial_balance/ → Trial balance report           │
│                                                                    │
│  System ViewSets (erp/views_system.py):                           │
│  ├─ GET  /settings/posting_rules/ → Get posting rules config     │
│  ├─ POST /settings/posting_rules/ → Save posting rules            │
│  ├─ POST /settings/posting_rules/?dry_run=true → Impact analysis  │
│  ├─ POST /settings/posting_rules/?reclassify=true → With reclass  │
│  ├─ POST /settings/smart_apply/   → Auto-apply smart rules       │
│  └─ GET/POST /settings/coa_setup/ → COA setup status tracking    │
│                                                                    │
│  Services:                                                         │
│  ├─ LedgerCOAMixin (finance/services/ledger_coa.py)              │
│  │   ├─ apply_coa_template()    → Core template application       │
│  │   ├─ migrate_coa()           → Balance migration engine        │
│  │   ├─ get_chart_of_accounts() → Hierarchical COA with balances  │
│  │   ├─ get_trial_balance()     → Trial balance computation       │
│  │   ├─ get_profit_loss()       → P&L computation                 │
│  │   ├─ get_balance_sheet()     → Balance sheet computation       │
│  │   ├─ get_account_statement() → Account drill-down              │
│  │   └─ validate_closure()      → Fiscal closure validation       │
│  └─ ConfigurationService (erp/services.py)                        │
│      ├─ get_posting_rules()         → Read rules from org.settings│
│      └─ apply_smart_posting_rules() → Auto-map COA → rules       │
├────────────────────────────────────────────────────────────────────┤
│                       DATA LAYER                                   │
│                                                                    │
│  Models:                                                           │
│  ├─ ChartOfAccount (TenantModel)   → Hierarchical COA             │
│  └─ FinancialAccount (TenantModel) → Physical accounts (bank/cash)│
│                                                                    │
│  Templates:                                                        │
│  └─ erp/coa_templates.py (TEMPLATES dict)                         │
│      ├─ IFRS_COA      (~65 accounts)                              │
│      ├─ LEBANESE_PCN   (~25 accounts)                             │
│      ├─ FRENCH_PCG     (~25 accounts)                             │
│      ├─ USA_GAAP       (~20 accounts)                             │
│      └─ SYSCOHADA_REVISED (~30 accounts)                          │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Layer

### 2.1 Data Model

#### `ChartOfAccount` (`apps/finance/models/coa_models.py`)

| Field | Type | Description |
|-------|------|-------------|
| `code` | CharField(50) | Account code (e.g., "1110", "41", "4101") |
| `name` | CharField(255) | Account name (e.g., "Accounts Receivable") |
| `description` | TextField | Optional description |
| `type` | CharField(20) | `ASSET`, `LIABILITY`, `EQUITY`, `INCOME`, `EXPENSE` |
| `sub_type` | CharField(50) | `BANK`, `CASH`, `RECEIVABLE`, `PAYABLE`, `INVENTORY`, etc. |
| `parent` | ForeignKey(self) | Parent account (hierarchical tree via self-referencing FK) |
| `balance` | Decimal(15,2) | Total balance (INTERNAL scope) |
| `balance_official` | Decimal(15,2) | Official balance (OFFICIAL scope) |
| `is_active` | Boolean | Whether the account is active (deactivated on migration/reset) |
| `is_system_only` | Boolean | System-generated accounts (auto-created for bank/cash) |
| `is_hidden` | Boolean | Hidden from normal views (clearing/control accounts) |
| `requires_zero_balance` | Boolean | Must be zero before fiscal closure |
| `syscohada_code` | CharField(20) | Cross-reference to SYSCOHADA standard |
| `syscohada_class` | CharField(10) | SYSCOHADA class mapping |
| `organization` | ForeignKey | Tenant isolation (from `TenantModel`) |

**Constraints**:
- `unique_together = ('code', 'organization')` — codes are unique per org
- `db_table = 'chartofaccount'`

#### `FinancialAccount` (`apps/finance/models/coa_models.py`)

Physical bank/cash accounts linked back to the COA for ledger posting.

| Field | Type | Description |
|-------|------|-------------|
| `name` | CharField(255) | Account name (e.g., "Main Cash Register") |
| `type` | CharField(50) | `CASH`, `BANK`, `MOBILE`, `PETTY_CASH`, `SAVINGS`, `FOREIGN`, `ESCROW`, `INVESTMENT` |
| `currency` | CharField(10) | Currency code (default: USD) |
| `balance` | Decimal(15,2) | Current balance |
| `is_pos_enabled` | Boolean | Available for POS transactions |
| `site` | ForeignKey(Warehouse) | Optional branch/site assignment |
| `ledger_account` | ForeignKey(ChartOfAccount) | Link to COA for journal entries |

---

### 2.2 COA Templates (Backend)

**File**: `erp_backend/erp/coa_templates.py`

The backend maintains its own **authoritative** template definitions (the frontend also has templates for preview, but the backend is the **source of truth for import**).

#### Available Templates

| Key | Name | Standard | Region | Accounts |
|-----|------|----------|--------|----------|
| `IFRS_COA` | IFRS Standard | International Financial Reporting Standards | 🌍 International | ~65 |
| `LEBANESE_PCN` | Lebanese PCN | Plan Comptable National Libanais | 🇱🇧 Lebanon | ~25 |
| `FRENCH_PCG` | French PCG | Plan Comptable Général | 🇫🇷 France | ~25 |
| `USA_GAAP` | US GAAP | Generally Accepted Accounting Principles | 🇺🇸 United States | ~20 |
| `SYSCOHADA_REVISED` | SYSCOHADA Revised | Revised OHADA System | 🌍 West/Central Africa | ~30 |

#### Template Account Schema

```python
{
    "code": "1110",           # Account code
    "name": "Accounts Receivable",
    "type": "ASSET",          # ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
    "sub_type": "RECEIVABLE", # Optional classification
    "parent_code": "1100",    # Hierarchy via parent reference
    "syscohada_code": "41",   # SYSCOHADA cross-reference
    "syscohada_class": "Class 4",
    "is_system_only": False,
    "is_hidden": False,
    "requires_zero_balance": False
}
```

**Format**: Templates are **flat lists** with `parent_code` pointers. Hierarchy is built in a **two-pass process**:
1. **Pass 1**: Create/update all accounts without parent relationships
2. **Pass 2**: Set `parent` FK by looking up `parent_code` in the account map

---

### 2.3 Services

#### `LedgerCOAMixin` (`apps/finance/services/ledger_coa.py`)

##### `apply_coa_template(organization, template_key, reset=False)`

The core template application engine.

**Flow**:
1. Looks up template from `erp.coa_templates.TEMPLATES`
2. Wraps everything in `transaction.atomic()`
3. **Reset mode**:
   - If journal entries exist → deactivates old accounts (`is_active=False`)
   - If NO journal entries → deletes old accounts entirely
4. **Two-pass account creation**:
   - Pass 1: `update_or_create` all accounts (code + org = unique key)
   - Pass 2: Set parent relationships via `parent_code` lookup
5. Deactivates accounts NOT in the new template (if reset + had JEs)
6. **Auto-triggers** `ConfigurationService.apply_smart_posting_rules()`

```python
# Backend call:
LedgerService.apply_coa_template(organization, "IFRS_COA", reset=True)
```

##### `migrate_coa(organization, mappings, description)`

Moves balances from old accounts to new accounts and deactivates the old ones.

**Flow**:
1. Wraps in `transaction.atomic()`
2. For each mapping `{sourceId, targetId}`:
   - Reads `balance_official` and `balance` (total) from source
   - Creates **2 journal entries** if needed:
     - **OFFICIAL scope JE**: Moves `balance_official` (debit → credit)
     - **INTERNAL scope JE**: Moves the internal-only difference
   - Deactivates source account (`is_active = False`)
3. Auto-applies smart posting rules for the new COA structure

**Journal Entry Generation**:
- Positive source balance → Credit source, Debit target
- Negative source balance → Debit source, Credit target
- Reference format: `MIG-OFF-XXXXXX` / `MIG-INT-XXXXXX`

##### `get_chart_of_accounts(organization, scope, include_inactive)`

High-performance COA tree retrieval with SQL-aggregated balances.

**Optimization**: Uses a single `JournalEntryLine` aggregate query instead of N+1 balance lookups:
```python
balance_map = {
    b['account_id']: Decimal(b['net'])
    for b in lines_qs.values('account_id').annotate(net=Sum('debit') - Sum('credit'))
}
```

Then builds the tree in-memory with rollup balances.

##### Other Methods

| Method | Purpose |
|--------|---------|
| `get_trial_balance(org, date, scope)` | Full trial balance with hierarchy rollup |
| `get_profit_loss(org, start, end, scope)` | Income/Expense summary with net income |
| `get_balance_sheet(org, date, scope)` | Assets/Liabilities/Equity with balanced check |
| `validate_closure(org, period, year)` | Ensures control accounts have zero balance |
| `get_account_statement(org, id, start, end, scope)` | Drill-down into a single account's movements |
| `create_linked_account(org, name, type, sub_type, parent_id)` | Create child account under a parent |

---

### 2.4 API Endpoints

#### `ChartOfAccountViewSet` (`apps/finance/views/account_views.py`)

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/coa/templates/` | List available template keys |
| `GET` | `/coa/coa/?scope=OFFICIAL&include_inactive=true` | Get full COA tree with rollup balances |
| `POST` | `/coa/apply_template/` | Apply template `{template_key, reset}` |
| `POST` | `/coa/migrate/` | Migrate `{mappings: [{sourceId, targetId}], description}` |
| `GET` | `/coa/{id}/statement/?start_date=&end_date=&scope=` | Account statement drill-down |
| `GET` | `/coa/trial_balance/?as_of=&scope=` | Trial balance report |

**Scope Isolation**: All endpoints enforce strict scope rules via `get_authorized_scope()`:
- Users with `OFFICIAL` scope cannot view `INTERNAL` data
- Scope defaults to `OFFICIAL` if not specified

#### `FinancialAccountViewSet`

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/finance/financial-accounts/` | List physical accounts (RBAC filtered) |
| `POST` | `/finance/financial-accounts/` | Create account (auto-creates child COA entry) |
| `POST` | `/finance/financial-accounts/{id}/assign_user/` | Assign cashier to register |
| `POST` | `/finance/financial-accounts/{id}/remove_user/` | Unassign cashier |
| `DELETE` | `/finance/financial-accounts/{id}/` | Delete account |

**Financial Account Creation Logic** (important!):
When creating a `FinancialAccount`, the system automatically:
1. Resolves the parent COA from posting rules (e.g., `automation.customerRoot`)
2. If no rules → falls back to `sub_type` matching
3. Generates a child code: `{parent.code}.{NNN}` (e.g., `1101.001`)
4. Creates both the `ChartOfAccount` child AND the `FinancialAccount` atomically

---

### 2.5 ConfigurationService (Posting Rules Engine)

**File**: `erp_backend/erp/services.py`

#### `get_posting_rules(organization)`

Reads posting rules from `organization.settings['finance_posting_rules']` JSON field.

**Default Structure** (9 sections, 30+ rule keys):

```python
{
    "sales": {
        "receivable": None,    # Accounts Receivable
        "revenue": None,       # Revenue / Income
        "cogs": None,          # Cost of Goods Sold
        "inventory": None,     # Inventory asset
        "round_off": None,     # POS rounding difference
        "discount": None,      # Sales discount
        "vat_collected": None,  # VAT collected on sales
    },
    "purchases": {
        "payable": None,            # Accounts Payable
        "inventory": None,          # Purchase inventory staging
        "expense": None,            # Purchase expense
        "vat_recoverable": None,    # VAT input (recoverable)
        "vat_suspense": None,       # VAT suspense (cash-basis)
        "airsi_payable": None,      # AIRSI withholding
        "reverse_charge_vat": None, # Reverse-charge VAT
        "discount_earned": None,    # Purchase discount
        "delivery_fees": None,      # Delivery fee expense
        "airsi": None,              # AIRSI reference
    },
    "inventory": {
        "adjustment": None,    # Stock adjustment gain/loss
        "transfer": None,      # Inter-warehouse transit
    },
    "automation": {
        "customerRoot": None,  # Parent for auto-created customer accounts
        "supplierRoot": None,  # Parent for auto-created supplier accounts
        "payrollRoot": None,   # Parent for auto-created payroll accounts
    },
    "fixedAssets": {
        "depreciationExpense": None,
        "accumulatedDepreciation": None,
    },
    "suspense": {
        "reception": None,     # Goods-in-transit suspense
    },
    "partners": {
        "capital": None,       # Partner capital
        "loan": None,          # Partner loan
        "withdrawal": None,    # Partner withdrawal
    },
    "equity": {
        "capital": None,       # Owner capital
        "draws": None,         # Owner draws
    },
    "tax": {
        "vat_payable": None,          # VAT settlement control
        "vat_refund_receivable": None, # VAT refund receivable
    }
}
```

#### `apply_smart_posting_rules(organization)`

Auto-maps COA accounts to posting rules using a **multi-standard code search**:

**Search Priority** (for each rule):
1. IFRS codes (e.g., `1110` for Receivable)
2. USA GAAP codes (e.g., `1200`)
3. SYSCOHADA/PCG codes (e.g., `41`)
4. Lebanese PCN codes
5. Fallback by `type` + `name` keyword match

**Example** (how `sales.receivable` is resolved):
```python
config['sales']['receivable'] = (
    find('1110') or     # IFRS
    find('1200') or     # USA GAAP
    find('411') or      # French PCG
    find('41') or       # SYSCOHADA
    find_by_type('ASSET', 'receivable') or  # Keyword fallback
    config['sales']['receivable']            # Keep existing
)
```

This runs for ALL 30+ posting rules automatically after every template import or migration.

---

## 3. Frontend Layer

### 3.1 Server Actions

#### `coa-setup.ts` — Setup Lifecycle Tracking

Tracks the COA setup progress as a state machine:

```
NOT_STARTED → TEMPLATE_SELECTED → TEMPLATE_IMPORTED → MIGRATION_PENDING → POSTING_RULES_PENDING → COMPLETED
```

| Action | Description |
|--------|-------------|
| `getCOASetupStatus()` | Get current setup state from backend |
| `updateCOASetupStatus(updates)` | Update setup progress |
| `completeCOASetup()` | Mark setup as complete |
| `isCOASetupComplete()` | Check if setup is done |

#### `coa-templates.ts` — Template Operations

| Action | Description |
|--------|-------------|
| `importChartOfAccountsTemplate(key, {reset})` | Import template to backend via `coa/apply_template/` + auto-apply smart posting rules |
| `getAllTemplates()` | Get all template definitions (for preview) |
| `getTemplatePreview(key)` | Preview a single template's accounts |
| `migrateBalances({mappings, description})` | Migrate balances via `coa/migrate/` + auto-apply smart posting rules |
| `sweepInactiveBalances()` | *Placeholder — not yet implemented* |

**Important**: The frontend `coa-templates.ts` contains **nested/hierarchical** template definitions (with `children` arrays) for UI preview. The backend `coa_templates.py` contains **flat** definitions (with `parent_code` pointers) for actual import. Both must stay in sync.

#### `posting-rules.ts` — Posting Rules Management

| Action | Description |
|--------|-------------|
| `getPostingRules()` | Fetch current posting rules config |
| `savePostingRules(config)` | Save rules (without reclassification) |
| `savePostingRulesWithReclassification(config)` | Save rules AND reclassify existing JEs |
| `analyzePostingRulesImpact(config)` | Dry-run: show what would change (risk analysis) |
| `applySmartPostingRules()` | Trigger auto-mapping on server |

---

### 3.2 Pages & UI

| Route | File | Description |
|-------|------|-------------|
| `/finance/setup` | `(privileged)/finance/setup/page.tsx` | **COA Setup Wizard** — 4-step guided setup |
| `/finance/chart-of-accounts` | `(privileged)/finance/chart-of-accounts/page.tsx` | COA tree browser with balances |
| `/finance/chart-of-accounts/templates` | `.../templates/page.tsx` | Template selection & import |
| `/finance/chart-of-accounts/migrate` | `.../migrate/page.tsx` | Balance migration tool |
| `/finance/chart-of-accounts/[id]` | `.../[id]/page.tsx` | Account detail & statement drill-down |
| `/finance/settings/posting-rules` | `.../posting-rules/form.tsx` | Posting rules configuration form |

---

### 3.3 COA Setup Wizard

**File**: `src/app/(privileged)/finance/setup/wizard.tsx`

A 4-step wizard that guides users through initial COA configuration:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. Select  │───→│  2. Import  │───→│ 3. Posting  │───→│ 4. Complete │
│  Template   │    │  Template   │    │   Rules     │    │  Finalize   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

#### Step 1: Select Template
- Displays 5 available templates with region flags and account counts
- User selects one (cards with radio-button UX)
- Saves status as `TEMPLATE_SELECTED`

#### Step 2: Import Template
- Shows import mode selection:
  - **Clean Start** (Reset = true): Replaces all existing accounts
  - **Keep Existing** (Reset = false): Merges new accounts
  - **Import from File** (planned): Upload custom COA
- Executes `importChartOfAccountsTemplate(key, { reset })`
- Shows progress animation during import
- Auto-triggers smart posting rules
- Saves status as `TEMPLATE_IMPORTED`

#### Step 3: Configure Posting Rules
- Links to `/finance/settings/posting-rules`
- User maps COA accounts to operational categories (Sales, Purchases, Inventory, etc.)
- Can use "Auto-Detect" to pre-fill based on account codes/names
- Supports impact analysis (dry-run) before saving

#### Step 4: Finalize
- Summary of imported accounts and configured rules
- "Complete Setup" button marks as `COMPLETED`
- Can "Reopen" setup to make changes

---

### 3.4 Posting Rules Form

**File**: `src/app/(privileged)/finance/settings/posting-rules/form.tsx`

A comprehensive form with 9 sections and 30+ account selectors:

| Section | Fields | Purpose |
|---------|--------|---------|
| **Sales** | receivable, revenue, cogs, inventory, round_off, discount, vat_collected | Sales posting targets |
| **Purchases** | payable, inventory, expense, vat_recoverable, vat_suspense, airsi_payable, reverse_charge_vat, discount_earned, delivery_fees, airsi | Purchase posting targets |
| **Inventory** | adjustment, transfer | Stock adjustment & transit |
| **Automation** | customerRoot, supplierRoot, payrollRoot | Auto-ledger parents for new entities |
| **Fixed Assets** | depreciationExpense, accumulatedDepreciation | Asset depreciation posting |
| **Suspense** | reception | Goods-in-transit clearing |
| **Partners** | capital, loan, withdrawal | Partner equity |
| **Equity** | capital, draws | Owner equity |
| **Tax** | vat_payable, vat_refund_receivable | VAT settlement control |

**Key Features**:
- **Auto-Detect** button: Runs client-side code-matching (same logic as backend `apply_smart_posting_rules`)
- **Impact Analysis**: Before saving, shows which existing journal entries would be affected
- **Reclassification**: Option to automatically reclassify existing JEs when rules change
- **Risk Indicator**: Highlights HIGH risk changes (large balance impacts)

---

### 3.5 COA Migration Modal

**File**: `src/modules/migration/components/COAMappingModal.tsx`

Used during data migration to map imported accounts to existing COA accounts.

**Features**:
- Auto-mapping via tokenized name similarity
- Account type matching (ASSET→ASSET, LIABILITY→LIABILITY, etc.)
- Sub-type awareness (BANK, CASH, RECEIVABLE, PAYABLE)
- Manual override via dropdown selectors
- Validation before save

---

## 4. Workflows

### 4.1 Initial COA Setup (New Organization)

```
1. User navigates to /finance/setup
2. Wizard Step 1: Select Template
   └─ User picks IFRS, SYSCOHADA, PCG, USA GAAP, or Lebanese PCN
3. Wizard Step 2: Import Template
   ├─ Frontend calls: importChartOfAccountsTemplate("IFRS_COA", { reset: true })
   ├─ Server action calls: erpFetch('coa/apply_template/', { template_key, reset })
   ├─ Backend: LedgerService.apply_coa_template(org, "IFRS_COA", True)
   │   ├─ Pass 1: Creates ~65 accounts via update_or_create
   │   ├─ Pass 2: Sets parent relationships via parent_code lookup
   │   └─ Auto-calls: ConfigurationService.apply_smart_posting_rules(org)
   │       └─ Scans new accounts by code (1110→receivable, 2101→payable, etc.)
   └─ Frontend receives success → updates setup status to TEMPLATE_IMPORTED
4. Wizard Step 3: Configure Posting Rules
   ├─ User navigates to /finance/settings/posting-rules
   ├─ Form loads with pre-populated rules (from smart-apply)
   ├─ User reviews/adjusts mappings
   └─ Saves via savePostingRules(config)
5. Wizard Step 4: Finalize
   └─ completeCOASetup() → status = COMPLETED
```

### 4.2 Import / Switch Template

```
1. Navigate to /finance/chart-of-accounts/templates
2. Select new template (e.g., switch from IFRS to SYSCOHADA)
3. Choose import mode:
   ├─ Clean Start (reset=true):
   │   ├─ If journal entries exist → old accounts deactivated (not deleted)
   │   └─ If no journal entries → old accounts deleted
   └─ Keep Existing (reset=false):
       └─ New accounts merged in (update_or_create by code)
4. Backend creates new accounts and auto-applies posting rules
5. User reviews posting rules (now mapped to new standard's codes)
```

### 4.3 Migrate Between Standards

```
1. Navigate to /finance/chart-of-accounts/migrate
2. Define mappings: old account → new account
   Example: { sourceId: 41 (Clients), targetId: 1110 (Accounts Receivable) }
3. Backend: LedgerService.migrate_coa(org, mappings, description)
   ├─ For each mapping:
   │   ├─ Reads balance_official + balance from source
   │   ├─ Creates OFFICIAL JE (MIG-OFF-XXXXXX): debit target, credit source
   │   ├─ Creates INTERNAL JE (MIG-INT-XXXXXX): for internal-only difference
   │   └─ Deactivates source account (is_active=False)
   └─ Auto-applies smart posting rules for new structure
4. Old accounts are deactivated but preserved for audit trail
5. Frontend revalidates /finance/chart-of-accounts and /finance/settings/posting-rules
```

### 4.4 Auto Posting Rules

The system supports two auto-detection mechanisms:

#### Backend Auto-Detection (`ConfigurationService.apply_smart_posting_rules`)
- Called automatically after every template import or migration
- Scans ALL active accounts by code and name
- Uses multi-standard priority: IFRS → USA GAAP → SYSCOHADA → PCG → Keyword
- Writes results to `organization.settings['finance_posting_rules']`

#### Frontend Auto-Detection (`PostingRulesForm.autoDetect`)
- Triggered by "Auto-Detect" button on the posting rules form
- Runs the same code-matching logic client-side
- Updates form state (user can review before saving)
- Same multi-standard priority

---

## 5. Features

### 5.1 Multi-Standard Support
✅ 5 international accounting standards (IFRS, USA GAAP, French PCG, SYSCOHADA, Lebanese PCN)
✅ Cross-references between standards (e.g., `syscohadaCode` on IFRS accounts)
✅ Region-specific hierarchies (7-class French system vs. numbered IFRS system)

### 5.2 Hierarchical Tree Structure
✅ Self-referencing parent/child relationships
✅ Rollup balances (parent balance = sum of children)
✅ Tree visualization in UI

### 5.3 Dual-Scope Accounting
✅ OFFICIAL scope: External/tax-visible transactions
✅ INTERNAL scope: All transactions including internal
✅ Separate balance fields per scope
✅ Scope enforcement via middleware

### 5.4 Smart Posting Rules
✅ Auto-detection from account codes/names
✅ Multi-standard code priority search
✅ 30+ configurable rule keys across 9 categories
✅ Impact analysis and risk assessment before changes

### 5.5 Safe Migration
✅ Atomic transactions (all-or-nothing)
✅ Balance transfer via journal entries (audit trail)
✅ Source accounts deactivated (never deleted if JEs exist)
✅ Automatic reclass of posting rules after migration

### 5.6 System & Control Accounts
✅ Auto-created system accounts (POS Rounding, Stock Adjustment, Exchange Diff)
✅ Control accounts with zero-balance requirement
✅ Hidden accounts (not shown in normal views)
✅ Fiscal closure validation

### 5.7 Financial Account Auto-Linking
✅ Creating a bank/cash account auto-creates a child COA entry
✅ Parent resolved from posting rules (no hardcoded codes)
✅ Child code auto-generated: `{parent.code}.{NNN}`
✅ RBAC-gated creation (requires `finance.account.manage`)

---

## 6. Posting Rules Governance

> **Iron Rule**: Every COA account ID in production code MUST be resolved dynamically from `ConfigurationService.get_posting_rules(organization)`. **Zero hardcoded COA codes** in production.

### Approved Pattern
```python
rules = ConfigurationService.get_posting_rules(organization)
acc_id = rules.get('sales', {}).get('receivable')
if not acc_id:
    raise ValidationError("'Accounts Receivable' not configured in posting rules. Go to Finance → Settings → Posting Rules.")
```

### Banned Patterns
| Pattern | Why |
|---------|-----|
| `ChartOfAccount.objects.filter(code='411')` | Hardcoded — breaks multi-template orgs |
| `_COA = {'AR': '411', 'REVENUE': '701'}` | Static dictionaries can't adapt per org |
| `if not acc_id: return None` | Silent skip → accounting corruption |
| `except Exception: pass` around JE creation | Swallowed errors → invisible data loss |
| `get_or_create(code='5700', ...)` | Creates orphan accounts |

### Files Using Posting Rules (20 production files)
See: `knowledge/tsfsystem_finance_module_infrastructure/artifacts/implementation/posting_rules_governance.md`

---

## 7. Troubleshooting

### Template Import Fails
- **Check**: Template key matches exactly between frontend (`coa-templates.ts` TEMPLATES) and backend (`erp/coa_templates.py` TEMPLATES)
- **Check**: Account codes don't conflict with existing accounts (use reset=true for clean start)

### Accounts Missing Parents After Import
- Verify `parent_code` in the template matches the `code` of another account
- Ensure the 2nd pass of `apply_coa_template` ran successfully
- Check encoding issues (French accents like `é` in names)

### Posting Rules Not Auto-Detecting
- The account codes must exist in the active COA
- Smart detection searches by exact code first, then by type+name keyword
- If your template uses non-standard codes, use the manual form

### Migration Fails
- Ensure both source and target accounts belong to the same organization
- Source accounts must have non-zero balances for JEs to be created
- Check for database locks or concurrent access

### Trial Balance Not Balanced
- Run `recalculateAccountBalances()` from the ledger admin
- Check for orphan journal entry lines (entries without proper debit/credit pairs)
- Verify scope parameter (OFFICIAL vs INTERNAL)

### FinancialAccount Creation Fails
- "No parent COA found" → Configure posting rules first (Settings → Posting Rules)
- "POS accounts must be ASSET type" → Selected COA parent must be ASSET type

---

## 📎 Related Files Reference

### Backend
| File | Purpose |
|------|---------|
| `erp_backend/apps/finance/models/coa_models.py` | ChartOfAccount + FinancialAccount models |
| `erp_backend/apps/finance/serializers/coa_serializers.py` | DRF serializers |
| `erp_backend/apps/finance/services/ledger_coa.py` | Core COA service (apply, migrate, query) |
| `erp_backend/apps/finance/views/account_views.py` | ChartOfAccountViewSet + FinancialAccountViewSet |
| `erp_backend/erp/coa_templates.py` | Template definitions (backend source of truth) |
| `erp_backend/erp/services.py` | ConfigurationService (posting rules get/set/smart-apply) |
| `erp_backend/erp/views_system.py` | System endpoints (posting rules, COA setup status) |
| `erp_backend/seed.py` | Initial org seeding (applies template + smart rules) |

### Frontend
| File | Purpose |
|------|---------|
| `src/app/actions/finance/coa-setup.ts` | Setup wizard lifecycle actions |
| `src/app/actions/finance/coa-templates.ts` | Template import/preview/migration actions |
| `src/app/actions/finance/posting-rules.ts` | Posting rules CRUD + smart-apply actions |
| `src/app/(privileged)/finance/setup/page.tsx` | Setup wizard page (server component) |
| `src/app/(privileged)/finance/setup/wizard.tsx` | Setup wizard component (4 steps) |
| `src/app/(privileged)/finance/settings/posting-rules/form.tsx` | Posting rules form (9 sections) |
| `src/modules/migration/components/COAMappingModal.tsx` | Migration account mapping modal |
