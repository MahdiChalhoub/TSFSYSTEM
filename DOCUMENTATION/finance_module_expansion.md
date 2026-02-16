# Finance Module Expansion — Documentation

## Overview
This document covers all new features added to the Finance Module across Phases 1–7.

---

## 1. Currency Management

### Goal
Allow SaaS admins to manage global currencies (add, edit, delete) and let finance settings use a dropdown to select the default currency.

### Data Flow
- **READ**: `GlobalCurrency` table via `GET /api/currencies/`
- **WRITE**: `GlobalCurrency` table via `POST/PUT/DELETE /api/currencies/`
- **Settings page** reads currencies for dropdown display

### Pages
| Page | Path | Purpose |
|------|------|---------|
| SaaS Currencies | `/saas/currencies` | CRUD for `GlobalCurrency` |
| Finance Settings | `/finance/settings` | Dropdown for default currency, TVA rate with edit-lock |

### Edit-Lock Flow
1. After saving settings → core fields (currency, TVA, companyType) become **locked**
2. Blue banner displays "Settings Locked" with an **Edit** button
3. Clicking Edit triggers a **confirmation popup** explaining risks
4. On confirm → fields unlock for editing

---

## 2. Financial Events

### Updated Event Types
| Event Type | Description |
|------------|-------------|
| `PARTNER_INJECTION` | Existing — partner adds capital |
| `CAPITAL_INJECTION` | New — capital injection (alias) |
| `PARTNER_LOAN` | New — partner provides a loan |
| `PARTNER_WITHDRAWAL` | Existing — partner withdraws |
| `LOAN_DISBURSEMENT` | Existing — loan given out |
| `LOAN_REPAYMENT` | Existing — loan repaid |
| `EXPENSE` | General expense |
| `SALARY_PAYMENT` | Salary payout |
| `DEFERRED_EXPENSE_CREATION` | New — long-term expense created |
| `DEFERRED_EXPENSE_RECOGNITION` | New — monthly recognition |
| `ASSET_ACQUISITION` | New — asset purchased |
| `ASSET_DEPRECIATION` | New — depreciation posted |
| `ASSET_DISPOSAL` | New — asset sold/written off |

### API
- `POST /api/finance/financial-events/create_event/` — create event
- `POST /api/finance/financial-events/{id}/post_event/` — post with JE

---

## 3. Deferred Expenses

### Goal
Plan and recognize long-term expenses over multiple months (e.g., annual subscriptions, renovation costs).

### Model: `DeferredExpense`
| Field | Type | Description |
|-------|------|-------------|
| `name` | CharField | Expense name |
| `category` | CharField | SUBSCRIPTION, RENOVATION, ADVERTISING, INSURANCE, RENT_ADVANCE, OTHER |
| `total_amount` | Decimal | Full cost |
| `start_date` | Date | Recognition start |
| `duration_months` | Int | Spread over N months |
| `monthly_amount` | Decimal | Auto-calculated |
| `remaining_amount` | Decimal | Decreases as months are recognized |
| `months_recognized` | Int | Progress counter |
| `source_account` | FK → FinancialAccount | Cash/bank used for payment |
| `deferred_coa` | FK → ChartOfAccount | Prepaid/Deferred asset account |
| `expense_coa` | FK → ChartOfAccount | Expense account for monthly recognition |

### Accounting Logic
1. **Creation**: Dr Deferred Expense (Asset) → Cr Cash/Bank
2. **Monthly Recognition**: Dr Expense → Cr Deferred Expense (no cash movement)

### API
- `GET /api/finance/deferred-expenses/` — list
- `POST /api/finance/deferred-expenses/` — create (auto-posts initial JE)
- `POST /api/finance/deferred-expenses/{id}/recognize/` — recognize one month

---

## 4. Assets & Amortization

### Goal
Track fixed assets, auto-generate depreciation schedules, and post depreciation entries.

### Model: `Asset`
| Field | Type | Description |
|-------|------|-------------|
| `name` | CharField | Asset name |
| `category` | CharField | VEHICLE, EQUIPMENT, IT, FURNITURE, BUILDING, LAND, OTHER |
| `purchase_value` | Decimal | Original cost |
| `purchase_date` | Date | When acquired |
| `useful_life_years` | Int | Expected lifespan |
| `residual_value` | Decimal | Salvage value |
| `depreciation_method` | CharField | LINEAR or DECLINING |
| `accumulated_depreciation` | Decimal | Running total |
| `book_value` | Decimal | Current value |
| `asset_coa` | FK → COA | Fixed asset account |
| `depreciation_expense_coa` | FK → COA | Depreciation expense account |
| `accumulated_depreciation_coa` | FK → COA | Contra-asset account |

### Model: `AmortizationSchedule`
| Field | Type | Description |
|-------|------|-------------|
| `asset` | FK → Asset | Parent asset |
| `period_date` | Date | Depreciation date |
| `amount` | Decimal | Monthly depreciation amount |
| `is_posted` | Bool | Whether JE is posted |
| `journal_entry` | FK → JE | Linked entry |

### Accounting Logic
1. **Acquisition**: Dr Fixed Asset → Cr Cash/Bank
2. **Depreciation**: Dr Depreciation Expense → Cr Accumulated Depreciation
3. Schedule auto-generated on creation (monthly over useful_life_years)

### API
- `GET /api/finance/assets/` — list
- `POST /api/finance/assets/` — acquire (auto-posts acquisition JE + generates schedule)
- `GET /api/finance/assets/{id}/schedule/` — view depreciation schedule
- `POST /api/finance/assets/{id}/depreciate/{schedule_id}/` — post one depreciation line

---

## 5. Vouchers

### Goal
Implement Transfer, Receipt, and Payment vouchers with validation rules.

### Model: `Voucher`
| Field | Type | Description |
|-------|------|-------------|
| `voucher_type` | CharField | TRANSFER, RECEIPT, PAYMENT |
| `amount` | Decimal | Voucher amount |
| `date` | Date | Voucher date |
| `source_account` | FK → FinancialAccount | From account |
| `destination_account` | FK → FinancialAccount | To account |
| `financial_event` | FK → FinancialEvent | Required for RECEIPT/PAYMENT |
| `contact` | FK → Contact | Related contact |

### Validation Rules
- **TRANSFER**: Requires both `source_account` and `destination_account`
- **RECEIPT**: Requires `financial_event` (linked to an event)
- **PAYMENT**: Requires `financial_event` (linked to an event)

### Accounting Logic
- **TRANSFER**: Dr Destination → Cr Source
- **RECEIPT**: Dr Destination (cash) → Cr Contact account
- **PAYMENT**: Dr Contact account → Cr Source (cash)

### API
- `GET /api/finance/vouchers/?type=TRANSFER` — list (filterable by type)
- `POST /api/finance/vouchers/` — create
- `POST /api/finance/vouchers/{id}/post_voucher/` — post with JE

---

## 6. Profit Distribution

### Goal
Close the financial year, calculate net profit, and distribute it into equity wallets.

### Model: `ProfitDistribution`
| Field | Type | Description |
|-------|------|-------------|
| `fiscal_year` | FK → FiscalYear | Which year |
| `net_profit` | Decimal | Calculated income - expenses |
| `distribution_date` | Date | When distributed |
| `allocations` | JSON | e.g. `{"RESERVE": "1000", "DISTRIBUTABLE": "9000"}` |
| `notes` | Text | Optional notes |
| `journal_entry` | FK → JE | Posted entry |

### Workflow
1. **Close Fiscal Year** (existing) → all periods closed → year closed
2. **Calculate**: `POST /calculate/` with allocation percentages (must sum to 100)
3. **Create Distribution**: Saves draft with computed amounts
4. **Post Distribution**: Dr Retained Earnings → Cr allocated wallets

### API
- `POST /api/finance/profit-distribution/calculate/` — preview
- `POST /api/finance/profit-distribution/` — create draft
- `POST /api/finance/profit-distribution/{id}/post_distribution/` — post

---

## Tables Affected

| Table | Read By | Write By |
|-------|---------|----------|
| `globalcurrency` | Settings Page, Currencies Page | Currencies CRUD |
| `financialevent` | Events Page, Dashboard | Event creation/posting |
| `deferredexpense` | Deferred Expenses Page | Create, monthly recognition |
| `asset` | Assets Page | Acquisition, depreciation |
| `amortizationschedule` | Asset Schedule View | Generated on acquisition, posted individually |
| `voucher` | Vouchers Page | Create, post |
| `profitdistribution` | Year-End Page | Calculate, create, post |

---

## Files Modified/Created

### Backend (`erp_backend/apps/finance/`)
- `models.py` — Added 5 new models + updated EVENT_TYPES
- `serializers.py` — Added 5 new serializers
- `services.py` — Added 4 new service classes
- `views.py` — Added 4 new ViewSets
- `urls.py` — Registered 4 new routes

### Backend (`erp_backend/erp/`)
- `views.py` — Added `CurrencyViewSet`
- `urls.py` — Registered `/api/currencies/`

### Frontend
- `src/app/actions/currencies.ts` — Currency CRUD actions
- `src/app/(privileged)/(saas)/currencies/page.tsx` — Currency management page
- `src/app/(privileged)/finance/settings/page.tsx` — Passes currencies to form
- `src/app/(privileged)/finance/settings/form.tsx` — Currency dropdown + edit-lock
