# Tax Reports & Purchase Dashboard

## Tax Reports

### Goal
View configured tax groups and summarize tax collection over a rolling 30-day window.

### Page: `/finance/tax-reports`

#### Data READ
- `GET /finance/tax-groups/` — configured tax group definitions
- `GET /pos/pos/daily-summary/?days=30` — sales summary with tax data

#### Data SAVED
- No writes (read-only report)

#### Variables
- **taxGroups**: configured tax groups with rates
- **summary**: 30-day sales/tax aggregation

#### Workflow
1. Shows 4 KPI cards: Tax Collected, Taxable Revenue, Effective Rate, Active Tax Groups
2. Tax Groups table: Name, Rate %, Default flag, Active status, Description
3. 30-day Collection Summary: Transactions, Discounts, Net Revenue

---

## Purchase Orders Dashboard

### Goal
Track and monitor supplier purchase orders with status filters and financial overview.

### Page: `/purchases/dashboard`

#### Data READ
- `GET /pos/purchase/` — purchase order list

#### Data SAVED
- No writes (read-only dashboard)

#### Variables
- **statusFilter**: filter by PENDING/CONFIRMED/COMPLETED/CANCELLED
- **search**: search by reference or supplier name

#### Workflow
1. Shows 4 KPI cards: Total Orders, Completed, In Progress, Avg Order Value
2. Status filter tags (clickable)
3. Orders table: Reference, Date, Supplier, Status, Payment Method, Amount

## Files
- `src/app/actions/finance/tax-reports.ts` — Tax data server actions
- `src/app/(privileged)/finance/tax-reports/page.tsx` — Tax Reports page
- `src/app/(privileged)/purchases/dashboard/page.tsx` — Purchase Dashboard
