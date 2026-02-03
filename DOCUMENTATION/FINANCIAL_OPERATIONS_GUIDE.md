# Financial Operations Guide

## 1. Loan Management
The module handles the full lifecycle of loans given to contacts (Employees, Partners, Customers).

### Lifecycle
1. **Creation (Draft)**:
   - Define Principal, Interest Rate, Term, and Start Date.
   - System calculates the Installment Schedule (`LoanInstallment` records).
   - Status: `DRAFT`.
   
2. **Disbursement (Active)**:
   - Action: **Disburse Funds**.
   - Input: Source Cash Account.
   - Outcome:
     - Loan Status -> `ACTIVE`.
     - Creates `LOAN_DISBURSEMENT` Event.
     - Journal Entry: **Dr** Loan Receivable (Contact Linked Account), **Cr** Cash.

3. **Repayment**:
   - Action: **Process Repayment**.
   - Input: Amount, Receiving Cash Account.
   - Outcome:
     - Applies amount to pending installments (Oldest first).
     - Creates `LOAN_REPAYMENT` Event.
     - Journal Entry: **Dr** Cash, **Cr** Loan Receivable.

## 2. Financial Events
Wrapper for financial transactions that don't fit into standard Sales/Purchase workflows.

### Supported Event Types
| Event Type | Accounting Impact (Dr / Cr) | Description |
|------------|-----------------------------|-------------|
| `PARTNER_CAPITAL_INJECTION` | **Dr** Cash / **Cr** Equity (Capital) | Owner putting money into the business. |
| `PARTNER_WITHDRAWAL` | **Dr** Equity (Draws) / **Cr** Cash | Owner taking money out. |
| `LOAN_DISBURSEMENT` | **Dr** Loan Receivable / **Cr** Cash | Lending money to a contact. |
| `LOAN_REPAYMENT` | **Dr** Cash / **Cr** Loan Receivable | Receiving repayment for a loan. |
| `PARTNER_LOAN` | **Dr** Cash / **Cr** Liability | Borrowing money from a partner. |

## 3. Configuration
For these automation rules to work, the **Posting Rules** must be configured in Settings.

- **Equity**: Capital Account, Draws Account.
- **Sales**: Receivable Account.
- **Purchases**: Payable Account.

The system uses the **Contact's Linked Account** where specific individual tracking is needed (e.g., specific Receivable account for a Partner).
