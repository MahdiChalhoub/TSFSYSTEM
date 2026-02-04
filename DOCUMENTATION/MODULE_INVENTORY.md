# TSFSYSTEM Module Inventory Guide

**Generated:** 2026-02-04  
**Version:** v8.3.5

---

## 1. Backend Modules (Django)

### Engine Modules (`erp_backend/apps/`)
| Module | Path | Status | Description |
|--------|------|--------|-------------|
| **core** | `apps/core/` | ✅ Active | Core platform services |
| **finance** | `apps/finance/` | ✅ Active | Chart of Accounts, Journal Entries, Ledger, Loans |

### Kernel Modules (`erp_backend/erp/modules/`)
| Module | Path | Status | Description |
|--------|------|--------|-------------|
| **coreplatform** | `erp/modules/coreplatform/` | ✅ Active | Multi-tenancy, modular injection, security |

### Core Services (`erp_backend/erp/`)
| Service | File | Description |
|---------|------|-------------|
| `ModuleManager` | `module_manager.py` | Module lifecycle: sync, upgrade, rollback |
| `KernelManager` | `kernel_manager.py` | Kernel updates: stage, apply |
| `AuditService` | `services_audit.py` | Universal audit logging |
| `WorkflowService` | `services_workflow.py` | Conditional approval workflows |

---

## 2. Frontend Pages

### Admin Routes (`src/app/(privileged)/admin/`)
| Route | Path | Status |
|-------|------|--------|
| Dashboard | `/admin/` | ✅ Active |
| **Inventory** | `/admin/inventory/` | ✅ Active |
| ├── Adjustments | `/admin/inventory/adjustments/` | ✅ Active |
| ├── Attributes | `/admin/inventory/attributes/` | ⚠️ Missing action file |
| ├── Barcode | `/admin/inventory/barcode/` | ⚠️ Missing action file |
| ├── Brands | `/admin/inventory/brands/` | ⚠️ Missing action file |
| ├── Categories | `/admin/inventory/categories/` | ⚠️ Missing components |
| ├── Countries | `/admin/inventory/countries/` | ⚠️ Missing action file |
| ├── Global | `/admin/inventory/global/` | ✅ Active |
| ├── Maintenance | `/admin/inventory/maintenance/` | ⚠️ Missing components |
| ├── Units | `/admin/inventory/units/` | ⚠️ Missing action file |
| └── Warehouses | `/admin/inventory/warehouses/` | ✅ Active |
| **Products** | `/admin/products/` | ⚠️ Missing action files |
| **Settings** | `/admin/settings/` | ✅ Active |

### SaaS Routes (`src/app/(privileged)/saas/`)
| Route | Path | Status |
|-------|------|--------|
| Dashboard | `/saas/dashboard/` | ✅ Active |
| **Finance** (48 files) | `/saas/finance/` | ✅ Active |
| ├── Ledger | `/saas/finance/ledger/` | ✅ Active |
| ├── Chart of Accounts | `/saas/finance/coa/` | ✅ Active |
| ├── Accounts | `/saas/finance/accounts/` | ✅ Active |
| └── Reports | `/saas/finance/reports/` | ✅ Active |
| Modules | `/saas/modules/` | ✅ Active |
| Organizations | `/saas/organizations/` | ✅ Active |
| Updates | `/saas/updates/` | ✅ Active |
| **demo** | `/saas/demo/` | 🗑️ Ghost (DELETE) |
| **test_vantage** | `/saas/test_vantage/` | 🗑️ Ghost (DELETE) |

---

## 3. Frontend Action Files

### Root Actions (`src/app/actions/`)
| File | Purpose |
|------|---------|
| `auth.ts` | Authentication actions |
| `context.ts` | Context utilities |
| `manager.ts` | Management utilities |
| `modules.ts` | Module management |
| `onboarding.ts` | Onboarding flow |
| `people.ts` | People/user management |
| `sequences.ts` | Sequence generators |
| `settings.ts` | Application settings |
| `sites.ts` | Site management |

### Finance Actions (`src/app/actions/finance/`)
| File | Purpose |
|------|---------|
| `accounts.ts` | Account management |
| `coa-templates.ts` | Chart of Accounts templates |
| `dashboard.ts` | Finance dashboard |
| `diagnostics.ts` | Diagnostic utilities |
| `financial-accounts.ts` | Financial accounts |
| `financial-events.ts` | Transaction events |
| `fiscal-year.ts` | Fiscal year management |
| `inventory-integration.ts` | Finance-Inventory integration |
| `ledger.ts` | Journal entries |
| `loans.ts` | Loan management |
| `posting-rules.ts` | Posting rules |
| `pricing.ts` | Pricing rules |
| `settings.ts` | Finance settings |
| `system.ts` | System utilities |
| `ui-actions.ts` | UI actions |

### Inventory Actions (`src/app/actions/inventory/`)
| File | Purpose |
|------|---------|
| `movements.ts` | Stock movements |
| `product-actions.ts` | Product search |
| `viewer.ts` | Inventory viewer |
| `warehouses.ts` | Warehouse management |

### SaaS Actions (`src/app/actions/saas/`)
| File | Purpose |
|------|---------|
| `modules.ts` | SaaS module management |
| `registration.ts` | Tenant registration |
| `system.ts` | System management |

---

## 4. Missing/Required Files

### Action Files Needed (Inventory Module)
```
src/app/actions/inventory/
├── brands.ts           # getBrands, getBrandsByCategory
├── categories.ts       # getCategories, getCategoryTree
├── countries.ts        # getCountries
├── units.ts            # getUnits
└── barcode-settings.ts # getBarcodeSettings
```

### Components Needed
```
src/components/admin/
├── ProductReassignmentTable.tsx
├── AttributeManager.tsx (if missing)
└── CategorySelector.tsx (if missing)
```

---

## 5. Ghost Routes to Delete

| Route | Path | Reason |
|-------|------|--------|
| `/saas/demo/` | `src/app/(privileged)/saas/demo/` | Test module removed |
| `/saas/test_vantage/` | `src/app/(privileged)/saas/test_vantage/` | Test module removed |

---

*This guide should be updated when adding new modules.*
