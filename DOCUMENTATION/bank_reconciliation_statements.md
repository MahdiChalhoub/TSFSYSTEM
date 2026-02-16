# Bank Reconciliation & Account Statements

## Bank Reconciliation

### Goal
Review and reconcile bank/cash account entries by comparing book balance to bank statement.

### Page: `/finance/bank-reconciliation`

#### Data READ
- `GET /finance/journal/bank-reconciliation/` — list bank/cash COA accounts
- `GET /finance/journal/bank-reconciliation/?account_id=X&start_date=&end_date=` — entries detail

#### Data SAVED
- No writes (read-only review tool)

#### Variables
- **selectedAccountId**: drilled-in account
- **startDate/endDate**: date range filter
- **search**: search entries by reference/description

#### Workflow
1. Shows all bank/cash COA accounts as cards with book balance
2. Click card to drill into journal entry lines
3. Detail view shows: Summary cards (Debits, Credits, Balance, Entry Count)
4. Date range filter + search
5. Table with running balance per entry

#### How It Works
- Identifies bank/cash accounts via: type=ASSET with sub_type containing bank/cash, OR syscohada_class=5
- Aggregates JournalEntryLine debits/credits for each account
- Running balance computed as cumulative debit - credit

---

## Account Statements

### Goal
View customer/supplier financial statements — orders, payments, journal entries, and outstanding balance.

### Page: `/finance/statements`

#### Data READ
- `GET /crm/contacts/` — contact list
- `GET /crm/contacts/{id}/summary/` — contact financial summary

#### Data SAVED
- No writes (read-only)

#### Variables
- **selectedContact**: contact being viewed
- **activeTab**: orders | payments | journal
- **search**: filter contacts by name/phone/email

#### Workflow
1. Shows searchable contact list
2. Click "Statement" to drill into financial summary
3. Summary cards show: Orders, Revenue, Paid, Balance
4. 3-tab view: Orders, Payments, Journal Entries
5. Each tab shows relevant transactions

## Files
- `erp_backend/apps/finance/views.py` — `JournalEntryViewSet.bank_reconciliation`
- `erp_backend/apps/crm/views.py` — `ContactViewSet.detail_summary`
- `src/app/actions/finance/bank-reconciliation.ts` — Server actions
- `src/app/(privileged)/finance/bank-reconciliation/page.tsx` — Reconciliation page
- `src/app/(privileged)/finance/statements/page.tsx` — Statements page
