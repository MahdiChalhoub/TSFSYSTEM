# Restored Frontend Module Pages

## Goal
Restore all frontend module pages that were deleted during the architecture migration (engine → kernel → core → modules). Files were recovered from git history into `restored/` and then moved into the live application.

## Pages Restored

### Finance Module (`src/app/(privileged)/finance/`)
- **Dashboard** — Finance overview with recent transactions, P&L preview, quick actions
- **Chart of Accounts** — Hierarchical CoA viewer with migrate & templates tools
- **Ledger** — Journal entry list, create new, opening entries, edit
- **Events** — Financial event tracking (create, view detail)
- **Loans** — Loan management (create, view detail, disburse)
- **Accounts** — Financial account management (cash, bank, mobile)
- **Settings** — Financial settings, posting rules
- **Reports** — P&L, Balance Sheet, Trial Balance, Statement

### Inventory Module (`src/app/(privileged)/inventory/`)
- **Categories** — Category tree hierarchy with maintenance tool
- **Brands** — Brand management with detail pages
- **Units** — Unit hierarchy with calculator
- **Countries** — Country management with detail pages
- **Attributes** — Attribute management
- **Maintenance** — Unified reassignment tool for reorganizing inventory

### Products Module (`src/app/(privileged)/products/`)
- **Product List** — Paginated product list
- **New Product** — Form with category selector
- **Create Group** — Grouped product creation
- **Edit Group** — Group edit form

### CRM Module (`src/app/(privileged)/crm/`)
- **Contacts** — Contact management (customers, suppliers)
- **Contact Form** — Modal for creating contacts

### HR Module (`src/app/(privileged)/hr/`)
- **Employees** — Employee management
- **Employee Form** — Modal for creating employees with system login access

### Purchases Module (`src/app/(privileged)/purchases/`)
- **Purchase Orders** — Purchase order management

### Sales Module (`src/app/(privileged)/sales/`)
- **POS** — Point of sale interface

### Users Module (`src/app/(privileged)/users/`)
- **User Management** — User profiles and access

## Server Actions Restored (`src/app/actions/`)
- `finance/` — accounts, ledger, loans, events, posting-rules, fiscal-year, settings, pricing, coa-templates, inventory-integration, financial-events
- `inventory/` — warehouses, movements, snapshots, adjustments
- `crm/` — contacts
- `commercial/` — purchase orders

### Root Actions
- `attributes.ts`, `barcode-settings.ts`, `brands.ts`, `categories.ts`, `countries.ts`, `inventory.ts`, `maintenance.ts`, `product-groups.ts`

## Components Restored (`src/components/`)
- `admin/` — 11 components: AttributeFormModal, BrandFormModal, BrandManager, CategoryTreeSelector, CountryManager, CreateUnitButton, GroupedProductForm, NamingRuleEditor, UnitCalculator, UnitFormModal, UnitTree
- `admin/categories/` — CategoryTree, CreateCategoryButton
- `admin/maintenance/` — MaintenanceSidebar, UnifiedReassignmentTable
- `pos/` — ProductGrid, TicketSidebar
- `modules/` — Module component utilities

## Data Flow

### Read From
- Django backend at `http://127.0.0.1:8000/api/` via `erpFetch()` utility
- Auth token from cookies (DRF `Token` authentication)
- Tenant context resolved from request subdomain

### Write To
- Django backend via POST/PATCH/DELETE calls through `erpFetch()`
- Page cache via `revalidatePath()` after mutations

## Import Path Mapping
| Old Path | New Path |
|----------|----------|
| `@/app/admin/*` | `@/app/(privileged)/*` |
| `/admin/finance/*` (href) | `/finance/*` |
| `/admin/inventory/*` (href) | `/inventory/*` |
| `revalidatePath('/admin/...')` | `revalidatePath('/...')` |

## API Endpoints Used
All endpoints are accessed via `erpFetch('endpoint/')` → `http://127.0.0.1:8000/api/endpoint/`

| Endpoint | Status | Module |
|----------|--------|--------|
| `auth/me/` | ✅ 200 | Kernel |
| `organizations/` | ✅ 200 | Kernel |
| `dashboard/saas_stats/` | ✅ 200 | Dashboard |
| `categories/` | ✅ 200 | Inventory |
| `brands/` | ✅ 200 | Inventory |
| `products/` | ✅ 200 | Products |
| `units/` | ✅ 200 | Inventory |
| `countries/` | ✅ 200 | Kernel |
| `roles/` | ✅ 200 | Kernel |
| `contacts/` | ✅ 200 | CRM |
| `sites/` | ✅ 200 | Kernel |
| `accounts/` | ✅ 200 | Finance |
| `coa/` | ✅ 200 | Finance |
| `fiscal-years/` | ✅ 200 | Finance |
| `fiscal-periods/` | ✅ 200 | Finance |
| `journal/` | ✅ 200 | Finance |
| `loans/` | ✅ 200 | Finance |
| `financial-events/` | ✅ 200 | Finance |
| `sequences/` | ✅ 200 | Finance |
| `warehouses/` | ✅ 200 | Inventory |
| `employees/` | ✅ 200 | HR |

## Verification
- `npx next build` → **Compiled successfully** (18.0s, exit 0)
- All 21 backend API endpoints return 200 OK
- No remaining `@/app/admin/` import references
- No remaining `/admin/` URL hrefs in page files
- No remaining `revalidatePath('/admin/...')` in action files
- No remaining `erpFetch('/api/...')` double prefix issues
