# Per-Module API Routing — Documentation

## Goal
Replace hardcoded module URL includes with dynamic auto-discovery. Add namespaced URL prefixes while keeping backward compatibility.

## Architecture

### Dynamic URL Auto-Include
**File:** `erp/urls.py`

On startup, the URL configuration:
1. Scans `apps/` directory for subdirectories containing `urls.py`
2. Imports each module's URL configuration
3. **Dual-mounts** each module at two paths:
   - Flat (backward compat): `/api/accounts/`
   - Namespaced (new standard): `/api/finance/accounts/`

### Excluded Modules
- `packages` — kernel-managed, has its own registration in the kernel router

## Data Flow

### From (READ)
- Filesystem: `apps/` directory structure
- Each module's `urls.py`: DRF router registrations

### To (WRITE)
- Django `urlpatterns`: dynamically populated at startup

### Variables Users Interact With
- API endpoints: both flat and namespaced paths resolve to the same views

### Step-by-Step Workflow
1. Django starts → `erp/urls.py` loads
2. Kernel infrastructure routes registered (auth, health, tenant, etc.)
3. Dynamic loop scans `apps/` directory
4. For each module with `urls.py`:
   - Imports the URL module
   - Inserts flat mount: `path('', include('apps.X.urls'))`
   - Inserts namespaced mount: `path('X/', include('apps.X.urls'))`
5. Both flat and namespaced URLs resolve to the same ViewSets

### How This Achieves Its Goal
New modules added to `apps/` are automatically URL-registered without editing `erp/urls.py`. The dual-mount strategy ensures zero frontend breakage while enabling clean namespaced URLs for new code.

## URL Resolution Verification

| Path | Resolves To |
|------|------------|
| `/api/accounts/` | `financialaccount-list` (flat) |
| `/api/finance/accounts/` | `financialaccount-list` (namespaced) |
| `/api/products/` | `product-list` (flat) |
| `/api/inventory/products/` | `product-list` (namespaced) |
| `/api/pos/` | POS API root |
