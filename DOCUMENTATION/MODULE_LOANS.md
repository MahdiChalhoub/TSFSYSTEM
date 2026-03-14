# Loans & Financial Events Module Documentation

## Overview
The Loans module handles the creation, scheduling, and disbursement of loans (Lending/Borrowing). It is fully integrated with the General Ledger via Financial Events.

---

## Database Schema (Django Models)

### 1. Loan
**Purpose**: Represents a loan contract between the Organization and a Contact.
**Columns**:
- `contract_number`: Unique ID (e.g., LN-001)
- `contact`: ForeignKey to Contact
- `principal_amount`: Decimal
- `interest_rate`: Decimal (Annual %)
- `interest_type`: SIMPLE / COMPOUND / NONE
- `term_months`: Integer
- `start_date`: Date
- `payment_frequency`: MONTHLY / QUARTERLY / YEARLY
- `status`: DRAFT / ACTIVE / COMPLETED / DEFAULTED
**Relationships**: 
- `has_many` Installments
- `has_many` FinancialEvents
**Readers**: `LoanViewSet`, `LoanService`
**Writers**: `LoanService.create_contract`, `LoanService.disburse_loan`

### 2. LoanInstallment
**Purpose**: Represents a scheduled payment for a loan.
**Columns**:
- `loan`: ForeignKey to Loan
- `due_date`: Date
- `principal_amount`, `interest_amount`, `total_amount`: Decimals
- `status`: PENDING / PAID / PARTIAL / OVERDUE
- `paid_amount`: Decimal
**Relationships**: Belongs to Loan
**Readers**: `LoanViewSet`
**Writers**: `LoanService.create_contract`

### 3. FinancialEvent
**Purpose**: Represents a high-level financial occurrence (Capital Injection, Loan, Disbursement) that triggers accounting transactions.
**Columns**:
- `event_type`: LOAN_DISBURSEMENT, PARTNER_LOAN, etc.
- `amount`, `date`
- `contact`: ForeignKey
- `loan`: Optional ForeignKey to Loan
- `transaction`: Link to Ledger Transaction
- `journal_entry`: Link to Journal Entry
- `status`: DRAFT / SETTLED
**Readers**: `FinancialEventViewSet`
**Writers**: `FinancialEventService`, `LoanService`

---

## Pages & API

### Page: Loans Management (`/admin/finance/loans`)
**Goal**: List existing loans and create new ones.
**Data READ**: `GET /api/loans/` (Django)
**Data SAVED**: `POST /api/loans/contract/` (Django)
**Variables**: Principal, Rate, Term, Contact, Frequency
**Workflow**:
1. User clicks "New Loan".
2. Fills details (Contact, Amount, Terms).
3. Submits -> Backend creates `Loan` (DRAFT) + `LoanInstallment` (Schedule).

### Page: Loan Details (`/admin/finance/loans/[id]`)
**Goal**: View schedule and disburse loan.
**Data READ**: `GET /api/loans/[id]/`
**Data SAVED**: `POST /api/loans/[id]/disburse/`
**Workflow**:
1. User views DRAFT loan.
2. User clicks "Disburse".
3. Selects "Paying Account" (e.g., Cash / Bank).
4. Submits -> Backend creates `FinancialEvent` + `Transaction` + `JournalEntry`, updates Loan to ACTIVE.

### Page: Financial Events (`/admin/finance/events`)
**Goal**: Track capital injections and partner transactions.
**Data READ**: `GET /api/financial-events/`
**Data SAVED**: `POST /api/financial-events/create_event/`
**Workflow**:
1. User creates event (e.g., Capital Injection).
2. Backend creates DRAFT event.
3. User posts event (if not immediate) -> Backend creates Ledger entries.

---

## Workflows

### Workflow: Loan Disbursement
**Goal**: Activate a loan and record the money outflow in accounting.
**Actors**: Finance Manager, System
**Steps**:
1. Manager initiates Disbursement on Loan Page.
2. Manager selects Source Account (Cash).
3. System calls `LoanService.disburse_loan`.
4. System creates `FinancialEvent` (Type: LOAN_DISBURSEMENT).
5. System posts Event:
    - Creates `Transaction` (Credit Cash).
    - Creates `JournalEntry` (Dr Loan Receivable, Cr Cash).
6. System updates Loan Status to ACTIVE.
**Data Movement**: Frontend -> Django API -> Postgres
**Tables Affected**: `Loan`, `FinancialEvent`, `Transaction`, `JournalEntry`, `ChartOfAccount` (Balances).
