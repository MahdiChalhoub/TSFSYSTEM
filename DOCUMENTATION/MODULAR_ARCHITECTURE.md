# Modular Architecture Documentation

## Goal
The Dajingo ERP platform uses a 4-layer modular architecture: **Engine → Kernel → Core → Modules**. Business logic is physically isolated into independent Django apps under `apps/`, while the kernel (`erp/`) provides infrastructure, multi-tenancy, and backward-compatible re-exports.

## Architecture Overview

```
erp/                              ← KERNEL (infrastructure only)
├── models.py       (800 lines)    Organization, User, Site, TenantModel + re-exports
├── services.py     (260 lines)    ProvisioningService, ConfigurationService + re-exports
├── serializers/    (75 lines)     Kernel serializers + re-exports
├── views.py        (1,244 lines)  TenantModelViewSet, Dashboard, Settings + re-exports
├── urls.py                        Auth/SaaS routes + include() for modules
├── connector_engine.py (1,129 lines) Module-to-module runtime broker
├── connector_models.py            Connector data models
└── middleware.py                   Tenant context middleware

apps/                             ← MODULES (business logic)
├── finance/       (27 models)     Accounts, Journals, Invoices, Payments, Loans, Assets, Tax
├── inventory/     (27 models)     Products, Units, Warehouses, Stock, Movements, Alerts, Counting
├── pos/           (20 models)     Orders, PurchaseOrders, Returns, Quotations, Consignment, Delivery, Discounts, Sourcing
├── crm/           (1 model)       Contacts + Pricing (3 pricing models via pricing_models.py)
├── hr/            (5 models)      Employee, Department, Shift, Attendance, Leave
├── workspace/     (17 models)     Tasks, Checklists, Questionnaires, KPI, Scores
├── client_portal/ (11 models)     Portal config, access, orders, tickets, wallet
├── supplier_portal/ (6 models)    Portal auth, proformas, price requests, notifications
├── mcp/           (7 models)      AI providers, tools, conversations, usage
├── storage/       (3 models)      StorageProvider, StoredFile
├── ecommerce/     (3 models)      Storefront config
├── migration/     (2 models)      Data migration tasks
├── packages/      (1 model)       Module packages
└── core/          (1 model)       System settings

Total: 162 business models + 7 Django contrib models = 169 total

src/engine/                       ← FRONTEND ENGINE (zero-logic infra)
src/kernel/                       ← FRONTEND KERNEL (auth, tenant, modules)
src/modules/                      ← FRONTEND MODULES (isolated UI components)
src/storefront/                   ← STOREFRONT THEME ENGINE
```

## Database Tables

### SystemModule (Global Catalog)
- **Purpose**: Tracks all modules installed in the system
- **Columns**: name, version, description, manifest (JSON), status, checksum
- **Read by**: SaaS Panel, ConnectorEngine, Module Manager
- **Written by**: Module upload/install workflow

### OrganizationModule (Tenant Attachment)
- **Purpose**: Links modules to specific organizations
- **Columns**: organization_id, module_name, is_enabled, active_features (JSON)
- **Read by**: ConnectorEngine (state checks), Module Manager
- **Written by**: SaaS admin panel, tenant Module Manager

## Kernel ViewSets (erp/views.py)
- **TenantModelViewSet**: Base class for multi-tenant data isolation
- **UserViewSet**: User management
- **OrganizationViewSet**: SaaS organization lifecycle
- **SiteViewSet**: Multi-site support
- **CountryViewSet**: Country reference data + product hierarchy
- **RoleViewSet**: Role management
- **TenantResolutionView**: Public slug-to-ID resolver
- **SettingsViewSet**: Configuration and posting rules
- **DashboardViewSet**: Cross-module aggregation (admin, SaaS, financial stats)
- **health_check**: System status endpoint

## Module ViewSets (apps/X/views.py)

### Finance (apps/finance/views.py — 1,860 lines)
FinancialAccountViewSet, ChartOfAccountViewSet, FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet, BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet, TransactionSequenceViewSet, InvoiceViewSet, PaymentViewSet, VoucherViewSet, AssetViewSet, FinancialReportViewSet

### Inventory (apps/inventory/views.py — 2,209 lines)
ProductViewSet, UnitViewSet, WarehouseViewSet, InventoryViewSet, BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet, InventoryMovementViewSet, StockAdjustmentOrderViewSet, StockTransferOrderViewSet, StockAlertViewSet, ExpiryAlertViewSet, StockCountViewSet, WarehouseLocationViewSet, ComboProductViewSet, OperationalRequestViewSet, DataQualityViewSet

### POS (apps/pos/views.py — 1,181 lines)
POSViewSet, PurchaseOrderViewSet, ReturnsViewSet, QuotationViewSet, ConsignmentViewSet, DeliveryViewSet, DiscountViewSet, SourcingViewSet

### CRM (apps/crm/)
ContactViewSet, PriceGroupViewSet, ClientPriceRuleViewSet

### HR (apps/hr/)
EmployeeViewSet, DepartmentViewSet, ShiftViewSet, AttendanceViewSet, LeaveViewSet

### Workspace (apps/workspace/)
TaskViewSet, TaskCategoryViewSet, TaskTemplateViewSet, AutoTaskRuleViewSet, TaskCommentViewSet, EmployeeRequestViewSet, ChecklistTemplateViewSet, ChecklistInstanceViewSet, QuestionnaireViewSet, QuestionnaireResponseViewSet, KPIConfigViewSet, EmployeeScoreViewSet

### Client Portal (apps/client_portal/)
ClientPortalLoginView, StorefrontPublicConfigView, ClientMyOrdersViewSet, ClientMyWalletViewSet, ClientMyTicketsViewSet

### Supplier Portal (apps/supplier_portal/)
SupplierPortalLoginView, SupplierMyOrdersViewSet, SupplierProformaViewSet, SupplierPriceRequestViewSet

### MCP (apps/mcp/)
MCPProviderViewSet, MCPToolViewSet, MCPChatViewSet, MCPConversationViewSet, MCPUsageViewSet, MCPSettingsViewSet

### Storage (apps/storage/)
StorageProviderViewSet, StoredFileViewSet

## ConnectorEngine (Inter-Module Communication)
The ConnectorEngine routes requests between modules using URL-based dispatch (`django.urls.resolve()`). It:
1. Evaluates module state (AVAILABLE, MISSING, DISABLED, UNAUTHORIZED)
2. Forwards requests if available, applies fallback if not
3. Supports circuit breaking, caching, buffering, and event dispatch
4. No direct ViewSet imports — works automatically with any URL structure

## Import Rules
- **Canonical**: `from apps.finance.models import ChartOfAccount`
- **Backward-compatible**: `from erp.models import ChartOfAccount` (re-export)
- **Module → Kernel**: Always allowed (`from erp.models import TenantModel`)
- **Kernel → Module**: Only via re-exports at bottom of kernel files
- **Module → Module**: Only via ConnectorEngine, never direct imports

## Data Movement
- **Read from**: Module models via module services and ViewSets
- **Save to**: Module models via module services (never direct model writes from views)
- **Cross-module**: Via ConnectorEngine `route_read()` and `route_write()`

## Developer Workflow
1. All business code goes in `apps/{module_name}/`
2. Each module has: models.py, views.py, urls.py, serializers.py, services.py, apps.py
3. Module URLs are included via `erp/urls.py` → `path('api/', include('apps.X.urls'))`
4. Use `TenantModelViewSet` as base class for tenant-scoped views
5. Use `from erp.middleware import get_current_tenant_id` for tenant context
6. Cross-module operations go through `connector_engine.route_read/route_write`
