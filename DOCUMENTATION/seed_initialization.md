# Seed & Initialization Documentation

## Overview
The `seed_core` management command initializes all required bootstrap data for a fresh installation or reset of the platform. It is **idempotent** — safe to run multiple times without creating duplicates.

## Command
```bash
python manage.py seed_core
```

## What It Seeds

### 1. Countries (Global)
- **Table:** `country`
- **Count:** 20 entries (LB, US, FR, TR, CN, GB, DE, AE, SA, EG, JO, IQ, KW, QA, BH, OM, CA, AU, IN, BR)
- **Read by:** Registration form (country selection), organization profile
- **Editable:** Yes — via Django admin or API

### 2. Global Currencies (Global)
- **Table:** `globalcurrency`
- **Count:** 8 entries (USD, EUR, GBP, LBP, AED, TRY, SAR, CNY)
- **Read by:** Business registration form (Monetary Standard dropdown)
- **Saved to:** `Organization.base_currency` (FK)
- **Editable:** Yes — via SaaS admin panel

### 3. Business Types (Global)
- **Table:** `businesstype`
- **Count:** 10 entries (Retail, Restaurant, Manufacturing, Wholesale, Services, Healthcare, Construction, Technology, Education, Other)
- **Read by:** Business registration form (Industry Vector dropdown)
- **Saved to:** `Organization.business_type` (FK)
- **Editable:** Yes — via SaaS admin panel

### 4. SaaS Root Organization
- **Table:** `organization`
- **Slug:** `saas`
- **Purpose:** The root "0" entity. All superusers belong here. SaaS admin panel operates under this org.
- **Includes:**
  - **Default Site** (`SAAS-HQ` / "SaaS Platform") — every org must have at least one site
  - **Admin Role** (`Super Admin`) — for platform-level access control

### 5. Subscription Plans
- **Tables:** `plancategory`, `subscriptionplan`
- **Category:** "SaaS Plans" (type: subscription)
- **Plans:**

| Name | Monthly | Annual | Users | Sites | Products | Modules |
|------|---------|--------|-------|-------|----------|---------|
| Starter | $0 | $0 | 2 | 1 | 100 | core, inventory, pos |
| Growth | $29 | $290 | 10 | 3 | 5,000 | + finance, crm |
| Enterprise | $99 | $990 | ∞ | ∞ | ∞ | + hr, client_portal, supplier_portal |

- **Read by:** Pricing page, SaaS admin, org profile
- **Saved to:** `Organization.current_plan` (FK)
- **Editable:** Yes — via SaaS admin panel

### 6. System Modules
- **Table:** `systemmodule`
- **Source:** Auto-synced from filesystem via `ModuleManager.sync()`
- **Read by:** Module management pages, provisioning service
- **Relationship:** Each org gets all modules auto-granted via `OrganizationModule` on creation

### 7. Superuser Auto-Link
- Any superuser without an `organization` is automatically linked to the SaaS org
- Prevents "No organization context" errors

## Provisioning Service (Per-Business Creation)
When a new business registers via `/register/business`, `ProvisioningService.provision_organization()` creates:
1. **Organization** record
2. **Default Site** ("Main Branch", code: `MAIN`)
3. **Main Warehouse** ("Main Warehouse", code: `WH01`)
4. **Module Grants** (all installed modules auto-enabled)
5. **ConnectorEngine event** (`org:provisioned`) — triggers finance CoA, fiscal year, etc.

## Workflow
1. Fresh install → `python manage.py migrate`
2. Create superuser → `python manage.py createsuperuser`
3. Run seed → `python manage.py seed_core`
4. Access SaaS panel → `http://domain:3000/saas/login`
5. Users register businesses → provisioning handles the rest
