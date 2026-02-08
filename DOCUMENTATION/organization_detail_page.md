# Organization Detail Page — Documentation

## Goal
Provide a detailed management view for each organization in the SaaS panel. Clicking an org card navigates to a detail page with module tree, usage metrics, and billing history.

## Data Flow

### From (READ)
- `Organization` — org details, current_plan, plan_expiry_at, data_usage_bytes
- `OrganizationModule` — per-org enabled modules
- `SystemModule` — global module registry
- `User` — user count per org
- `Site` — site count per org
- `SubscriptionPayment` — billing/payment history

### To (WRITE)
- `OrganizationModule.is_enabled` — toggled via module enable/disable

### Variables Users Interact With
- Tab selection: Overview, Modules, Usage, Billing
- Module toggle switches: enable/disable business modules
- Navigation: back button to org list

### Step-by-Step Workflow
1. User clicks org card on `/organizations` → navigates to `/organizations/[id]`
2. Page loads 4 data sources in parallel: org, usage, billing, modules
3. **Overview tab**: Usage meters (users, sites, storage, invoices + limits), plan card, module summary
4. **Modules tab**: Core modules (locked) + Business modules with toggle switches
5. **Usage tab**: Detailed resource consumption bars with % of limit
6. **Billing tab**: Current plan status + payment history table

### Files Created/Modified
- `[NEW] src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — detail page
- `[NEW] src/app/(privileged)/(saas)/organizations/[id]/actions.ts` — server actions  
- `[MOD] src/app/(privileged)/(saas)/organizations/page.tsx` — cards now clickable
- `[MOD] erp/views_saas_modules.py` — added usage + billing API endpoints

### API Endpoints
| Endpoint | Method | Returns |
|----------|--------|---------|
| `GET /api/saas/org-modules/{id}/usage/` | GET | Usage metrics with plan limits |
| `GET /api/saas/org-modules/{id}/billing/` | GET | Payment history (last 50) |
| `GET /api/saas/org-modules/{id}/modules/` | GET | All modules with org status |
| `POST /api/saas/org-modules/{id}/toggle_module/` | POST | Enable/disable module |
