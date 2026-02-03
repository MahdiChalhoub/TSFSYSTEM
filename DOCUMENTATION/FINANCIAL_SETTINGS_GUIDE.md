# Financial Settings & Company Types Guide

## Overview
The VSF ERP Financial Module supports multiple operating modes to accommodate different regulatory requirements and business complexities. This configuration controls how the ledger behaves, how taxes are calculated, and how transactions are posted.

## 1. Company Types

| Type | Description | Best For | Technical Implication |
|------|-------------|----------|-----------------------|
| **REGULAR** | TTC-based. VAT is **Non-recoverable**. | Retailers, Shops | • **Sales**: Always in TTC. VAT is NOT declared on sales.<br>• **Purchases**: Cost Basis is always **TTC**. If invoice is HT, system adds VAT to calculate Effective Cost.<br>• **Purchases Tax (e.g. AIRSI)**: Configurable tax (default 5%) on official purchases. User decides if it helps increase Stock Cost or is expensed. |
| **MICRO** | Simplified Regime. Revenue Tax. | Small Businesses | • **Sales**: VAT is not declared. Pay fixed % of **Turnover** to gov.<br>• **Purchases**: VAT is **Non-recoverable**. Cost Basis is **TTC**.<br>• **Purchases Tax**: Same as Regular (AIRSI support). |
| **REAL** | Professional Accounting. | Corporations | • **Basis**: Strict **HT** (Tax Excluded). VAT is collected/paid.<br>• **Effective Cost**: <br>   - If VAT Recoverable: Cost = HT.<br>   - If VAT Non-Recoverable: Cost = TTC (HT + VAT). |
| **MIXED** | Hybrid System (Dual View). | Semi-Formal | • **Scope**: Splits transactions into 'OFFICIAL' and 'INTERNAL'.<br>• **Costing**: Ask user preference. Typically matches "REAL" logic (HT base, but adapts if VAT is non-recoverable). |
| **CUSTOM** | Manual Configuration. | Any | Allows manual toggling of individual flags. |

## 2. Configuration Definitions

### Base Currency
The main software currency (e.g., LBP, USD). The ledger is always balanced in this currency to ensure system consistency.

### Works in TTC
- **True**: Prices include Tax. Essential for REGULAR/MICRO where VAT is a cost, not a liability.
- **False**: Prices exclude Tax. Standard for REAL companies.

### Dual View
- **Enabled**: Adds `scope` to ledger.
- **Switching**: Can be enabled **anytime** (even mid-year) via SaaS Panel authority. It does not alter historical Cost Data, only visibility layers.

### Special Purchase Tax (e.g., AIRSI)
Applies to **Official** purchases in REGULAR/MICRO modes.
- **Name**: Configurable (e.g., "AIRSI").
- **Rate**: Configurable (e.g., 5%).
- **Behavior**: User setting `Include Special Tax in Cost?`
  - **Yes**: Increases Inventory Value (AMC).
  - **No**: Booked immediately as an Expense.

## 3. Effective Cost Logic
The system calculates the **Stock Valuation Price** automatically:
- **Case A (VAT Recoverable)**: Cost = Invoice HT.
- **Case B (VAT Non-Recoverable)**: Cost = Invoice TTC.
- **Case C (Special Tax Included)**: Cost = Case A/B + Special Tax Amount.

## 3. Smart Posting Rules (Auto-Mapping)
The system automatically routes financial events to specific ledger accounts.

| Operation | Default Account | Customizable? |
|-----------|-----------------|---------------|
| **Sales** | 4100 - Sales Revenue | Yes |
| **Receivables** | 1110 - Accounts Receivable | Yes |
| **Purchases** | 5000 - Expenses / COGS | Yes |
| **Payables** | 2101 - Accounts Payable | Yes |
| **Inventory** | 1120 - Inventory Asset | Yes |
| **VAT** | 2111 - VAT Payable | Yes |

## 4. Changing Settings
1. Go to **Admin > Finance > Settings**.
2. Select **Company Type**.
3. Adjust Tax Rates.
4. Click **Save Configuration**.
*Note: Changing "Works in TTC" or "Dual View" after transactions exist may require a Ledger Recalculation.*
