# Vouchers Page Documentation

## Goal
Manage financial vouchers (Transfers, Receipts, Payments) with a full lifecycle verification pipeline: OPEN → LOCKED → VERIFIED → CONFIRMED → Posted.

## Data Flow

### READ
- `GET /api/finance/vouchers/` — all vouchers with lifecycle_status
- `GET /api/finance/financial-accounts/` — account list for dropdowns
- `GET /api/finance/financial-events/` — event list for receipt/payment vouchers
- `GET /api/finance/vouchers/{id}/lifecycle_history/` — audit trail

### WRITE
- `POST /api/finance/vouchers/` — create voucher (starts OPEN)
- `PATCH /api/finance/vouchers/{id}/` — update (only OPEN)
- `DELETE /api/finance/vouchers/{id}/` — delete (only OPEN)
- `POST /api/finance/vouchers/{id}/lock/` — OPEN → LOCKED
- `POST /api/finance/vouchers/{id}/unlock/` — LOCKED → OPEN (requires comment)
- `POST /api/finance/vouchers/{id}/verify/` — LOCKED → VERIFIED
- `POST /api/finance/vouchers/{id}/post_voucher/` — CONFIRMED → Posted (creates journal entry)

## Variables User Interacts With
- **voucher_type**: TRANSFER, RECEIPT, or PAYMENT
- **amount**: Decimal (required)
- **date**: Date (required)
- **description**: Text (optional)
- **source_account_id**: FK to FinancialAccount (required for TRANSFER/PAYMENT)
- **destination_account_id**: FK to FinancialAccount (required for TRANSFER/RECEIPT)
- **financial_event_id**: FK to FinancialEvent (required for RECEIPT/PAYMENT)

## Lifecycle Workflow
1. **OPEN** — Voucher is editable. User can edit, delete, or lock.
2. **LOCKED** — Voucher is frozen. User can unlock (with comment) or verify.
3. **VERIFIED** — Voucher has been verified. Awaiting confirmation.
4. **CONFIRMED** — Voucher is confirmed. User can post to ledger.
5. **Posted** — `is_posted=true`. Creates journal entry. Irreversible.

## Backend Model
- `Voucher` extends `VerifiableModel` (gains lifecycle_status, locked_by, locked_at, current_verification_level)
- `VoucherViewSet` uses `LifecycleViewSetMixin` for lock/unlock/verify/unverify actions
- `lifecycle_transaction_type = 'VOUCHER'`

## Frontend Page
- Summary cards: Total, Open, Locked, Posted
- Tabs filter by voucher type (All, Transfers, Receipts, Payments)
- Sortable columns: Date, Type, Reference, Amount, Status
- Lifecycle action buttons per row based on current status
- History dialog shows full audit trail
- Unlock dialog requires comment
