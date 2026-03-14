# Billing Tab Enhancements

## Goal
Display client billing information, balance summary, and CRM profile links in the organization detail page Billing tab.

## Data Sources

### READ
- **SubscriptionPayment** table: payment history for the organization
- **SaaSClient** table (via `org.client`): account owner details
- **SubscriptionPlan** table (via SubscriptionPayment joins): plan names

### SAVE
- **SubscriptionPayment** table: new records on plan switch (via `change-plan` endpoint)

## Variables User Interacts With
- Balance summary: Total Paid, Credits, Net Balance (read-only)
- Account Owner card: name, company, email, phone (read-only)
- "View CRM Profile" button: links to CRM contacts filtered by client email
- Plan switch dialog: selects new plan, confirms upgrade/downgrade

## Workflow

1. User navigates to Organization Detail → Billing tab
2. Frontend calls `GET /api/erp/proxy/saas/org-modules/{orgId}/billing/`
3. Backend returns structured response: `{ history, balance, client }`
4. UI renders:
   - **Subscription card** (left column): current plan info
   - **Account Owner card** (right column): client name, email, phone, company
   - **Balance Summary**: computed from COMPLETED/PAID SubscriptionPayments
   - **Payment History**: list of SubscriptionPayment records

## How It Achieves Its Goal
- The billing endpoint aggregates data from SubscriptionPayment (history + balance) and SaaSClient (client info)
- Balance is computed as: total_paid (excluding CREDIT_NOTEs) minus total credits
- The "View CRM Profile" button navigates to `/crm/contacts?search={email}` to locate the synced CRM Contact

## Related Changes (v2.7.0)
| Build | Change |
|---|---|
| b003 | Billing endpoint returns `{ history, balance, client }` |
| b004 | SaaSClient → CRM Contact sync (`sync_to_crm_contact`) |
| b005 | Plan badge on org list cards |
| b006 | Fixed plan switch 500 (missing `billing_cycle` field) |
| b008 | Fixed hydration mismatch on organizations filter bar |

## Database Tables

### SubscriptionPayment
| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| organization_id | uuid | FK → Organization |
| plan_id | uuid | FK → SubscriptionPlan |
| previous_plan_id | uuid | FK → SubscriptionPlan (nullable) |
| amount | decimal | Payment amount |
| billing_cycle | varchar(20) | MONTHLY, ANNUAL, ONE_TIME |
| type | varchar(20) | PURCHASE, CREDIT_NOTE, RENEWAL |
| status | varchar(20) | PENDING, COMPLETED, PAID |
| notes | text | Audit notes |
| created_at | timestamp | Auto-set on create |
