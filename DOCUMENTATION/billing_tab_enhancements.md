# Billing Tab Enhancements

## Goal
Display client account, balance summary, and CRM profile link on the organization billing tab.

## Data Flow

### READ
- **Backend**: `GET /api/saas/org-modules/{id}/billing/` returns:
  - `history[]` — subscription payment records (from `SubscriptionPayment` table)
  - `balance` — `{ total_paid, total_credits, net_balance }` calculated from completed payments
  - `client` — `{ id, full_name, email, phone, company_name }` from linked `SaaSClient`

### SAVE
- No writes from billing tab (read-only view)
- Balance is computed on-the-fly from `SubscriptionPayment` records

## Frontend Variables
| Variable | Type | Source |
|---|---|---|
| `billing.history` | `array` | Payment history records |
| `billing.balance.total_paid` | `string` | Sum of completed non-credit payments |
| `billing.balance.total_credits` | `string` | Sum of completed credit notes |
| `billing.balance.net_balance` | `string` | `total_paid - total_credits` |
| `billing.client` | `object|null` | Linked SaaSClient info |

## UI Components

### Account Owner Card
- Shows client name, company, email, phone
- If no client: amber warning "No client assigned — assign from Overview tab"
- **"View CRM Profile"** button → navigates to `/crm/contacts?search={email}`

### Balance Summary (3-column grid)
- **Total Paid** (emerald) — sum of completed payments
- **Credits** (amber) — sum of credit notes
- **Net Balance** (gray) — net amount

### Payment History
- Tagged with "Subscription Payments" badge
- **Future**: Will be replaced with ledger entries from the finance module

## Files Changed
| File | Change |
|---|---|
| `erp/views_saas_modules.py` | Enhanced `billing` endpoint: structured response with balance + client |
| `organizations/[id]/page.tsx` | Added Account Owner card, balance grid, CRM link, updated history ref |

## Future Integration
Payment history should eventually pull from the **finance module's ledger** (journal entries), not just `SubscriptionPayment`. This requires:
1. Cross-org data access via ConnectorEngine
2. Mapping SaaSClient to a CRM Contact record
3. Querying ledger entries for the client's account
