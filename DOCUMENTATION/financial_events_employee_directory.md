# Financial Events & Employee Directory

## Financial Events

### Goal
View and manage all financial events — capital movements, partner operations, loans, salaries, expenses, and asset transactions.

### Page: `/finance/events`

#### Data READ
- `GET /finance/financial-events/` — all financial events

#### Data SAVED
- `POST /finance/financial-events/create_event/` — create new event
- `POST /finance/financial-events/{id}/post_event/` — post event to ledger

#### Variables
- **typeFilter**: filter by event type (e.g., SALARY_PAYMENT, EXPENSE)
- **search**: full-text search on reference/notes

#### Workflow
1. Shows 4 KPI cards: Total Inflows, Total Outflows, Pending, Posted
2. Type filter tags with counts (clickable to filter)
3. Sortable table with type badges, date, reference, status, amount
4. Click "New Event" to create new financial event

#### Event Types
PARTNER_WITHDRAWAL, PARTNER_INJECTION, CAPITAL_INJECTION, PARTNER_LOAN,
LOAN_DISBURSEMENT, LOAN_REPAYMENT, EXPENSE, SALARY_PAYMENT,
DEFERRED_EXPENSE_CREATION, DEFERRED_EXPENSE_RECOGNITION,
ASSET_ACQUISITION, ASSET_DEPRECIATION, ASSET_DISPOSAL

---

## Employee Directory

### Goal
View and manage employees, partners, and linked system users.

### Page: `/hr/employees`

#### Data READ
- `GET /hr/employees/` — employee list
- `GET /users/` — standalone users

#### Data SAVED
- Standard CRUD via EmployeeViewSet

#### Variables
- Employee Manager: internal component handles search, CRUD, and role assignment

#### Workflow
1. Shows HR Command header with Total Staff, System Access, Active Branches
2. Employee Manager component handles filtering, viewing, and editing

## Files
- `erp_backend/apps/finance/models.py` — `FinancialEvent`
- `erp_backend/apps/finance/views.py` — `FinancialEventViewSet`
- `erp_backend/apps/hr/models.py` — `Employee`
- `erp_backend/apps/hr/views.py` — `EmployeeViewSet`
- `src/app/actions/finance/financial-events.ts` — Finance event actions
- `src/app/actions/hr/employees.ts` — HR employee actions
- `src/app/(privileged)/finance/events/page.tsx` — Events page (enhanced)
- `src/app/(privileged)/hr/employees/page.tsx` — HR Command page
