# Financial Settings & Company Types Guide

## Overview
The VSF ERP Financial Module supports multiple operating modes to accommodate different regulatory requirements and business complexities. This configuration controls how the ledger behaves, how taxes are calculated, and how transactions are posted.

## 1. Company Types (Tax & Costing Regimes)

| Type | VAT Regime | Sales Logic | Purchase Cost Basis | AIRSI / Special Tax |
|------|------------|-------------|---------------------|---------------------|
| **REGULAR** | **Non-Recoverable** | **TTC Only**. VAT is NOT declared. | **Always TTC**. System adds VAT to HT invoices. | Capitalize to Stock OR Expense. |
| **MICRO** | **Rev. Tax** | **No VAT**. Pay % of Turnover. | **Always TTC**. | Expense (usually). |
| **REAL** | **Recoverable** | **Declared**. VAT Collected/Paid. | **HT** (if recoverable) OR **TTC** (if non-recoverable). | Recoverable Asset (typically). |
| **MIXED** | **Hybrid** | **Declared**. VAT Collected/Paid. | **Internal**: TTC (Real Cash). <br> **Declared**: HT (Virtual Reclass). | **Internal**: Cost. <br> **Declared**: Recoverable. |

## 2. Customer Types & Sales Logic
Customer type determines the **Pricing Mode**, while the Company Type determines the **Declaration Mode**.

| Customer Type | Target Audience | Pricing Mode | VAT Handling | Accounting Implication |
|---------------|-----------------|--------------|--------------|------------------------|
| **B2B** | Business | **HT Basis** | **Explicit**. Added on top of HT. | `Dr AR (TTC)`, `Cr Sales (HT)`, `Cr VAT (Liab)` |
| **B2C** | Consumer | **TTC Basis** | **Included**. Extracted from TTC. | `Dr Cash (TTC)`, `Cr Sales (HT)`, `Cr VAT (Liab)` |
| **B2F** | Foreign | **HT Basis** | **Zero Rated**. (Export). | No VAT Liability. |
| **B2G** | Government | **HT Basis** | **Explicit**. (Withholding rules). | Special Settlement rules. |

> **Crucial Rule**: Even in **MIXED** mode, Sales are legally compliant. The "Mixed" aspect primarily affects the **Purchase/Cost** view (Internal TTC vs Declared HT). Sales are always declared fully for Real/Mixed companies.

## 3. AIRSI (Income Tax Withholding) Treatment
AIRSI is an **Event-Based Tax**, separate from VAT.

| Mode | Accounting Entry | Best For |
|------|------------------|----------|
| **Recoverable** | `Dr Asset (Recoverable)`, `Cr Payable` | **REAL** (standard). |
| **Capitalized** | `Dr Inventory (inc. AIRSI)`, `Cr Payable` | **REGULAR** (increases stock value). |
| **Expensed** | `Dr Expense (AIRSI)`, `Cr Payable` | **MICRO** (simple reduction of profit). |

**Configuration**: AIRSI can be enabled per **Supplier**, **Product**, or globally by **Company Type**.

## 4. Configuration Definitions

### Base Currency
The main software currency (e.g., CFA, EUR, USD). The ledger is always balanced in this currency.

### Works in TTC
- **True**: Prices include Tax. Essential for REGULAR/MICRO.
- **False**: Prices exclude Tax. Standard for REAL.

### Dual View (Restricted Access)
- **Enabled**: Adds `scope` to ledger.
- **Legacy/Real View**: strict compliance.
- **Mixed Mode Implementation**:
  - **Internal Reality**: Purchases are costed TTC. VAT is treated as expense (cost).
  - **Declared Reporting**: Virtual Reclassification (Cost=HT, VAT=Recoverable).

### Special Purchase Tax (e.g., AIRSI)
Applies to **Official** purchases in REGULAR/MICRO modes.
- **Name**: Configurable (e.g., "AIRSI").
- **Rate**: Configurable (e.g., 5%).
- **Behavior**: User setting `Include Special Tax in Cost?`
  - **Yes**: Increases Inventory Value (AMC).
  - **No**: Booked immediately as an Expense.

## 5. Effective Cost Logic
The system calculates the **Stock Valuation Price** automatically:
- **Case A (VAT Recoverable)**: Cost = Invoice HT.
- **Case B (VAT Non-Recoverable)**: Cost = Invoice TTC.
- **Case C (Special Tax Included)**: Cost = Case A/B + Special Tax Amount.

## 6. Smart Posting Rules (Auto-Mapping)
The system automatically routes financial events to specific ledger accounts.

| Operation | Default Account | Customizable? |
|-----------|-----------------|---------------|
| **Sales** | 4100 - Sales Revenue | Yes |
| **Receivables** | 1110 - Accounts Receivable | Yes |
| **Purchases** | 5000 - Expenses / COGS | Yes |
| **Payables** | 2101 - Accounts Payable | Yes |
| **Inventory** | 1120 - Inventory Asset | Yes |
| **VAT** | 2111 - VAT Payable | Yes |

## 7. Changing Settings
1. Go to **Admin > Finance > Settings**.
2. Select **Company Type**.
3. Adjust Tax Rates.
4. Click **Save Configuration**.
*Note: Changing "Works in TTC" or "Dual View" after transactions exist may require a Ledger Recalculation.*
