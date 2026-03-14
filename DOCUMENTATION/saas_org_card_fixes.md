# SaaS Organization Card Fixes — Documentation

## Goal
Fix SaaS Master Panel organization card showing incorrect counts (Sites=0, Modules=0) and Feature Activation dialog showing "No available features."

## Bugs Fixed

### 1. Sites = 0 (actual = 1)
**Root cause:** Serializer `get_site_count` used `obj.sites.count()` but `TenantModel` FK has no `related_name='sites'` — Django defaults to `site_set`.
**Fix:** Changed to `Site.objects.filter(organization=obj).count()`.

### 2. Modules = 0 (9 SystemModules exist)
**Root cause:** `module_count` queries `OrganizationModule` (per-org grants) which was empty — provisioning never created these records.
**Fix:**
- Added auto-grant of all installed `SystemModule`s during provisioning (`services.py`)
- Added fallback in serializer: if `OrganizationModule` count is 0, count global installed `SystemModule`s

### 3. Feature Activation — "No available features"
**Root cause:** `getOrgModules()` called `erpFetch('/api/saas/org-modules/...')` but `erpFetch` already prepends `/api/` → result was `/api/api/saas/...` → 404 → empty array.
**Fix:** Removed leading `/api/` from paths in `getOrgModules`, `toggleOrgModule`, `updateOrgModuleFeatures`.

## Data Flow

### From (READ)
- `OrganizationModule` table — per-org module grants
- `SystemModule` table — global module registry
- `Site` table — sites linked to org via FK

### To (WRITE)
- `OrganizationModule` — auto-created during provisioning

### Variables
- `site_count` — count of Sites linked to org
- `user_count` — count of Users linked to org
- `module_count` — count of enabled modules (org-level or global fallback)

### Step-by-Step Workflow
1. Org provisioned → kernel creates Site, Warehouse
2. **NEW:** Auto-grants all installed SystemModules as OrganizationModule records
3. Org card renders → serializer queries direct FK counts
4. Feature Activation clicked → `getOrgModules` hits correct API → returns all modules with status

### Files Modified
- `erp/serializers/core.py` — fixed `get_site_count`, `get_module_count`
- `erp/services.py` — added OrganizationModule auto-grant in provisioning
- `src/app/actions/saas/modules.ts` — fixed double `/api/` prefix in 3 actions
