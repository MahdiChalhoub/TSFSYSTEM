# Provisioning Event Chain Documentation

## Goal
When a new tenant organization is created via `ProvisioningService.provision_organization()`, the ConnectorEngine dispatches an `org:provisioned` event to all subscriber modules. Each module sets up its infrastructure for the new tenant.

## Flow

```
ProvisioningService.provision_organization(name, slug)
│
├── 1. Kernel creates: Organization, Site, Warehouse
│   (committed in atomic transaction)
│
└── 2. ConnectorEngine.dispatch_event('org:provisioned', {...})
    │
    ├── → apps/finance/events.py  → _on_org_provisioned()
    │   ├── FiscalYear (1)
    │   ├── FiscalPeriod (12 monthly)
    │   ├── ChartOfAccount (17 standard accounts)
    │   ├── Cash Drawer ChartOfAccount
    │   ├── FinancialAccount (Cash Drawer, linked to CoA)
    │   ├── Posting Rules (auto-mapped via ConfigurationService)
    │   └── Global Financial Settings (saved to Organization.settings)
    │
    ├── → apps/crm/events.py  → _on_org_provisioned()
    │   ├── Contact (CUSTOMER, B2B) in SaaS master org
    │   └── billing_contact_id linked back to new org
    │
    ├── → apps/inventory/events.py  → _on_org_provisioned()
    │   └── (Future: default categories, units)
    │
    └── → apps/hr/events.py  → _on_org_provisioned()
        └── (Future: default departments, roles)
```

## Data Flow

### From (READ)
- `Organization` — kernel model (created in step 1)
- `Site` — kernel model (created in step 1)

### To (WRITE)
| Module | Table | Count | Notes |
|--------|-------|-------|-------|
| Finance | FiscalYear | 1 | Current year |
| Finance | FiscalPeriod | 12 | Monthly periods |
| Finance | ChartOfAccount | 18 | 17 standard + 1 cash drawer |
| Finance | FinancialAccount | 1 | Cash drawer linked to CoA |
| Finance | Organization.settings | 2 keys | posting_rules + global_settings |
| CRM | Contact | 1 | Billing contact in SaaS org |
| CRM | Organization.billing_contact_id | 1 | Back-reference |

### Variables
- `org_id` — UUID of the new organization
- `org_name` — Display name
- `org_slug` — URL-safe slug
- `site_id` — ID of the main site

### Step-by-Step Workflow
1. User initiates org registration (via UI or API)
2. `ProvisioningService.provision_organization()` is called
3. Kernel creates Organization + Site + Warehouse (atomic)
4. ConnectorEngine dispatches `org:provisioned` to all modules
5. Finance handler creates full accounting infrastructure
6. CRM handler creates billing contact in SaaS master org
7. Inventory/HR handlers set up defaults (future)
8. Results logged; if any module fails, event is buffered for retry

### How the Page Achieves Its Goal
The provisioning flow ensures a new tenant has a complete, working environment from moment one. By using events instead of direct imports, each module handles its own setup independently. If a module is unavailable, the kernel doesn't crash — the event is simply buffered and replayed later.
