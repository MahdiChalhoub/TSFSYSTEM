# Voucher Auto-Reference System

## Goal
Voucher references (for Transfer, Receipt, Payment) are automatically generated from the Transaction Sequence settings — not manually typed by the user.

## Data Flow

### Where Data is READ
- `TransactionSequence` table (type, prefix, suffix, next_number, padding per organization)

### Where Data is SAVED
- `TransactionSequence.next_number` incremented atomically on each voucher creation
- `Voucher.reference` populated with the generated reference string

### Sequence Types
| Voucher Type | Sequence Key        | Default Prefix |
|-------------|---------------------|----------------|
| TRANSFER    | `VOUCHER_TRANSFER`  | `VOU-`         |
| RECEIPT     | `VOUCHER_RECEIPT`   | `VOU-`         |
| PAYMENT     | `VOUCHER_PAYMENT`   | `VOU-`         |

### Generated Format
`{prefix}{next_number zero-padded}{suffix}`  
Example: `VOU-00001`, `VOU-00002`, etc.

## Variables User Interacts With
- **Amount** (required)
- **Date** (required)
- **Description** (optional)
- **Source Account** (required for Transfer/Payment)
- **Destination Account** (required for Transfer/Receipt)
- **Financial Event** (required for Receipt/Payment)
- **Reference** — NOT user input, auto-generated

## Step-by-Step Workflow
1. User fills out the voucher form (type, amount, date, accounts, etc.)
2. Frontend sends data to `createVoucher` server action (no reference field)
3. Backend `VoucherService.create_voucher()` calls `SequenceService.get_next_number(org, 'VOUCHER_{TYPE}')`
4. `SequenceService` atomically reads `TransactionSequence`, formats the number, increments counter
5. Voucher is created with the generated reference
6. Reference appears in the voucher table on the frontend

## How It Achieves Its Goal
Uses the existing `TransactionSequence` + `SequenceService` infrastructure (same system used by invoices and other documents) to ensure unique, sequential, configurable reference numbers per voucher type per organization.

## Files Modified
- `erp_backend/apps/finance/services.py` — `VoucherService.create_voucher()` now calls `SequenceService`
- `src/app/actions/finance/vouchers.ts` — Removed `reference` from `VoucherInput`
- `src/app/(privileged)/finance/vouchers/page.tsx` — Removed manual reference input field
