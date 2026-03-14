# Finance Module User Guide

Complete user guide for Finance Phase 2 features.

**Version**: 3.1.4
**Last Updated**: 2026-03-12
**Audience**: End Users, Accountants, Finance Managers

---

## Table of Contents

1. [Asset Depreciation](#asset-depreciation)
2. [Budget Variance Management](#budget-variance-management)
3. [Bank Reconciliation](#bank-reconciliation)
4. [Loan Management](#loan-management)
5. [Financial Reports](#financial-reports)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Asset Depreciation

### Overview

Track fixed asset depreciation using multiple methods with automated monthly posting and journal entry generation.

### Supported Depreciation Methods

1. **Straight-Line (LINEAR)**
   - Equal depreciation each month
   - Formula: (Cost - Salvage Value) / Useful Life
   - Use for: Most assets, simple depreciation

2. **Declining Balance (DECLINING)**
   - Accelerated depreciation (200% method)
   - Higher expense in early years
   - Use for: Technology, vehicles, assets that lose value quickly

3. **Units of Production (UNITS)**
   - Depreciation based on usage/production
   - Use for: Manufacturing equipment, machinery

### Step-by-Step: Setting Up Asset Depreciation

#### Step 1: Create or Edit Asset

1. Navigate to **Finance > Assets**
2. Click **New Asset** or edit existing asset
3. Fill in required fields:
   - **Asset Name**: e.g., "Office Computer"
   - **Asset Number**: Auto-generated or manual (e.g., AST-2026-001)
   - **Acquisition Date**: Purchase date
   - **Acquisition Cost**: Purchase price ($5,000)
   - **Salvage Value**: Estimated residual value ($500)
   - **Useful Life (Months)**: e.g., 36 months (3 years)
   - **Depreciation Method**: Select LINEAR, DECLINING, or UNITS

4. Select GL Accounts:
   - **Asset Account**: 1500 - Fixed Assets
   - **Accumulated Depreciation Account**: 1510 - Accumulated Depreciation
   - **Depreciation Expense Account**: 6100 - Depreciation Expense

5. Click **Save**

#### Step 2: Generate Depreciation Schedule

1. Open the asset details
2. Click **Depreciation** tab
3. Click **Generate Schedule**
4. Review the schedule showing:
   - Month-by-month depreciation amounts
   - Accumulated depreciation
   - Book value over time

**Example Schedule (Straight-Line)**:
```
Asset: Office Computer
Cost: $5,000
Salvage: $500
Life: 36 months
Monthly Depreciation: $125 ($4,500 / 36)

Month 1: Depreciation $125, Accumulated $125, Book Value $4,875
Month 2: Depreciation $125, Accumulated $250, Book Value $4,750
...
Month 36: Depreciation $125, Accumulated $4,500, Book Value $500
```

#### Step 3: Post Monthly Depreciation

**Manual Posting**:
1. Go to **Finance > Assets > Depreciation**
2. Click **Post Monthly Depreciation**
3. Select **Month** and **Year**
4. Select assets to depreciate (or "All Active")
5. Click **Post**

**Result**: Journal entry created:
```
Date: 2026-03-31
DR: Depreciation Expense (6100)     $125
CR: Accumulated Depreciation (1510)  $125
```

**Automated Posting** (Recommended):
- System automatically posts depreciation on the 1st of each month via Celery task
- No manual intervention required
- Email notification sent on completion

#### Step 4: Dispose of Asset

When selling or scrapping an asset:

1. Open asset details
2. Click **Dispose Asset**
3. Enter:
   - **Disposal Date**: Date of sale/scrap
   - **Disposal Amount**: Sale proceeds (or $0 for scrap)
   - **Disposal Account**: e.g., 1000 - Cash
   - **Gain/Loss Account**: 7100 - Gain on Disposal or 8100 - Loss on Disposal
4. Click **Dispose**

**Example - Asset Sold with Gain**:
```
Asset Cost: $5,000
Accumulated Depreciation: $2,500
Book Value: $2,500
Sale Price: $3,000
Gain: $500

Journal Entry:
DR: Cash (1000)                        $3,000
DR: Accumulated Depreciation (1510)    $2,500
CR: Fixed Assets (1500)                $5,000
CR: Gain on Disposal (7100)            $500
```

### Reports

**Asset Register**:
- Navigate to **Finance > Reports > Asset Register**
- Shows all assets with current book values
- Filter by category, status, or date

**Depreciation Summary**:
- Monthly depreciation expense by asset
- YTD depreciation totals
- Projected depreciation for upcoming months

---

## Budget Variance Management

### Overview

Create budgets, track actual spending, and receive alerts when accounts exceed budget thresholds.

### Step-by-Step: Creating a Budget

#### Step 1: Create Budget

1. Navigate to **Finance > Budgets**
2. Click **New Budget**
3. Fill in:
   - **Budget Name**: "2026 Operating Budget"
   - **Fiscal Year**: Select FY2026
   - **Budget Type**: Operating, Capital, or Project
   - **Description**: Optional notes
4. Click **Create**

#### Step 2: Add Budget Lines

1. Open the budget
2. Click **Add Budget Lines**
3. For each account and period:
   - **Account**: Select GL account (e.g., 6000 - Operating Expenses)
   - **Fiscal Period**: Select period (e.g., January 2026)
   - **Budgeted Amount**: Enter amount ($10,000)
   - **Notes**: Optional
4. Click **Add Line**
5. Repeat for all accounts/periods

**Quick Import** (CSV):
- Download template: **Budget > Import Template**
- Fill in CSV: `Account Code, Period, Amount`
- Upload: **Budget > Import CSV**

#### Step 3: Approve Budget

1. Review all budget lines
2. Click **Submit for Approval**
3. Finance Manager approves
4. Status changes to **APPROVED**

### Monitoring Budget Variance

#### Refresh Actuals

System automatically updates actual amounts from posted journal entries daily. To manually refresh:

1. Open budget
2. Click **Variance** tab
3. Click **Refresh Actuals**
4. System calculates:
   - Actual amount from journal entries
   - Variance = Budget - Actual
   - Variance % = (Variance / Budget) × 100

#### Variance Report

1. Navigate to **Finance > Budgets > [Budget Name] > Variance Report**
2. View variance by:
   - **By Account**: Which accounts over/under budget
   - **By Period**: Which months over/under budget
   - **By Cost Center**: Which departments over/under budget

**Example Variance Report**:
```
Account: 6000 - Operating Expenses
Period: March 2026
Budgeted: $10,000
Actual: $8,500
Variance: $1,500 (15% under budget) ✅

Account: 6200 - Travel Expenses
Period: March 2026
Budgeted: $5,000
Actual: $6,500
Variance: -$1,500 (30% over budget) ❌ CRITICAL ALERT
```

#### Variance Alerts

System generates alerts with severity levels:

- **CRITICAL** (Red): ≥10% over budget
- **WARNING** (Orange): 5-10% over budget
- **INFO** (Blue): <5% over budget

**Receiving Alerts**:
1. Email notifications sent daily
2. Dashboard shows alert count
3. View details: **Finance > Budgets > Alerts**

### Period-Over-Period Comparison

Compare budget performance across months:

1. Navigate to **Finance > Budgets > Period Comparison**
2. Select periods to compare
3. View trend:
   - **Improving**: Variance decreasing
   - **Deteriorating**: Variance increasing
   - **Stable**: Consistent variance

---

## Bank Reconciliation

### Overview

Reconcile bank statements with accounting records using 4-level auto-matching algorithm and manual matching for exceptions.

### Step-by-Step: Reconciling Bank Statement

#### Step 1: Import Bank Statement

1. Download bank statement as CSV or Excel from your bank
2. Navigate to **Finance > Bank Reconciliation**
3. Click **Import Statement**
4. Select:
   - **Bank Account**: Main Bank Account
   - **Statement Date**: 2026-03-31
   - **File**: Upload CSV/Excel
5. Click **Import**

**CSV Format Required**:
```csv
Date,Description,Reference,Amount,Type
2026-03-15,Customer Payment,INV-001,5000.00,DEPOSIT
2026-03-20,Supplier Payment,PO-123,-3000.00,WITHDRAWAL
```

#### Step 2: Auto-Match Transactions

System uses 4-level matching:

**Level 1: Exact Match**
- Same amount
- Same date
- Confidence: 100%

**Level 2: Date Tolerance**
- Same amount
- Date within ±3 days
- Confidence: 95%

**Level 3: Reference Match**
- Same reference number
- Date/amount can differ
- Confidence: 90%

**Level 4: Fuzzy Amount**
- Amount within ±1%
- Same date
- Confidence: 85%

**Running Auto-Match**:
1. Open imported statement
2. Click **Auto-Match**
3. Select level (1-4, recommend starting with 1)
4. Click **Run**
5. Review matches
6. Confirm or unmatch

**Example**:
```
Bank Statement Line:
Date: 2026-03-15
Amount: $5,000
Description: Customer Payment

Journal Entry:
Date: 2026-03-15
Amount: $5,000
Description: Payment from ABC Corp

Match Level: 1 (Exact) ✅
```

#### Step 3: Manual Matching

For unmatched transactions:

1. Click **Unmatched** tab
2. For each unmatched bank line:
   - Find corresponding journal entry
   - Click **Match Manually**
   - Select journal entry
   - Add notes if needed
   - Click **Confirm Match**

#### Step 4: Handle Exceptions

**Unmatched Bank Transactions**:
- Bank fees not in accounting
- Deposits not yet recorded
- Bank errors

**Actions**:
1. Create journal entry for missing transaction
2. Wait for next refresh
3. Auto-match will pick it up

**Unmatched Book Transactions**:
- Checks not yet cleared
- Deposits in transit

**Actions**:
- Note as "outstanding items"
- Will clear in next statement

#### Step 5: Reconciliation Report

1. Click **Reconciliation Report**
2. Review:
   - Opening balance: $85,000
   - Total deposits: $150,000
   - Total withdrawals: $115,000
   - Closing balance: $120,000
   - Matched: 38 transactions ($185,000)
   - Unmatched: 7 transactions ($5,000)
   - Difference: $700

3. If difference is immaterial (<1%), click **Finalize**
4. Status changes to **RECONCILED**

---

## Loan Management

### Overview

Manage loans with multiple amortization methods, track payments, and calculate early payoff options.

### Step-by-Step: Setting Up a Loan

#### Step 1: Create Loan

1. Navigate to **Finance > Loans**
2. Click **New Loan**
3. Fill in:
   - **Loan Name**: "Business Expansion Loan"
   - **Lender**: ABC Bank
   - **Principal Amount**: $120,000
   - **Interest Rate**: 12% (annual)
   - **Term (Months)**: 60 (5 years)
   - **Start Date**: 2026-01-01
   - **Amortization Method**: Select method (see below)

4. Select GL Accounts:
   - **Loan Payable Account**: 2500 - Loan Payable
   - **Interest Expense Account**: 6500 - Interest Expense

5. Click **Save**

### Amortization Methods Explained

**1. Reducing Balance (Most Common)**
- Equal monthly payments
- Interest calculated on remaining balance
- More interest in early months, more principal in later months

**Example** ($120,000 @ 12% for 60 months):
```
Monthly Payment: $2,668.74 (constant)

Month 1:
Interest: $120,000 × 1% = $1,200
Principal: $2,668.74 - $1,200 = $1,468.74
Balance: $118,531.26

Month 2:
Interest: $118,531.26 × 1% = $1,185.31
Principal: $2,668.74 - $1,185.31 = $1,483.43
Balance: $117,047.83
```

**2. Flat Rate**
- Simple interest
- Equal interest each month
- Equal principal each month

**Example** ($60,000 @ 10% for 12 months):
```
Total Interest: $60,000 × 10% = $6,000
Monthly Interest: $6,000 / 12 = $500
Monthly Principal: $60,000 / 12 = $5,000
Monthly Payment: $5,500 (constant)
```

**3. Balloon Payment**
- Low monthly payments
- Large final payment
- Refinance or sell asset to pay balloon

**Example** ($100,000 @ 8% for 60 months, $50,000 balloon):
```
Regular Payment: ~$1,200/month
Final Payment: ~$51,200 (includes $50,000 balloon)
```

**4. Interest-Only**
- Pay only interest first
- Principal due at end
- Lowest monthly payments

**Example** ($80,000 @ 6% for 24 months):
```
Monthly Payment: $80,000 × 0.5% = $400 (interest only)
Final Payment: $80,400 (principal + last interest)
```

### Recording Loan Payments

1. Navigate to **Finance > Loans > [Loan Name]**
2. Click **Payments** tab
3. Click **Record Payment**
4. Enter:
   - **Payment Date**: 2026-02-01
   - **Payment Amount**: $2,668.74
   - **Payment Method**: Bank Transfer
   - **Reference**: Transaction ID
5. Click **Save**

**Journal Entry Created**:
```
DR: Loan Payable (2500)         $1,468.74 (principal)
DR: Interest Expense (6500)     $1,200.00 (interest)
CR: Cash (1000)                 $2,668.74
```

### Early Payoff Calculation

To calculate early payoff:

1. Open loan
2. Click **Early Payoff Calculator**
3. Enter **Payoff Date**: 2028-06-01
4. View results:
   - Remaining Principal: $91,534.88
   - Interest Savings: $4,540.76
   - Total Interest (with early payoff): $35,583.64
   - Total Interest (full term): $40,124.40

5. Decide if savings justify early payoff

---

## Financial Reports

### Overview

Generate standard financial reports: Trial Balance, Profit & Loss, Balance Sheet, and Cash Flow Statement.

### Trial Balance

**Purpose**: Verify that debits equal credits (accounting is balanced).

**How to Generate**:
1. Navigate to **Finance > Reports > Trial Balance**
2. Select:
   - **Start Date**: 2026-01-01
   - **End Date**: 2026-03-31
   - **Include Opening Balances**: Yes
   - **Include Closing Balances**: Yes
3. Click **Generate**

**Report Shows**:
- Each account with opening, period, and closing balances
- Total debits and credits
- Validation: Debits = Credits ✓

**Use Cases**:
- Month-end closing
- Verify accounting accuracy
- Prepare for audit

### Profit & Loss Statement (Income Statement)

**Purpose**: Show profitability (Revenue - Expenses = Net Income).

**How to Generate**:
1. Navigate to **Finance > Reports > Profit & Loss**
2. Select:
   - **Period**: Q1 2026 (or custom date range)
   - **Comparative Period**: Yes (compare to prior period)
3. Click **Generate**

**Report Shows**:
- Revenue accounts (total revenue)
- Expense accounts (total expenses)
- Net Income (profit or loss)
- Net Margin % (net income / revenue)

**Example**:
```
Revenue:
  Sales Revenue:        $200,000
  Service Revenue:      $50,000
Total Revenue:          $250,000

Expenses:
  Operating Expenses:   $120,000
  Depreciation:         $15,000
  Interest:             $5,000
Total Expenses:         $140,000

Net Income:             $110,000
Net Margin:             44%
```

### Balance Sheet

**Purpose**: Show financial position (Assets = Liabilities + Equity).

**How to Generate**:
1. Navigate to **Finance > Reports > Balance Sheet**
2. Select:
   - **As of Date**: 2026-03-31
   - **Comparative**: Yes (show prior period)
3. Click **Generate**

**Report Shows**:
- **Assets**: What you own (Cash, AR, Fixed Assets)
- **Liabilities**: What you owe (AP, Loans)
- **Equity**: Owner's stake (Capital + Retained Earnings)

**Example**:
```
ASSETS:
Current Assets:
  Cash:                 $120,000
  Accounts Receivable:  $80,000
  Total Current:        $200,000

Fixed Assets:
  Fixed Assets:         $500,000
  Less: Accum Depr:     -$50,000
  Total Fixed:          $450,000

TOTAL ASSETS:           $650,000

LIABILITIES:
Current Liabilities:
  Accounts Payable:     $60,000

Long-term Liabilities:
  Loan Payable:         $200,000

TOTAL LIABILITIES:      $260,000

EQUITY:
  Owner's Capital:      $300,000
  Retained Earnings:    $90,000
TOTAL EQUITY:           $390,000

TOTAL LIAB + EQUITY:    $650,000 ✓
```

### Cash Flow Statement

**Purpose**: Show cash inflows and outflows (where cash came from and went).

**How to Generate**:
1. Navigate to **Finance > Reports > Cash Flow**
2. Select:
   - **Period**: Q1 2026
   - **Method**: Indirect (recommended)
3. Click **Generate**

**Report Shows**:
- **Operating Activities**: Cash from business operations
- **Investing Activities**: Cash from asset purchases/sales
- **Financing Activities**: Cash from loans/equity

**Example**:
```
OPERATING ACTIVITIES:
Net Income:                     $115,000
Adjustments:
  Depreciation (add back):      $15,000
  AR Increase (subtract):       -$20,000
  AP Increase (add):            $10,000
Net Cash from Operations:       $120,000

INVESTING ACTIVITIES:
Asset Purchases:                -$100,000
Net Cash from Investing:        -$100,000

FINANCING ACTIVITIES:
Loan Proceeds:                  $50,000
Loan Repayments:                -$10,000
Net Cash from Financing:        $40,000

NET CASH CHANGE:                $60,000
Cash Beginning:                 $60,000
Cash Ending:                    $120,000 ✓
```

---

## Best Practices

### Asset Depreciation

1. **Review Methods**: Choose depreciation method based on asset type
2. **Automate Posting**: Enable automated monthly depreciation
3. **Monthly Review**: Check depreciation schedule accuracy
4. **Asset Register**: Maintain updated asset register for compliance
5. **Disposal Documentation**: Keep records of all asset disposals

### Budget Management

1. **Realistic Budgets**: Base budgets on historical data
2. **Monthly Review**: Review variance monthly, not quarterly
3. **Alert Thresholds**: Set appropriate alert levels (10% default)
4. **Investigate Variances**: Don't ignore small variances
5. **Adjust Budgets**: Revise budgets quarterly if needed

### Bank Reconciliation

1. **Reconcile Monthly**: Don't let statements pile up
2. **Start with Level 1**: Only use higher levels for exceptions
3. **Document Exceptions**: Add notes to manual matches
4. **Bank Fees**: Record bank fees promptly
5. **Outstanding Items**: Track outstanding checks/deposits

### Loan Management

1. **Accurate Data**: Verify interest rate and terms with lender
2. **Record Payments**: Record all payments promptly
3. **Monitor Schedule**: Review amortization schedule quarterly
4. **Early Payoff**: Evaluate early payoff annually
5. **Refinance**: Consider refinancing if rates drop

### Financial Reports

1. **Month-End Close**: Generate reports monthly
2. **Review Accuracy**: Verify trial balance balances
3. **Comparative Analysis**: Always use comparative periods
4. **Trend Analysis**: Track key metrics over time
5. **Documentation**: Keep PDF copies for compliance

---

## Troubleshooting

### Asset Depreciation Issues

**Q: Depreciation schedule shows $0 amounts**
- Check: Salvage value < Acquisition cost
- Check: Useful life > 0 months
- Solution: Edit asset and regenerate schedule

**Q: Cannot post depreciation for closed period**
- Check: Fiscal period status
- Solution: Reopen period or post to next open period

**Q: Journal entry not created after posting**
- Check: GL accounts configured
- Check: User permissions (can create journal entries)
- Solution: Verify account mappings

### Budget Variance Issues

**Q: Actual amounts not updating**
- Solution: Click "Refresh Actuals" manually
- Check: Journal entries are POSTED (not DRAFT)

**Q: Alerts not generating**
- Check: Budget status is APPROVED
- Check: Email notification settings
- Solution: Verify alert threshold settings

### Bank Reconciliation Issues

**Q: Auto-match finding no matches**
- Check: Journal entries exist for the period
- Check: Amounts match (including sign)
- Solution: Try higher match level (2, 3, or 4)

**Q: CSV import failing**
- Check: File format matches template
- Check: Date format (YYYY-MM-DD)
- Check: Amount format (no currency symbols)
- Solution: Download template and match format

### Loan Management Issues

**Q: Monthly payment seems incorrect**
- Check: Interest rate (annual, not monthly)
- Check: Term in months (not years)
- Solution: Recalculate with correct values

**Q: Schedule not generating**
- Check: All required fields filled
- Check: Start date not in past
- Solution: Verify loan data and regenerate

### Financial Reports Issues

**Q: Trial balance not balancing**
- Check: All journal entries are balanced
- Check: No draft entries included
- Solution: Run validation report, fix unbalanced entries

**Q: P&L shows $0 net income**
- Check: Period has posted transactions
- Check: Revenue/expense accounts configured
- Solution: Verify account types (REVENUE vs EXPENSE)

**Q: Balance sheet not balancing**
- Check: Retained earnings calculated
- Check: All account types correct
- Solution: Verify Assets = Liabilities + Equity formula

---

## Getting Help

- **Documentation**: https://docs.tsfsystem.com/finance
- **Support Email**: support@tsfsystem.com
- **Knowledge Base**: https://help.tsfsystem.com
- **Training Videos**: https://learn.tsfsystem.com/finance

---

**Last Updated**: 2026-03-12
**Guide Version**: 3.1.4
**For**: Finance Module Phase 2
