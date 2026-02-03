# Financial Settings & Company Types Guide

## Overview
The VSF ERP Financial Module supports multiple operating modes to accommodate different regulatory requirements and business complexities. This configuration controls how the ledger behaves, how taxes are calculated, and how transactions are posted.

## 1. Company Types

| Type | Description | Best For | Technical Implication |
|------|-------------|----------|-----------------------|
| **REGULAR** | Standard TTC-based business. | Retailers, Shops | Costs and Prices handled in TTC (Tax Included). VAT is declared. |
| **MICRO** | Simplified Tax Regime. | Small Businesses | VAT is not declared on each Invoice. Instead, a fixed % of Revenue/Expenses is paid. |
| **REAL** | Professional Accounting. | Corporations | Strict HT (Tax Excluded) basis. VAT is explicitly collected and paid. |
| **MIXED** | Hybrid System (Dual View). | Semi-Formal | Supports "Official" (Declared) and "Internal" (Undeclared) scopes simultaneously. |
| **CUSTOM** | Manual Configuration. | Any | Allows manual toggling of individual flags (Dual View, TTC Mode, etc.). |

## 2. Configuration Definitions

### Base Currency
The primary reporting currency (e.g., USD, EUR). The ledger is always balanced in this currency.

### Works in TTC
- **True**: Users enter prices including Tax. Cost of Goods Sold (COGS) is calculated on TTC basis (useful for non-recoverable VAT).
- **False**: Users enter prices excluding Tax. COGS is HT.

### Dual View
- **Enabled**: Every transaction has a `scope` ('OFFICIAL', 'INTERNAL'). Financial reports can be generated for either scope.
- **Disabled**: All transactions are considered 'OFFICIAL'.

### Tax Rates
- **Sale Tax %**: Default VAT applied to sales.
- **Purchase Tax %**: Default VAT recoverable on purchases.
- **Micro Tax %**: Flat rate for Micro regime.

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
