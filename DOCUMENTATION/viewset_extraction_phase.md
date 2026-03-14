# ViewSet Extraction — Module Views Documentation

## Goal
Extract all business-domain ViewSets from the monolithic `erp/views.py` into module-level `views.py` files, completing the backend modularization strategy.

## Pages / Module Views Created

### apps/finance/views.py
- **Goal**: Handle all accounting, ledger, and financial management API endpoints
- **Data READ from**: `apps.finance.models` (9 model tables), `erp.models` (Organization, User)
- **Data SAVED to**: Same models via `apps.finance.services` (LedgerService, LoanService, etc.)
- **ViewSets**: FinancialAccountViewSet, ChartOfAccountViewSet, FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet, BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet, TransactionSequenceViewSet

### apps/inventory/views.py
- **Goal**: Handle product catalog, stock operations, warehouse management, and product taxonomy
- **Data READ from**: `apps.inventory.models` (9 model tables), `erp.models` (Organization, Site)
- **Data SAVED to**: Same models via `apps.inventory.services` (InventoryService)
- **ViewSets**: UnitViewSet, ProductViewSet, WarehouseViewSet, InventoryViewSet, BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet

### apps/pos/views.py
- **Goal**: Handle Point of Sale checkout and Purchase Order lifecycle
- **Data READ from**: `apps.pos.models` (Order), `apps.inventory.models` (Warehouse)
- **Data SAVED to**: Orders, inventory via `apps.pos.services` (POSService, PurchaseService)
- **ViewSets**: POSViewSet, PurchaseViewSet

### apps/crm/views.py
- **Goal**: Handle customer/supplier contact management with auto-linked accounting
- **Data READ from**: `apps.crm.models` (Contact), `apps.finance.models` (ChartOfAccount)
- **Data SAVED to**: Contacts + linked financial accounts via LedgerService
- **ViewSets**: ContactViewSet

### apps/hr/views.py
- **Goal**: Handle employee management with auto-linked payroll accounts
- **Data READ from**: `apps.hr.models` (Employee), `apps.finance.models` (ChartOfAccount)
- **Data SAVED to**: Employees + linked payroll accounts via LedgerService
- **ViewSets**: EmployeeViewSet

## Workflow
1. Client sends HTTP request to module URL route (e.g., `/api/finance/coa/`)
2. Module `urls.py` resolves to module `views.py` ViewSet
3. ViewSet uses `get_current_tenant_id()` for multi-tenancy
4. ViewSet delegates to module service layer
5. Service layer operates on module models
6. Response returned to client

## Database Tables Affected
No schema changes — ViewSets operate on existing models via the service layer.

## URL Routing
Module `urls.py` files now import from `apps.X.views` instead of `erp.views`:
- `apps/finance/urls.py` → `apps.finance.views`
- `apps/inventory/urls.py` → `apps.inventory.views`
- `apps/pos/urls.py` → `apps.pos.views`
- `apps/crm/urls.py` → `apps.crm.views`
- `apps/hr/urls.py` → `apps.hr.views`

## Kernel ViewSets (Remain in erp/views.py)
TenantModelViewSet, UserViewSet, TenantResolutionView, SettingsViewSet, OrganizationViewSet, SiteViewSet, CountryViewSet, RoleViewSet, DashboardViewSet, health_check

## Commit
`[v1.3.0-b006]` VIEWS: Extract 21 ViewSets into 5 module views
