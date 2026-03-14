# Add-on Tracking System

## Goal
Track which add-ons each organization has purchased, enabling the full lifecycle: **Create → Purchase → Track → Bill**.

## Architecture

### Data Model
- **`PlanAddon`** — Defines available add-ons (encryption, users, storage, etc.) with pricing
- **`OrganizationAddon`** (NEW) — Tracks which orgs have purchased which add-ons

### Flow
1. Admin defines add-ons in **Subscription Plans → Add-ons**
2. Admin purchases add-ons for an org on **Organization Detail → Add-ons tab**
3. System checks entitlement via `OrganizationAddon` (org-level) or `PlanAddon` (plan-level)

## Database: `OrganizationAddon`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `organization` | FK → Organization | Which org owns this purchase |
| `addon` | FK → PlanAddon | Which add-on was purchased |
| `quantity` | Integer | Number of units |
| `billing_cycle` | MONTHLY / ANNUAL | Billing frequency |
| `status` | active / cancelled / expired | Current status |
| `purchased_at` | DateTime | When purchased |
| `cancelled_at` | DateTime (nullable) | When cancelled |
| `notes` | Text | Optional notes |

**Table name:** `organizationaddon`

## API Endpoints

All under `SaaSPlansViewSet`:

| Method | Path | Description |
|---|---|---|
| GET | `/api/saas/plans/org-addons/<org_id>/` | List purchased + available add-ons |
| POST | `/api/saas/plans/org-addons/<org_id>/purchase/` | Purchase an add-on |
| POST | `/api/saas/plans/org-addons/<org_id>/cancel/<purchase_id>/` | Cancel a purchased add-on |

### Purchase Payload
```json
{
  "addon_id": "uuid",
  "quantity": 1,
  "billing_cycle": "MONTHLY"
}
```

## Pages

### Reads From
- Organization Detail Page → Add-ons tab reads from `org-addons/<org_id>/`
- Encryption Status page reads entitlement from `OrganizationAddon` via `EncryptionService`

### Writes To
- Organization Detail Page → Add-ons tab writes to `org-addons/<org_id>/purchase/` and `cancel/`

## Variables User Interacts With
- **Add-on selection** (from available list)
- **Quantity** (defaults to 1)
- **Billing cycle** (MONTHLY or ANNUAL)
- **Cancel button** (per purchased add-on)

## Entitlement Check
`EncryptionService.check_addon_entitlement(org)` now checks:
1. **Org-level:** `OrganizationAddon` with `status='active'` and `addon_type='encryption'`
2. **Plan-level:** `PlanAddon` linked to org's current plan (fallback)

## Files Modified
- `erp_backend/erp/models.py` — Added `OrganizationAddon` model
- `erp_backend/erp/views_saas_modules.py` — Added 3 API endpoints
- `erp_backend/erp/encryption_service.py` — Updated entitlement to check org purchases
- `src/app/(privileged)/(saas)/organizations/[id]/actions.ts` — Added frontend actions
- `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — Added Add-ons tab
