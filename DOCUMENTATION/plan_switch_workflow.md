# Plan Switch Workflow

## Goal
When an admin switches an organization's subscription plan, the system automatically handles billing documents (invoices/credit notes), module synchronization, feature sync, and audit logging.

## Data READ from
- `SubscriptionPlan` — current and target plan details (price, modules, features, limits)
- `Organization.current_plan` — the org's active plan FK
- `OrganizationModule` — existing module activations
- `SubscriptionPayment` — billing history

## Data SAVED to
- `SubscriptionPayment` — creates Purchase Invoice and/or Credit Note records
- `Organization.current_plan` — updated to new plan FK
- `OrganizationModule.is_enabled` — enable/disable based on new plan's module list
- `OrganizationModule.active_features` — synced from plan's features config
- ConnectorEngine → `finance/billing/plan-change/` — best-effort hook to Finance module

## Variables User Interacts With
- **Plan selector** — clicks "Switch to This Plan" on any available plan card
- **Confirmation dialog** — shows current vs new plan, price diff, upgrade/downgrade label
- **Confirm Switch button** — triggers the `change-plan` API call

## Billing Logic

| Scenario | Documents Created |
|----------|------------------|
| Free → Paid | 1× Purchase Invoice (full price) |
| Cheap → Expensive (upgrade) | 1× Purchase Invoice (price difference) |
| Expensive → Cheap (downgrade) | 1× Credit Note (price diff) + 1× Purchase Invoice (new price) |
| Paid → Free | 1× Credit Note (refund) |
| Same price | 1× Purchase Invoice (new plan price) |

## Step-by-Step Workflow
1. Admin navigates to org detail → Billing tab
2. Clicks "Switch to This Plan" on a plan card
3. Confirmation dialog opens showing:
   - Current plan name
   - New plan name
   - Upgrade/Downgrade badge
   - Price difference
   - Invoice preview text
   - Modules in new plan
4. Admin clicks "Confirm Switch"
5. Backend `POST /api/saas/org-modules/{id}/change-plan/`:
   a. Determines direction (upgrade/downgrade/switch)
   b. Creates appropriate `SubscriptionPayment` records
   c. Updates `org.current_plan` FK
   d. Enables modules in new plan
   e. Disables modules NOT in new plan (but were in old)
   f. Syncs features from plan config to org modules
   g. Fires ConnectorEngine hook to Finance module (best-effort)
6. Frontend refreshes usage data + billing history
7. Success toast shows plan change result
8. If modules were disabled, info toast lists them

## Files Modified
- `erp/models.py` — `SubscriptionPayment` + type/notes/previous_plan fields
- `erp/views_saas_modules.py` — `change_plan` endpoint + `billing` endpoint
- `erp/migrations/0036_subscriptionpayment_invoice_type.py` — migration
- `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — confirmation dialog + billing history
