# SaaS Platform Audit — Group A & B Documentation

## Group A: Sidebar Reorganization (v1.8.0-b016)

### Goal
Reorganize the SaaS Control sidebar to improve navigation hierarchy.

### Changes Made
**File:** `src/components/admin/Sidebar.tsx`

| Before | After |
|--------|-------|
| SaaS Dashboard under "Platform" group | SaaS Dashboard as top-level item under SaaS Control |
| Platform Health under "Platform" group | Platform Health under "Infrastructure" group |
| Kernel Updates under "Platform" group | Kernel Updates under "Infrastructure" group |
| Empty "Platform" group remained | "Platform" group removed entirely |

### Data Flow
- **READ:** No data read — purely UI restructuring
- **SAVED:** No data saved — client-side only

---

## Group B: Organization Profile Fixes (v1.8.0-b017, v1.8.0-b018)

### Goal
Fix data accuracy issues in the Organization Profile page.

### Issue 1: Module Count Mismatch (v1.8.0-b017)
**File:** `erp_backend/erp/views_saas_modules.py` — `OrgModuleViewSet.usage()`

**Problem:** The modules tab showed core modules as "INSTALLED" (based on is_core flag), but the usage counter only counted `OrganizationModule` records with `is_enabled=True`. Core modules without explicit records were missing from the count.

**Fix:** Updated `usage()` to build a set of enabled module names (from OrganizationModule) PLUS core modules (from SystemModule manifest), matching the exact same logic used in `modules()`.

**Data Flow:**
- **READ:** `OrganizationModule` table (enabled records), `SystemModule` table (all + manifest)
- **SAVED:** Nothing — read-only endpoint

### Issue 2: Module Display Names (v1.8.0-b018)
**File:** `erp_backend/erp/views_saas_modules.py` — `OrgModuleViewSet.modules()`
**File:** `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — `ModuleCard`

**Problem:** Module names displayed as internal codes (e.g., "finance") instead of human-readable names (e.g., "Finance & Accounting").

**Fix:** Backend now reads `name` and `description` from the module manifest stored in SystemModule. Frontend ModuleCard now displays the description below the module code.

**Data Flow:**
- **READ:** `SystemModule` table (manifest JSON), `OrganizationModule` table
- **SAVED:** Nothing — read-only endpoint

### Issue 3: Auto-Default Site (Already Implemented)
**File:** `erp_backend/erp/services.py` — `ProvisioningService.provision_organization()`

The provisioning service already creates a "Main Branch" site (code: MAIN) and "Main Warehouse" (code: WH01) for every new organization. No fix needed.

### Variables User Interacts With
| Variable | Page | Description |
|----------|------|-------------|
| `activeTab` | Organization Detail | Controls which tab is shown (overview, modules, users, etc.) |
| `modules` | Modules Tab | Array of module objects with code, name, status, features |
| `usage` | Overview/Usage Tab | Object with users, sites, storage, modules, invoices metrics |
| `toggling` | Modules Tab | Current module being toggled (loading state) |

### Step-by-Step Workflow
1. User navigates to `/organizations/{id}`
2. Page loads org data, usage, billing, modules, users, sites, addons in parallel
3. Overview tab shows resource meters (users, sites, storage, invoices) and module count
4. Modules tab shows Core Infrastructure and Business Modules with toggle switches
5. Each module card shows manifest display name, code, description, and feature flags
6. Module count in overview now correctly includes core modules

### Tables Affected
| Table | Read By | Written By |
|-------|---------|------------|
| `Organization` | Overview, Billing | Plan change |
| `SystemModule` | Modules tab, Usage | Module sync |
| `OrganizationModule` | Modules tab, Usage | Toggle module, Update features |
| `Site` | Sites tab | Create site, Toggle site |
| `User` | Users tab | Create user, Reset password |
| `SubscriptionPlan` | Billing tab | Plan change |
| `SubscriptionPayment` | Billing tab | Plan change (creates invoices) |
| `SaaSClient` | Overview, Billing | Assign client |
