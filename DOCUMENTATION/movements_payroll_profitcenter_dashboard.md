# Inventory Movements, Payroll Summary, Profit Centers & Command Center

## Inventory Movements

### Goal
Track all stock in/out movements with cost tracking and type-based filtering.

### Page: `/inventory/movements`

#### Data READ
- `GET /inventory/inventory-movements/` — all stock movements

#### Variables
- **typeFilter**: IN, OUT, ADJUSTMENT, TRANSFER
- **search**: product name, reference, warehouse

#### Workflow
1. 4 KPI cards: Total Movements, Stock In qty, Stock Out qty, Total Value
2. Type filter tags (IN/OUT/ADJUSTMENT/TRANSFER)
3. Movement table: Type badge, Date, Product, Warehouse, Qty (signed), Unit Cost, Total, Reference

---

## Payroll Summary

### Goal
Monthly salary overview with distribution visualization and compensation breakdown.

### Page: `/hr/payroll`

#### Data READ
- `GET /hr/employees/` — employee list with salaries

#### Variables
- **typeFilter**: EMPLOYEE, PARTNER, BOTH
- **search**: name, job title, employee ID

#### Workflow
1. 4 KPI cards: Total Monthly Payroll, Headcount, Average Salary, Highest Salary
2. Type filter tags
3. Salary Distribution bar chart (top 15)
4. Payroll Table: Employee, ID, Type badge, Job Title, Monthly, Annual, % of Total

---

## Profit Center Reporting

### Goal
SYSCOHADA class-based profit center analysis with debit/credit/net breakdown.

### Page: `/finance/profit-centers`

#### Data READ
- `GET /finance/chart-of-accounts/` — all GL accounts

#### Workflow
1. 4 KPI cards: Centers count, Total Debits, Total Credits, Net Position
2. Profit Center cards (one per SYSCOHADA class 1-8): Debit/Credit/Net + top 5 accounts

---

## Command Center Dashboard

### Goal
Cross-module overview with real-time KPIs from Sales, Inventory, HR, CRM, and Finance.

### Page: `/dashboard`

#### Data READ
- `GET /pos/pos/daily-summary/?days=30` — sales data
- `GET /inventory/low-stock/` — stock alerts
- `GET /hr/employees/` — payroll
- `GET /crm/contacts/` — CRM contacts
- `GET /finance/chart-of-accounts/` — GL data
- `GET /inventory/inventory-movements/` — stock movements

#### Workflow
1. Primary KPI row (gradient cards): 30d Revenue, Orders, Contacts, Low Stock Alerts
2. Secondary KPI row: GL Income, GL Expenses, Monthly Payroll, Headcount
3. Widget row: Recent Stock Movements, Payment Methods, Top Sellers
4. Hourly Sales Distribution chart

## Files
- `src/app/(privileged)/inventory/movements/page.tsx`
- `src/app/(privileged)/hr/payroll/page.tsx`
- `src/app/(privileged)/finance/profit-centers/page.tsx`
- `src/app/(privileged)/dashboard/page.tsx`
