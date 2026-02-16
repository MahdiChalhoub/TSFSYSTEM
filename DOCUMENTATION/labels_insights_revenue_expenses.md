# Label Printing, Customer Insights, Revenue Breakdown & Expense Tracker

## Label Printing

### Goal
Select products and print barcode labels at different sizes (Small/Medium/Large).

### Page: `/inventory/labels`

#### Data READ
- `GET /inventory/products/` — all products with SKU, barcode, price

#### Variables
- **search**: filter by product name, SKU, or barcode
- **selected**: Set of product IDs selected for printing
- **labelSize**: 'small' (40×25mm), 'medium' (60×35mm), 'large' (80×50mm)

#### Workflow
1. 4 KPI cards: Total Products, With Barcode, Without Barcode, Selected count
2. Search + label size toggle + Select All / Print button bar
3. Checkbox product table: Product name, SKU, Barcode (or "No barcode" badge), Category, Price TTC
4. Real-time label preview panel (dashed borders, monospace barcode display)
5. Print action opens new window with CSS @page layout, Libre Barcode 128 Google Font, auto-print on load

---

## Customer Insights

### Goal
Segment customers into tiers (Diamond/Gold/Silver/Bronze) based on spending, with recency and engagement tracking.

### Page: `/crm/insights`

#### Data READ
- `GET /crm/contacts/` — client contacts
- `GET /pos/pos/` — all orders for calculating spend per customer

#### Workflow
1. 4 KPI cards: Total Customers, Active (30d), Total Revenue, Avg Order Value
2. Tier distribution cards (Diamond >5M, Gold >2M, Silver >500K, Bronze)
3. Ranked customer table: Name, Tier badge, Orders, Total Spent, Avg Order, Recency badge (days ago), Last Order date

---

## Revenue Breakdown

### Goal
Detailed analysis of all income (INCOME-type) GL accounts with visual distribution.

### Page: `/finance/revenue`

#### Data READ
- `GET /finance/chart-of-accounts/` — filtered to type=INCOME
- `GET /finance/journal/` — for journal entry counts per account

#### Workflow
1. 4 KPI cards: Total Revenue, Income Accounts count, Avg per Account, Top Account name + %
2. Revenue Distribution waterfall: emerald-green bars with inline % labels, sorted by balance
3. Detail table: Code, Account Name, Balance, % of Revenue (mini progress bar), Journal Entries count

---

## Expense Tracker

### Goal
Detailed analysis of all expense (EXPENSE-type) GL accounts with rose-themed distribution.

### Page: `/finance/expenses`

#### Data READ
- `GET /finance/chart-of-accounts/` — filtered to type=EXPENSE
- `GET /finance/journal/` — for journal entry counts

#### Workflow
1. 4 KPI cards: Total Expenses, Expense Account count + active, Top Expense name + amount, Top 3 Concentration %
2. Expense Distribution bars: rose-red bars with inline % labels
3. Detail table: Code, Account Name, Balance, % of Expenses, Journal Entries

## Files
- `src/app/(privileged)/inventory/labels/page.tsx`
- `src/app/(privileged)/crm/insights/page.tsx`
- `src/app/(privileged)/finance/revenue/page.tsx`
- `src/app/(privileged)/finance/expenses/page.tsx`
