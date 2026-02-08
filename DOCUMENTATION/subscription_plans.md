# Subscription Plans Management

## Goal
Full CRUD management of subscription plans, including per-plan visibility (public/private), plan detail editing, add-on upgrades, and a public pricing section on the landing page.

## From Where Data is READ
- `GET /api/saas/plans/` — All plans (admin, auth required)
- `GET /api/saas/plans/{id}/` — Plan detail with orgs and addons
- `GET /api/saas/plans/categories/` — Plan categories
- `GET /api/saas/plans/addons/` — All add-ons
- `GET /api/saas/plans/module-features/` — Available features per module (from manifests)
- `GET /api/saas/pricing/` — Public plans only (no auth, landing page)

## Where Data is SAVED
- `POST /api/saas/plans/` — Create plan
- `PATCH /api/saas/plans/{id}/` — Update plan (name, price, limits, modules, features, visibility)
- `POST /api/saas/plans/{id}/toggle_public/` — Toggle public/private
- `POST /api/saas/plans/categories/` — Create category
- `POST /api/saas/plans/addons/` — Create add-on
- `PATCH /api/saas/plans/addons/{id}/` — Update add-on
- `DELETE /api/saas/plans/addons/{id}/` — Delete add-on

## Database Tables

### SubscriptionPlan
| Column | Type | Purpose |
|--------|------|---------|
| name | CharField | Plan name |
| description | TextField | Plan description |
| monthly_price | Decimal | Monthly cost (-1 = custom) |
| annual_price | Decimal | Annual cost (-1 = custom) |
| modules | JSONField | List of module codes |
| features | JSONField | `{module_code: [feature_codes]}` — per-module feature control |
| limits | JSONField | Resource limits (max_users, max_sites, etc.) |
| is_active | Boolean | Whether plan is active |
| is_public | Boolean | Show on landing page pricing section |
| sort_order | Integer | Display order (lower = first) |
| trial_days | Integer | Free trial duration in days (0 = no trial) |
| category | FK(PlanCategory) | Plan category |

### PlanAddon
| Column | Type | Purpose |
|--------|------|---------|
| name | CharField | Add-on name (e.g. "Extra 10 Users") |
| addon_type | CharField | Type: users/sites/storage/products/invoices/customers |
| quantity | Integer | How much the add-on provides |
| monthly_price | Decimal | Monthly recurring cost |
| annual_price | Decimal | Annual recurring cost |
| is_active | Boolean | Can be purchased |
| plans | M2M(SubscriptionPlan) | Which plans can use this (empty = all) |

## Pages

### `/subscription-plans` — Plans List
- Shows all plans grouped by category
- Clickable cards → navigate to detail page
- 🔒 icon on private plans
- "Plan Add-ons" section at bottom with create/delete

### `/subscription-plans/[id]` — Plan Detail
Tabs:
1. **Overview** — Name, description, pricing, sort order
2. **Modules & Features** — Checkbox grid of all available modules
3. **Limits** — Editable fields for max_users, max_sites, max_storage_gb, etc.
4. **Organizations** — List of orgs on this plan (clickable → org detail)

Actions: Edit mode toggle, Save, Toggle Public/Private

### Landing Page Pricing Section
- Fetches from `/api/saas/pricing/` (no auth)
- Only shows `is_public=True` + `is_active=True` plans
- Custom plans (price=-1): purple gradient, "Contact Sales" mailto button
- Free plans: "Free" label, "Start Free" CTA
- Shows limits (users, sites, storage, products) and module badges

## Workflow
1. Admin creates plans from `/subscription-plans` page
2. Sets limits, modules, pricing for each plan
3. Toggles `is_public` to control landing page visibility
4. Private plans are only assignable to specific orgs
5. Add-ons allow clients to upgrade individual limits (e.g. +10 users for $5/mo)
6. Public plans automatically appear in landing page pricing section
