# General Ledger Transactions (Journal Entries) Page Documentation

## Goal of the page
Record and manage journal entries (manual or automated) to maintain the accounting ledger.

## From where data is READ
- Data is read from `JournalEntryViewSet` in Django via `getJournalEntries`.

## Where data is SAVED
- Data is saved to `JournalEntry` and `JournalEntryLine` models in Django.

## Variables user interacts with
- `transactionDate`: Date of the record.
- `description`: Narrative of the entry.
- `lines`: Double-entry lines (Account, Debit, Credit).
- `status`: ('DRAFT', 'POSTED', 'CANCELLED', 'REVERSED').

## Step-by-step workflow
1. User creates a new entry.
2. User adds lines ensuring Total Debit = Total Credit.
3. User saves as DRAFT (no balance impact).
4. User POSTS the entry.
5. Django `LedgerService` validates balance and updates `ChartOfAccount` balances atomically.

## How the page achieves its goal
Enables precise double-entry bookkeeping with automatic balance updates and validation, ensuring the integrity of the financial records.
