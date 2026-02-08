# Organization Detail Page

## Goal
Provides SaaS admins with a complete management view for each tenant organization — modules, features, users, usage, billing.

## From Where Data is READ

| Data | Source Table | API Endpoint |
|------|-------------|--------------|
| Organization info | `Organization` | `GET /api/organizations/{id}/` |
| Usage metrics | `User`, `Site`, `SubscriptionPlan`, `SubscriptionPayment` | `GET /api/saas/org-modules/{id}/usage/` |
| Billing history | `SubscriptionPayment` | `GET /api/saas/org-modules/{id}/billing/` |
| Modules & features | `SystemModule`, `OrganizationModule` | `GET /api/saas/org-modules/{id}/modules/` |
| Users | `User` | `GET /api/saas/org-modules/{id}/users/` |
| Sites | `Site` | `GET /api/saas/org-modules/{id}/sites/` |
| Plan limits | `SubscriptionPlan.limits` (JSONB) | Included in usage response |

## Where Data is SAVED

| Action | Target Table | API Endpoint |
|--------|-------------|--------------|
| Toggle module | `OrganizationModule` | `POST /api/saas/org-modules/{id}/toggle_module/` |
| Update features | `OrganizationModule.active_features` | `POST /api/saas/org-modules/{id}/update_features/` |
| Create user | `User` | `POST /api/saas/org-modules/{id}/create_user/` |
| Reset password | `User.password` | `POST /api/saas/org-modules/{id}/reset_password/` |

## Variables User Interacts With

- **Tab selection**: overview, modules, users, usage, billing
- **Module toggle switches**: enable/disable modules per org
- **Feature chips**: clickable feature flags per module
- **Create User form**: username, email, password, first_name, last_name, is_superuser toggle
- **Reset Password dialog**: user selection, new password input

## Step-by-Step Workflow

### Overview Tab
1. Page loads → fetches org, usage, billing, modules, users in parallel
2. Displays 4 usage meters (Users, Sites, Storage, Invoices) with percent bars
3. Shows current plan card with price from `SubscriptionPlan` (real DB, not mocked)
4. Shows modules count with link to modules tab

### Modules Tab
1. Lists all `SystemModule` records
2. Core modules (core, coreplatform) shown with "Core" badge — cannot be toggled
3. Business modules have toggle switches (enable/disable)
4. Each installed module shows clickable feature chips
5. Clicking a feature chip toggles it via `update_features` API
6. Default features auto-generated from `DEFAULT_FEATURES` dict when manifest lacks `features` key

### Users Tab
1. Lists all users for the organization with role, superuser badge, active status
2. "Create User" button opens dialog with username, email, password, superuser toggle
3. "Reset" button per user opens password reset dialog

### Billing Tab
1. Shows current subscription plan badge
2. Displays all available plans from DB (for future plan switching)
3. Payment history table from `SubscriptionPayment`

## How the Page Achieves Its Goal

The page uses Next.js server actions that call `erpFetch` to hit Django REST Framework endpoints on `OrgModuleViewSet`. All endpoints are scoped to a specific organization UUID via the URL path. Plan data comes from the real `SubscriptionPlan` table with limits stored in a JSONB `limits` field. Module features use a fallback `DEFAULT_FEATURES` dictionary when manifests don't define features.

---

# Organization List Filters

## Goal  
Allow SaaS admins to filter organizations by plan, business type, country, and status.

## Implementation  
- Filter state managed client-side (no additional API calls)
- Unique filter options derived from org data (plans, types, countries)
- Filters: **Search** (name/slug), **Status** (active/suspended), **Plan**, **Business Type**, **Country**
- "Clear All" button resets all filters
- Counter shows "X of Y" filtered results
- `current_plan_name` and `business_type_name` added to `OrganizationSerializer`
