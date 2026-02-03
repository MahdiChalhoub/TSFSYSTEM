# Financial Reporting Guide

## Overview
This guide explains the standard financial reports available in the VSF ERP system, how they are generated, and how to interpret them.

## 1. Trial Balance
**Purpose**: A comprehensive list of all accounts and their current balances. Used to verify that the total value of Debits equals Credits.

- **Scope**: Can be generated for `OFFICIAL` (Declared) or `INTERNAL` (Management) views.
- **Interpretation**: 
  - **Asset/Expense** accounts typically have positive (Debit) balances.
  - **Liability/Equity/Income** accounts typically have negative (Credit) balances in the backend system, though presentation layers may show them as positive Cr.
- **Verification**: The sum of all balances must appear as **0.00**.

## 2. General Ledger / Account Statement
**Purpose**: A detailed history of every transaction that affected a specific account.

- **Columns**: Date, Description, Reference, Debit, Credit, Running Balance.
- **Drill-down**: Clicking a Reference ID (e.g., `ORD-123`, `JRN-456`) opens the source document.

## 3. Profit & Loss (Income Statement)
**Purpose**: Shows the company's financial performance over a specific period.

**Equation**: 
`Net Income = Revenue - Expenses`

- **Components**:
  - **Revenue**: Sales, Service Income.
  - **COGS**: Cost of Goods Sold (Calculated via AMC at the time of sale).
  - **Gross Profit**: Revenue - COGS.
  - **Expenses**: Operating costs, Salaries, Rent.

## 4. Balance Sheet
**Purpose**: A snapshot of the company's financial position at a specific point in time.

**Equation**: 
`Assets = Liabilities + Equity`

- **Components**:
  - **Assets**: Cash, Bank, Inventory, Accounts Receivable.
  - **Liabilities**: Accounts Payable, VAT Payable, Loans.
  - **Equity**: Capital, Retained Earnings.
  - **Current Earnings**: The Net Income from the P&L (closes into Equity).

## 5. Loan Contracts
**Purpose**: Tracks lending or borrowing agreements with defined repayment schedules.

- **Lifecycle**: Draft -> Active -> (Repayments) -> Completed.
- **Integration**: Disbursing a loan automatically posts a Journal Entry (Dr Receivable / Cr Cash).

## 6. Financial Events
**Purpose**: A high-level wrapper for misc. financial operations like "Partner Withdrawal" or "Capital Injection".

- **Automation**: Creating an event automatically generates the necessary Journal Entries based on the **Smart Posting Rules** configuration.
