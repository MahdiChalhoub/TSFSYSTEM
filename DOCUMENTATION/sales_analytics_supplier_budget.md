# Sales Analytics, Supplier Performance & Budget Overview

## Sales Analytics

### Goal
Analyze sales performance with top products, customer segments, daily trends, and payment/site breakdowns.

### Page: `/sales/analytics`

#### Data READ
- `GET /pos/pos/sales-analytics/?days=N` — aggregated sales data

#### Data SAVED
- No writes (read-only analytics)

#### Variables
- **period**: 7, 30, or 90 days toggle

#### Workflow
1. 5 KPI cards: Revenue, Orders, Avg Order, Tax, Discounts
2. Daily Revenue Trend bar chart
3. Top 10 Products table (rank, name, qty, revenue)
4. Top 10 Customers table (rank, name, orders, total spent)
5. Payment Methods breakdown with progress bars
6. Site Performance breakdown with progress bars

---

## Supplier Performance

### Goal
Evaluate supplier effectiveness based on order volume, spend, and completion rates.

### Page: `/crm/supplier-performance`

#### Data READ
- `GET /crm/contacts/` — all contacts (filtered to SUPPLIER/BOTH)
- `GET /pos/purchase/` — purchase orders

#### Data SAVED
- No writes (read-only analytics)

#### Variables
- **search**: filter suppliers by name or email

#### Workflow
1. 4 KPI cards: Total Suppliers, Active Suppliers, Total Spend, Avg Completion
2. Ranked supplier table: Name, Orders, Total Spend, Avg Order, Completion Rate bar, Last Order

---

## Budget Overview

### Goal
Visualize Income vs Expense breakdown from Chart of Accounts data.

### Page: `/finance/budget`

#### Data READ
- `GET /finance/chart-of-accounts/` — accounts (filtered to INCOME/EXPENSE types)

#### Data SAVED
- No writes (read-only overview)

#### Workflow
1. 4 KPI cards: Total Income, Total Expenses, Net Result, Margin %
2. Income/Expense ratio bar
3. Income Accounts table with % of total
4. Expense Accounts table with % of total

## Backend Endpoint Added
- `GET /pos/pos/sales-analytics/?days=N` — top products, customers, daily trend, payment/site distribution

## Files
- `erp_backend/apps/pos/views.py` — `sales_analytics` action on `POSViewSet`
- `src/app/actions/pos/sales-analytics.ts` — server action
- `src/app/(privileged)/sales/analytics/page.tsx` — Sales Analytics
- `src/app/(privileged)/crm/supplier-performance/page.tsx` — Supplier Performance
- `src/app/(privileged)/finance/budget/page.tsx` — Budget Overview
