# SaaS Business Integration Documentation

## Goal
Bridge SaaS subscription management with core business modules (CRM, Finance, Inventory).

## Changes

### #12 — SaaS as Full Business User (Already Implemented)
`SaaSClient.sync_to_crm_contact()` creates CRM Contact records in the SaaS org:
- Called on client creation (`views_saas_modules.py:1585`)
- Called on org registration (`views_auth.py:277`)
- Called on client assignment (`views.py:611`)

### #13 — Org = Client in Finance (Already Implemented)
Same `sync_to_crm_contact()` creates a CRM Contact with `customer_type='SAAS'`, which is the shared entity used across CRM and Finance for invoicing and balance tracking.

### #14 — Plan Categories = Inventory Categories
Added `linked_inventory_category` (IntegerField) to `PlanCategory`:
- Bridges SaaS plan categories to inventory `Category.id`
- Uses IntegerField to avoid hard cross-app dependency
- Allows plan catalogs to be browsed alongside inventory

### #15 — Plans by Company Type
Added `business_types` M2M on `SubscriptionPlan`:
- Filters plans by org's `BusinessType`
- Plans with no business_types = universal (available to all)
- Plans list API: `GET /api/saas/plans/?business_type=<id>`
- Org detail page: auto-filters available plans by org's `business_type_id`

## Data Flow
```
Plan List API: GET /api/saas/plans/?business_type=<id>
  → SubscriptionPlan.objects.filter(
      Q(business_types__id=bt_id) | Q(business_types__isnull=True)
    ).distinct()

Org Detail Page: GET /api/saas/organizations/<id>/
  → available_plans filtered by org.business_type_id
  → Plans with no business_types always included
```

## Tables Affected
| Table | Change |
|---|---|
| `plancategory` | New column: `linked_inventory_category` |
| `subscriptionplan_business_types` | New M2M join table |

## Where Data is READ
- `views_saas_modules.py` — Plans list API, Org detail available plans
- Frontend plans/org pages

## Where Data is SAVED
- SaaS admin assigns business_types to plans via admin
- SaaS admin sets linked_inventory_category on plan categories
