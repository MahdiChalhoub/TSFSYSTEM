# Organizations Page

## Goal
Manage multi-tenant business instances from the SaaS admin panel. Lists all organizations, allows provisioning new instances, managing their status (suspend/activate), managing their module entitlements, and safely deleting organizations.

---

## Data Sources

### READ From
| Source | API Endpoint | Description |
|--------|-------------|-------------|
| Organization list | `GET /api/organizations/` | All organizations (admin) or user's org (regular) |
| Organization permissions | `GET /api/organizations/{id}/permissions_list/` | What the user can do with each org |
| Organization modules | `GET /api/saas/org-modules/{id}/modules/` | Modules installed/available for an org |

### WRITE To
| Action | API Endpoint | Description |
|--------|-------------|-------------|
| Provision instance | `POST /api/organizations/` | Creates org + full operational skeleton |
| Suspend/Activate | `PATCH /api/organizations/{id}/` | Toggles `is_active` flag |
| Delete organization | `DELETE /api/organizations/{id}/` | Removes org (with safety rules) |
| Toggle module | `POST /api/saas/org-modules/{id}/toggle_module/` | Enable/disable module for org |
| Update features | `POST /api/saas/org-modules/{id}/update_features/` | Toggle feature flags within a module |

---

## Variables User Interacts With

| Variable | Type | Description |
|----------|------|-------------|
| `name` | string | Business legal name (required for provisioning) |
| `slug` | string | Unique URL slug (required, lowercase, alphanumeric + hyphens) |
| `business_email` | string | Optional billing/contact email |
| `phone` | string | Optional phone number |
| `country` | string | Optional country name |
| `is_active` | boolean | Organization active status (toggle via suspend/activate button) |
| Module toggles | boolean | Enable/disable individual modules per organization |
| Feature flags | boolean[] | Enable/disable feature capabilities within modules |

---

## Step-by-Step Workflow

### 1. Viewing Organizations
1. Page loads → calls `getOrganizations()` 
2. API returns array of orgs with `site_count`, `user_count`, `module_count`
3. Each org renders as a card with status badge, stats, and action buttons
4. SaaS master org (`slug='saas'`) shows a "Protected" badge and disabled suspend/delete buttons

### 2. Provisioning a New Organization
1. Click "Register Instance" → opens dialog
2. Fill in required fields: Business Legal Name, URL Slug
3. Optionally fill: Email, Phone, Country
4. Click "Provision Now" → `POST /api/organizations/`
5. Backend `ProvisioningService.provision_organization()` creates:
   - Organization record
   - Main Branch (Site)
   - Main Warehouse
   - Fiscal Year + 12 monthly periods
   - Full Chart of Accounts (16 accounts)
   - Cash Drawer financial account 
   - Posting rules
   - Global financial settings
   - SaaS client linking (Contact in SaaS org's CRM)
6. Optional fields (email, phone, country) are saved after provisioning

### 3. Suspending / Activating
1. Click "Suspend" or "Activate" button on org card
2. Frontend calls `toggleOrganizationStatus(id, currentStatus)`
3. Backend `partial_update` checks:
   - If `slug == 'saas'` → **blocked** (400)
   - Otherwise → toggles `is_active` and returns updated org
4. UI refreshes to reflect new status

### 4. Managing Modules (Features Menu)
1. Click settings icon (⚙️) on org card → opens Feature Activation dialog
2. Frontend calls `getOrgModules(orgId)` to fetch available modules
3. Each module shows: name, code, status (Active/Inactive), core badge
4. Non-core modules can be activated/deactivated via toggle button
5. Active modules may expose feature flags (checkboxes) for granular control
6. Feature changes call `updateOrgModuleFeatures(orgId, moduleCode, features)`

### 5. Deleting an Organization
1. Click trash icon on org card → confirmation dialog appears
2. Frontend calls `deleteOrganization(id)`
3. Backend `destroy` enforces safety rules:
   - **Rule 1**: Cannot delete `slug='saas'` → 400
   - **Rule 2**: Must be deactivated first (`is_active=False`) → 400
   - **Rule 3**: Must wait 24h after deactivation → 400
   - **Rule 4**: If org has Products, Contacts, or Transactions → 400 (backup required)
4. If all rules pass → org is permanently deleted

---

## Permissions

The `permissions_list` endpoint (`GET /api/organizations/{id}/permissions_list/`) returns:

| Permission | Description | SaaS Org | Other Orgs (Admin) | Regular Users |
|------------|-------------|----------|-------------------|---------------|
| `can_suspend` | Can suspend this organization | ❌ | ✅ | ❌ |
| `can_activate` | Can reactivate this organization | ❌ | ✅ | ❌ |
| `can_delete` | Can delete this organization | ❌ | ✅ | ❌ |
| `can_manage_features` | Can toggle modules/features | ✅ | ✅ | ❌ |
| `can_edit` | Can edit org details | ✅ | ✅ | ❌ |
| `is_protected` | Whether org has special protection | ✅ | ❌ | — |

---

## How the Page Achieves Its Goal

The organizations page is a **SaaS admin control plane** that provides full lifecycle management for tenant organizations:

1. **Discovery**: Lists all organizations with real-time counts (sites, users, modules) from the enhanced `OrganizationSerializer`
2. **Provisioning**: Creates fully operational business instances in a single atomic transaction via `ProvisioningService`
3. **Lifecycle Control**: Suspend/activate organizations to control tenant access, with the SaaS org permanently protected
4. **Feature Management**: Fine-grained control over which modules and features each tenant can access
5. **Safe Deletion**: Multi-layered safety rules prevent accidental data loss (deactivation required, 24h cooldown, backup verification)

### Key Backend Components
- **Model**: `erp.models.Organization` — includes subscription fields (`is_read_only`, `current_plan`, `plan_expiry_at`, etc.)
- **Serializer**: `OrganizationSerializer` — returns computed `site_count`, `user_count`, `module_count`
- **ViewSet**: `OrganizationViewSet` — with overridden `create`, `partial_update`, `destroy`, and `permissions_list` action
- **Middleware**: `TenantMiddleware` — checks `is_read_only` to block writes on expired subscriptions
- **Service**: `ProvisioningService.provision_organization()` — atomic creation of full organizational skeleton

### Key Frontend Components
- **Page**: `src/app/(privileged)/(saas)/organizations/page.tsx`
- **Actions**: `src/app/(privileged)/(saas)/organizations/actions.ts`
- **Module Actions**: `src/app/actions/saas/modules.ts`
