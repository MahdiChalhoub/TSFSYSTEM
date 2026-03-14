# Finance Module API Reference

Complete API documentation for Finance Phase 2 features.

**Version**: 3.1.4
**Last Updated**: 2026-03-12
**Base URL**: `/api/finance/`

---

## Table of Contents

1. [Asset Depreciation API](#asset-depreciation-api) (9 endpoints)
2. [Budget Variance API](#budget-variance-api) (8 endpoints)
3. [Financial Reports API](#financial-reports-api) (6 endpoints)
4. [Bank Reconciliation API](#bank-reconciliation-api) (7 endpoints)
5. [Loan Management API](#loan-management-api) (5 endpoints)

---

## Asset Depreciation API

### 1. Get Depreciation Schedule

Get or generate depreciation schedule for an asset.

**Endpoint**: `GET /api/finance/assets/{id}/depreciation_schedule/`

**Parameters**:
- `regenerate` (boolean, optional): Force regenerate schedule. Default: `false`

**Response**:
```json
{
  "asset_id": 123,
  "asset_name": "Office Equipment",
  "acquisition_cost": "120000.00",
  "salvage_value": "20000.00",
  "useful_life_months": 60,
  "depreciation_method": "LINEAR",
  "schedule": [
    {
      "period_date": "2026-01-31",
      "amount": "1666.67",
      "accumulated_depreciation": "1666.67",
      "book_value": "118333.33",
      "status": "PENDING"
    },
    {
      "period_date": "2026-02-28",
      "amount": "1666.67",
      "accumulated_depreciation": "3333.34",
      "book_value": "116666.66",
      "status": "PENDING"
    }
  ],
  "total_periods": 60
}
```

### 2. Post Monthly Depreciation

Post depreciation for a specific month with journal entry creation.

**Endpoint**: `POST /api/finance/assets/{id}/post_depreciation/`

**Request Body**:
```json
{
  "month": 3,
  "year": 2026,
  "description": "March 2026 Depreciation"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Depreciation posted successfully",
  "journal_entry": {
    "id": 456,
    "entry_number": "JE-2026-000456",
    "entry_date": "2026-03-31",
    "description": "March 2026 Depreciation - Office Equipment",
    "status": "POSTED",
    "lines": [
      {
        "account": "6100 - Depreciation Expense",
        "debit": "1666.67",
        "credit": "0.00"
      },
      {
        "account": "1510 - Accumulated Depreciation",
        "debit": "0.00",
        "credit": "1666.67"
      }
    ]
  },
  "schedule_entry_id": 789,
  "amount": "1666.67"
}
```

### 3. Dispose Asset

Dispose of an asset with gain/loss calculation.

**Endpoint**: `POST /api/finance/assets/{id}/dispose/`

**Request Body**:
```json
{
  "disposal_date": "2026-12-31",
  "disposal_amount": "90000.00",
  "disposal_account_id": 10,
  "gain_loss_account_id": 11,
  "description": "Sale of office equipment"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Asset disposed successfully",
  "asset_id": 123,
  "disposal_date": "2026-12-31",
  "book_value": "80000.00",
  "disposal_amount": "90000.00",
  "gain_loss": "10000.00",
  "gain_loss_type": "GAIN",
  "journal_entry": {
    "id": 457,
    "entry_number": "JE-2026-000457",
    "description": "Disposal of Office Equipment - Gain",
    "lines": [
      {
        "account": "1000 - Cash",
        "debit": "90000.00",
        "credit": "0.00"
      },
      {
        "account": "1510 - Accumulated Depreciation",
        "debit": "40000.00",
        "credit": "0.00"
      },
      {
        "account": "1500 - Fixed Assets",
        "debit": "0.00",
        "credit": "120000.00"
      },
      {
        "account": "7100 - Gain on Disposal",
        "debit": "0.00",
        "credit": "10000.00"
      }
    ]
  }
}
```

### 4. Batch Post Depreciation

Post depreciation for all assets for a specific month.

**Endpoint**: `POST /api/finance/assets/batch_post/`

**Request Body**:
```json
{
  "month": 3,
  "year": 2026,
  "asset_ids": [123, 124, 125]  // Optional: specific assets only
}
```

**Response**:
```json
{
  "success": true,
  "processed_count": 15,
  "posted_count": 15,
  "failed_count": 0,
  "total_amount": "45000.00",
  "results": [
    {
      "asset_id": 123,
      "asset_name": "Office Equipment",
      "amount": "1666.67",
      "status": "SUCCESS"
    },
    {
      "asset_id": 124,
      "asset_name": "Computer",
      "amount": "833.33",
      "status": "SUCCESS"
    }
  ]
}
```

### 5. Asset Register Report

Generate asset register with depreciation summary.

**Endpoint**: `GET /api/finance/assets/register/`

**Parameters**:
- `as_of_date` (date, optional): Report date. Default: today
- `status` (string, optional): Filter by status (ACTIVE, DISPOSED)
- `asset_category_id` (integer, optional): Filter by category

**Response**:
```json
{
  "report_date": "2026-03-31",
  "total_assets": 25,
  "total_acquisition_cost": "3000000.00",
  "total_accumulated_depreciation": "450000.00",
  "total_book_value": "2550000.00",
  "assets": [
    {
      "id": 123,
      "name": "Office Equipment",
      "asset_number": "AST-2026-001",
      "acquisition_date": "2026-01-01",
      "acquisition_cost": "120000.00",
      "salvage_value": "20000.00",
      "useful_life_months": 60,
      "depreciation_method": "LINEAR",
      "accumulated_depreciation": "5000.00",
      "book_value": "115000.00",
      "status": "ACTIVE"
    }
  ]
}
```

### 6. Get Asset Summary

Get depreciation summary for a single asset.

**Endpoint**: `GET /api/finance/assets/{id}/summary/`

**Response**:
```json
{
  "asset_id": 123,
  "asset_name": "Office Equipment",
  "status": "ACTIVE",
  "acquisition_cost": "120000.00",
  "salvage_value": "20000.00",
  "depreciable_amount": "100000.00",
  "useful_life_months": 60,
  "months_depreciated": 12,
  "accumulated_depreciation": "20000.00",
  "book_value": "100000.00",
  "monthly_depreciation": "1666.67",
  "remaining_months": 48,
  "estimated_completion_date": "2031-01-31"
}
```

### 7. Reverse Depreciation Posting

Reverse a posted depreciation entry.

**Endpoint**: `POST /api/finance/assets/{id}/reverse_posting/`

**Request Body**:
```json
{
  "schedule_entry_id": 789,
  "reason": "Incorrect amount posted"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Depreciation posting reversed",
  "reversed_amount": "1666.67",
  "reversing_journal_entry": {
    "id": 458,
    "entry_number": "JE-2026-000458",
    "description": "Reversal: March 2026 Depreciation"
  }
}
```

### 8. Update Depreciation Method

Change depreciation method (requires regeneration).

**Endpoint**: `PATCH /api/finance/assets/{id}/update_method/`

**Request Body**:
```json
{
  "depreciation_method": "DECLINING",
  "regenerate_schedule": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Depreciation method updated",
  "old_method": "LINEAR",
  "new_method": "DECLINING",
  "schedule_regenerated": true,
  "new_monthly_amount": "2000.00"
}
```

### 9. Asset Depreciation Dashboard

Get depreciation metrics dashboard.

**Endpoint**: `GET /api/finance/assets/depreciation_dashboard/`

**Response**:
```json
{
  "total_assets": 25,
  "active_assets": 23,
  "disposed_assets": 2,
  "total_acquisition_cost": "3000000.00",
  "total_accumulated_depreciation": "450000.00",
  "total_book_value": "2550000.00",
  "monthly_depreciation_expense": "45000.00",
  "ytd_depreciation": "135000.00",
  "pending_postings": 5,
  "depreciation_by_method": {
    "LINEAR": {"count": 15, "book_value": "1800000.00"},
    "DECLINING": {"count": 8, "book_value": "700000.00"},
    "UNITS": {"count": 2, "book_value": "50000.00"}
  }
}
```

---

## Budget Variance API

### 1. Create Budget

Create a new budget.

**Endpoint**: `POST /api/finance/budgets/`

**Request Body**:
```json
{
  "name": "2026 Operating Budget",
  "fiscal_year_id": 5,
  "description": "Annual operating budget",
  "budget_type": "OPERATING",
  "status": "DRAFT"
}
```

**Response**:
```json
{
  "id": 10,
  "name": "2026 Operating Budget",
  "fiscal_year": {
    "id": 5,
    "name": "FY2026"
  },
  "status": "DRAFT",
  "total_budgeted": "0.00",
  "created_at": "2026-01-01T10:00:00Z"
}
```

### 2. Add Budget Lines

Add account budget lines.

**Endpoint**: `POST /api/finance/budgets/{id}/lines/`

**Request Body**:
```json
{
  "lines": [
    {
      "account_id": 100,
      "fiscal_period_id": 1,
      "budgeted_amount": "10000.00",
      "notes": "January operating expenses"
    },
    {
      "account_id": 100,
      "fiscal_period_id": 2,
      "budgeted_amount": "10000.00",
      "notes": "February operating expenses"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "lines_created": 2,
  "total_budgeted": "20000.00"
}
```

### 3. Refresh Actuals

Refresh actual amounts from posted journal entries.

**Endpoint**: `POST /api/finance/budgets/{id}/refresh_actuals/`

**Request Body**:
```json
{
  "period_ids": [1, 2, 3],  // Optional: specific periods
  "recalculate_variance": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Actuals refreshed successfully",
  "lines_updated": 24,
  "total_actual": "192000.00",
  "total_budgeted": "200000.00",
  "overall_variance": "8000.00",
  "overall_variance_pct": "4.00"
}
```

### 4. Variance Report

Get comprehensive variance analysis.

**Endpoint**: `GET /api/finance/budgets/{id}/variance_report/`

**Parameters**:
- `period_id` (integer, optional): Filter by fiscal period
- `account_id` (integer, optional): Filter by account
- `cost_center_id` (integer, optional): Filter by cost center
- `group_by` (string, optional): `account`, `period`, `cost_center`

**Response**:
```json
{
  "budget_id": 10,
  "budget_name": "2026 Operating Budget",
  "report_date": "2026-03-31",
  "total_budgeted": "200000.00",
  "total_actual": "192000.00",
  "total_variance": "8000.00",
  "total_variance_pct": "4.00",
  "by_account": [
    {
      "account_id": 100,
      "account_code": "6000",
      "account_name": "Operating Expenses",
      "budgeted": "120000.00",
      "actual": "115000.00",
      "variance": "5000.00",
      "variance_pct": "4.17",
      "status": "UNDER_BUDGET"
    },
    {
      "account_id": 101,
      "account_code": "6100",
      "account_name": "Marketing",
      "budgeted": "50000.00",
      "actual": "52000.00",
      "variance": "-2000.00",
      "variance_pct": "-4.00",
      "status": "OVER_BUDGET"
    }
  ],
  "by_period": [
    {
      "period_id": 1,
      "period_name": "January 2026",
      "budgeted": "65000.00",
      "actual": "63000.00",
      "variance": "2000.00",
      "variance_pct": "3.08"
    }
  ]
}
```

### 5. Variance Alerts

Get over-budget alerts with severity levels.

**Endpoint**: `GET /api/finance/budgets/{id}/variance_alerts/`

**Parameters**:
- `threshold_pct` (decimal, optional): Alert threshold. Default: `10.00`
- `severity` (string, optional): Filter by severity (`CRITICAL`, `WARNING`, `INFO`)

**Response**:
```json
{
  "budget_id": 10,
  "threshold_pct": "10.00",
  "alerts": [
    {
      "severity": "CRITICAL",
      "account_id": 102,
      "account_code": "6200",
      "account_name": "Travel Expenses",
      "period": "February 2026",
      "budgeted": "5000.00",
      "actual": "6500.00",
      "variance": "-1500.00",
      "over_budget_pct": "30.00",
      "message": "CRITICAL: 30.00% over budget"
    },
    {
      "severity": "WARNING",
      "account_id": 103,
      "account_code": "6300",
      "account_name": "Utilities",
      "period": "March 2026",
      "budgeted": "8000.00",
      "actual": "8600.00",
      "variance": "-600.00",
      "over_budget_pct": "7.50",
      "message": "WARNING: 7.50% over budget"
    }
  ],
  "critical_count": 1,
  "warning_count": 1,
  "info_count": 0
}
```

### 6. Period Comparison

Compare budget performance across periods.

**Endpoint**: `GET /api/finance/budgets/{id}/period_comparison/`

**Parameters**:
- `period_ids` (array): Periods to compare

**Response**:
```json
{
  "budget_id": 10,
  "periods": [
    {
      "period_id": 1,
      "period_name": "January 2026",
      "budgeted": "65000.00",
      "actual": "63000.00",
      "variance": "2000.00",
      "variance_pct": "3.08",
      "status": "UNDER_BUDGET"
    },
    {
      "period_id": 2,
      "period_name": "February 2026",
      "budgeted": "68000.00",
      "actual": "70000.00",
      "variance": "-2000.00",
      "variance_pct": "-2.94",
      "status": "OVER_BUDGET"
    }
  ],
  "trend": "DETERIORATING"
}
```

### 7. Budget Performance Summary

Get overall budget performance metrics.

**Endpoint**: `GET /api/finance/budgets/{id}/performance/`

**Response**:
```json
{
  "budget_id": 10,
  "fiscal_year": "FY2026",
  "status": "APPROVED",
  "total_budgeted": "800000.00",
  "total_actual": "240000.00",
  "periods_elapsed": 3,
  "total_periods": 12,
  "completion_pct": "25.00",
  "spend_rate_pct": "30.00",
  "projected_year_end": "960000.00",
  "projected_variance": "-160000.00",
  "on_track": false,
  "recommendation": "Spending 30% vs 25% elapsed. Review high-variance accounts."
}
```

### 8. Budget vs Actual Trend

Get time-series data for charting.

**Endpoint**: `GET /api/finance/budgets/{id}/trend/`

**Parameters**:
- `account_id` (integer, optional): Filter by account

**Response**:
```json
{
  "budget_id": 10,
  "data_points": [
    {
      "period": "2026-01",
      "budgeted": "65000.00",
      "actual": "63000.00",
      "variance": "2000.00"
    },
    {
      "period": "2026-02",
      "budgeted": "68000.00",
      "actual": "70000.00",
      "variance": "-2000.00"
    },
    {
      "period": "2026-03",
      "budgeted": "67000.00",
      "actual": "64000.00",
      "variance": "3000.00"
    }
  ]
}
```

---

## Financial Reports API

### 1. Trial Balance

Generate trial balance report.

**Endpoint**: `GET /api/finance/reports/trial-balance/`

**Parameters**:
- `start_date` (date, required): Period start date
- `end_date` (date, required): Period end date
- `include_opening` (boolean, optional): Include opening balances. Default: `true`
- `include_closing` (boolean, optional): Include closing balances. Default: `true`

**Response**:
```json
{
  "report_type": "TRIAL_BALANCE",
  "start_date": "2026-01-01",
  "end_date": "2026-03-31",
  "generated_at": "2026-03-31T15:30:00Z",
  "accounts": [
    {
      "code": "1000",
      "name": "Cash",
      "type": "ASSET",
      "opening_balance": "50000.00",
      "period_debit": "150000.00",
      "period_credit": "80000.00",
      "closing_balance": "120000.00"
    },
    {
      "code": "4000",
      "name": "Sales Revenue",
      "type": "REVENUE",
      "opening_balance": "0.00",
      "period_debit": "0.00",
      "period_credit": "200000.00",
      "closing_balance": "200000.00"
    }
  ],
  "total_debits": "350000.00",
  "total_credits": "350000.00",
  "is_balanced": true
}
```

### 2. Profit & Loss Statement

Generate income statement.

**Endpoint**: `GET /api/finance/reports/profit-loss/`

**Parameters**:
- `start_date` (date, required): Period start
- `end_date` (date, required): Period end
- `comparative` (boolean, optional): Include comparative period. Default: `false`

**Response**:
```json
{
  "report_type": "PROFIT_LOSS",
  "period": "Q1 2026",
  "start_date": "2026-01-01",
  "end_date": "2026-03-31",
  "revenue": [
    {
      "account_code": "4000",
      "account_name": "Sales Revenue",
      "amount": "200000.00"
    },
    {
      "account_code": "4100",
      "account_name": "Service Revenue",
      "amount": "50000.00"
    }
  ],
  "total_revenue": "250000.00",
  "expenses": [
    {
      "account_code": "6000",
      "account_name": "Operating Expenses",
      "amount": "120000.00"
    },
    {
      "account_code": "6100",
      "account_name": "Depreciation Expense",
      "amount": "15000.00"
    }
  ],
  "total_expenses": "135000.00",
  "net_income": "115000.00",
  "net_margin_pct": "46.00"
}
```

### 3. Balance Sheet

Generate balance sheet.

**Endpoint**: `GET /api/finance/reports/balance-sheet/`

**Parameters**:
- `as_of_date` (date, required): Report date
- `comparative` (boolean, optional): Include prior period. Default: `false`

**Response**:
```json
{
  "report_type": "BALANCE_SHEET",
  "as_of_date": "2026-03-31",
  "assets": {
    "current_assets": [
      {
        "code": "1000",
        "name": "Cash",
        "amount": "120000.00"
      },
      {
        "code": "1200",
        "name": "Accounts Receivable",
        "amount": "80000.00"
      }
    ],
    "total_current_assets": "200000.00",
    "fixed_assets": [
      {
        "code": "1500",
        "name": "Fixed Assets",
        "amount": "500000.00"
      },
      {
        "code": "1510",
        "name": "Accumulated Depreciation",
        "amount": "-50000.00"
      }
    ],
    "total_fixed_assets": "450000.00",
    "total_assets": "650000.00"
  },
  "liabilities": {
    "current_liabilities": [
      {
        "code": "2000",
        "name": "Accounts Payable",
        "amount": "60000.00"
      }
    ],
    "total_current_liabilities": "60000.00",
    "long_term_liabilities": [
      {
        "code": "2500",
        "name": "Loan Payable",
        "amount": "200000.00"
      }
    ],
    "total_long_term_liabilities": "200000.00",
    "total_liabilities": "260000.00"
  },
  "equity": {
    "capital": [
      {
        "code": "3000",
        "name": "Owner's Capital",
        "amount": "300000.00"
      }
    ],
    "retained_earnings": "90000.00",
    "total_equity": "390000.00"
  },
  "total_liabilities_equity": "650000.00",
  "is_balanced": true
}
```

### 4. Cash Flow Statement

Generate cash flow statement (indirect method).

**Endpoint**: `GET /api/finance/reports/cash-flow/`

**Parameters**:
- `start_date` (date, required): Period start
- `end_date` (date, required): Period end
- `method` (string, optional): `INDIRECT` or `DIRECT`. Default: `INDIRECT`

**Response**:
```json
{
  "report_type": "CASH_FLOW",
  "method": "INDIRECT",
  "period": "Q1 2026",
  "operating_activities": {
    "net_income": "115000.00",
    "adjustments": {
      "depreciation": "15000.00",
      "ar_increase": "-20000.00",
      "ap_increase": "10000.00"
    },
    "net_cash_from_operations": "120000.00"
  },
  "investing_activities": {
    "asset_purchases": "-100000.00",
    "asset_sales": "0.00",
    "net_cash_from_investing": "-100000.00"
  },
  "financing_activities": {
    "loan_proceeds": "50000.00",
    "loan_repayments": "-10000.00",
    "net_cash_from_financing": "40000.00"
  },
  "net_cash_change": "60000.00",
  "cash_beginning": "60000.00",
  "cash_ending": "120000.00"
}
```

### 5. Financial Reports Dashboard

Get quick summary of all reports.

**Endpoint**: `GET /api/finance/reports/dashboard/`

**Parameters**:
- `as_of_date` (date, optional): Report date. Default: today

**Response**:
```json
{
  "as_of_date": "2026-03-31",
  "summary": {
    "total_assets": "650000.00",
    "total_liabilities": "260000.00",
    "total_equity": "390000.00",
    "net_income_ytd": "115000.00",
    "cash_balance": "120000.00",
    "current_ratio": "3.33",
    "debt_to_equity": "0.67"
  },
  "quick_links": {
    "trial_balance": "/api/finance/reports/trial-balance/?start_date=2026-01-01&end_date=2026-03-31",
    "profit_loss": "/api/finance/reports/profit-loss/?start_date=2026-01-01&end_date=2026-03-31",
    "balance_sheet": "/api/finance/reports/balance-sheet/?as_of_date=2026-03-31",
    "cash_flow": "/api/finance/reports/cash-flow/?start_date=2026-01-01&end_date=2026-03-31"
  }
}
```

### 6. Account Drill-Down

Get detailed transactions for an account.

**Endpoint**: `GET /api/finance/reports/account-drilldown/{account_id}/`

**Parameters**:
- `start_date` (date, optional): Filter start
- `end_date` (date, optional): Filter end
- `page` (integer, optional): Pagination

**Response**:
```json
{
  "account": {
    "id": 10,
    "code": "1000",
    "name": "Cash",
    "type": "ASSET"
  },
  "period": {
    "start_date": "2026-01-01",
    "end_date": "2026-03-31"
  },
  "summary": {
    "opening_balance": "60000.00",
    "total_debits": "150000.00",
    "total_credits": "90000.00",
    "closing_balance": "120000.00"
  },
  "transactions": [
    {
      "date": "2026-01-15",
      "journal_entry": "JE-2026-000123",
      "description": "Customer payment",
      "debit": "5000.00",
      "credit": "0.00",
      "balance": "65000.00"
    },
    {
      "date": "2026-01-20",
      "journal_entry": "JE-2026-000145",
      "description": "Supplier payment",
      "debit": "0.00",
      "credit": "3000.00",
      "balance": "62000.00"
    }
  ],
  "pagination": {
    "page": 1,
    "total_pages": 5,
    "total_transactions": 48
  }
}
```

---

## Bank Reconciliation API

### 1. Import Bank Statement

Import CSV/Excel bank statement.

**Endpoint**: `POST /api/finance/bank-reconciliation/import/`

**Request** (multipart/form-data):
```
file: statement.csv
bank_account_id: 5
statement_date: 2026-03-31
skip_duplicates: true
```

**Response**:
```json
{
  "success": true,
  "message": "Statement imported successfully",
  "statement_id": 50,
  "imported_count": 45,
  "skipped_count": 2,
  "errors": []
}
```

### 2. Auto-Match Transactions

Run auto-matching algorithm.

**Endpoint**: `POST /api/finance/bank-reconciliation/{id}/auto_match/`

**Request Body**:
```json
{
  "level": 4,  // 1-4 (increasingly fuzzy matching)
  "auto_confirm": false
}
```

**Response**:
```json
{
  "success": true,
  "statement_id": 50,
  "matched_count": 38,
  "unmatched_count": 7,
  "level_breakdown": {
    "level_1": 30,  // Exact match
    "level_2": 5,   // Date tolerance
    "level_3": 2,   // Reference match
    "level_4": 1    // Fuzzy amount
  },
  "matched_total": "185000.00"
}
```

### 3. Manual Match

Manually match statement line to journal entry.

**Endpoint**: `POST /api/finance/bank-reconciliation/{id}/manual_match/`

**Request Body**:
```json
{
  "statement_line_id": 123,
  "journal_entry_id": 456,
  "notes": "Manual match - bank fee included"
}
```

**Response**:
```json
{
  "success": true,
  "statement_line_id": 123,
  "journal_entry_id": 456,
  "matched_at": "2026-03-31T16:00:00Z"
}
```

### 4. Unmatch Transaction

Remove a match.

**Endpoint**: `POST /api/finance/bank-reconciliation/{id}/unmatch/`

**Request Body**:
```json
{
  "statement_line_id": 123,
  "reason": "Incorrect match"
}
```

**Response**:
```json
{
  "success": true,
  "statement_line_id": 123,
  "status": "UNMATCHED"
}
```

### 5. Get Unmatched Transactions

Get all unmatched items.

**Endpoint**: `GET /api/finance/bank-reconciliation/{id}/unmatched/`

**Response**:
```json
{
  "statement_id": 50,
  "statement_lines": [
    {
      "id": 125,
      "date": "2026-03-20",
      "description": "Unknown transaction",
      "amount": "500.00",
      "type": "DEPOSIT"
    }
  ],
  "journal_entries": [
    {
      "id": 470,
      "date": "2026-03-18",
      "description": "Expense payment",
      "amount": "750.00"
    }
  ],
  "unmatched_bank_total": "2500.00",
  "unmatched_book_total": "3200.00",
  "difference": "700.00"
}
```

### 6. Reconciliation Report

Generate reconciliation report.

**Endpoint**: `GET /api/finance/bank-reconciliation/{id}/report/`

**Response**:
```json
{
  "statement_id": 50,
  "bank_account": "Main Bank Account (123456789)",
  "statement_date": "2026-03-31",
  "opening_balance": "85000.00",
  "closing_balance": "120000.00",
  "total_deposits": "150000.00",
  "total_withdrawals": "115000.00",
  "matched_count": 38,
  "unmatched_count": 7,
  "matched_total": "185000.00",
  "unmatched_total": "5000.00",
  "reconciliation_difference": "700.00",
  "status": "PARTIALLY_RECONCILED",
  "completion_pct": "84.44"
}
```

### 7. Finalize Reconciliation

Mark reconciliation as complete.

**Endpoint**: `POST /api/finance/bank-reconciliation/{id}/finalize/`

**Request Body**:
```json
{
  "confirmed": true,
  "notes": "All material items reconciled"
}
```

**Response**:
```json
{
  "success": true,
  "statement_id": 50,
  "status": "RECONCILED",
  "finalized_at": "2026-03-31T17:00:00Z",
  "finalized_by": "testuser"
}
```

---

## Loan Management API

### 1. Get Amortization Schedule

Get enhanced amortization schedule.

**Endpoint**: `GET /api/finance/loans/{id}/amortization-schedule/`

**Response**:
```json
{
  "loan_id": 20,
  "principal_amount": "120000.00",
  "interest_rate": "12.00",
  "term_months": 60,
  "amortization_method": "REDUCING_BALANCE",
  "monthly_payment": "2668.74",
  "schedule": [
    {
      "installment_number": 1,
      "due_date": "2026-02-01",
      "installment_amount": "2668.74",
      "principal_amount": "1468.74",
      "interest_amount": "1200.00",
      "balance_after": "118531.26",
      "status": "PENDING"
    },
    {
      "installment_number": 2,
      "due_date": "2026-03-01",
      "installment_amount": "2668.74",
      "principal_amount": "1483.43",
      "interest_amount": "1185.31",
      "balance_after": "117047.83",
      "status": "PENDING"
    }
  ],
  "total_principal": "120000.00",
  "total_interest": "40124.40",
  "total_amount": "160124.40"
}
```

### 2. Calculate Early Payoff

Calculate early payoff amount.

**Endpoint**: `POST /api/finance/loans/{id}/early-payoff/`

**Request Body**:
```json
{
  "payoff_date": "2028-06-01"
}
```

**Response**:
```json
{
  "success": true,
  "loan_id": 20,
  "payoff_date": "2028-06-01",
  "original_term_months": 60,
  "payments_made": 24,
  "remaining_months": 36,
  "principal_paid": "28465.12",
  "interest_paid": "35583.64",
  "remaining_principal": "91534.88",
  "remaining_interest_full_term": "4540.76",
  "early_payoff_amount": "91534.88",
  "interest_savings": "4540.76",
  "total_interest_with_early_payoff": "35583.64",
  "total_interest_full_term": "40124.40"
}
```

### 3. Get Loan Summary

Get comprehensive loan summary.

**Endpoint**: `GET /api/finance/loans/{id}/summary/`

**Response**:
```json
{
  "loan_id": 20,
  "loan_name": "Business Expansion Loan",
  "status": "ACTIVE",
  "principal_amount": "120000.00",
  "interest_rate": "12.00",
  "term_months": 60,
  "amortization_method": "REDUCING_BALANCE",
  "start_date": "2026-01-01",
  "maturity_date": "2031-01-01",
  "monthly_payment": "2668.74",
  "total_amount": "160124.40",
  "total_interest": "40124.40",
  "payments_made": 3,
  "principal_paid": "4313.28",
  "interest_paid": "3692.94",
  "remaining_balance": "115686.72",
  "next_payment_date": "2026-05-01",
  "next_payment_amount": "2668.74",
  "on_time_payments": 3,
  "late_payments": 0
}
```

### 4. Record Loan Payment

Record a loan installment payment.

**Endpoint**: `POST /api/finance/loans/{id}/record-payment/`

**Request Body**:
```json
{
  "installment_id": 45,
  "payment_date": "2026-04-01",
  "payment_amount": "2668.74",
  "payment_method": "BANK_TRANSFER",
  "reference": "TXN-2026-04-001"
}
```

**Response**:
```json
{
  "success": true,
  "installment_id": 45,
  "payment_date": "2026-04-01",
  "payment_amount": "2668.74",
  "principal_paid": "1498.55",
  "interest_paid": "1170.19",
  "remaining_balance": "114188.17",
  "journal_entry": {
    "id": 480,
    "entry_number": "JE-2026-000480",
    "description": "Loan payment - April 2026"
  }
}
```

### 5. Loan Payment History

Get payment history.

**Endpoint**: `GET /api/finance/loans/{id}/payment-history/`

**Parameters**:
- `start_date` (date, optional): Filter start
- `end_date` (date, optional): Filter end

**Response**:
```json
{
  "loan_id": 20,
  "payments": [
    {
      "installment_number": 1,
      "due_date": "2026-02-01",
      "payment_date": "2026-02-01",
      "installment_amount": "2668.74",
      "principal_amount": "1468.74",
      "interest_amount": "1200.00",
      "status": "PAID",
      "days_late": 0
    },
    {
      "installment_number": 2,
      "due_date": "2026-03-01",
      "payment_date": "2026-03-05",
      "installment_amount": "2668.74",
      "principal_amount": "1483.43",
      "interest_amount": "1185.31",
      "status": "PAID",
      "days_late": 4
    }
  ],
  "summary": {
    "total_payments": 3,
    "on_time": 2,
    "late": 1,
    "total_paid": "8006.22",
    "principal_paid": "4313.28",
    "interest_paid": "3692.94"
  }
}
```

---

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (authentication required) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Authentication

All endpoints require JWT authentication:

```
Authorization: Bearer <token>
```

---

## Rate Limiting

- Standard: 100 requests/minute
- Reports: 20 requests/minute
- Batch operations: 10 requests/minute

---

## Pagination

List endpoints support pagination:

```
?page=1&page_size=50
```

Response includes:
```json
{
  "count": 150,
  "next": "/api/finance/assets/?page=2",
  "previous": null,
  "results": [...]
}
```

---

**Last Updated**: 2026-03-12
**API Version**: 3.1.4
**Documentation**: https://docs.tsfsystem.com/finance-api
