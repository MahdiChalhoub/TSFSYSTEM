# Vouchers Page — Full CRUD Documentation

## Goal
The Vouchers page provides full lifecycle management for financial vouchers (Transfer, Receipt, Payment) — create, edit, post to ledger, cancel, and delete.

## Data Flow

### Where Data is READ
- `GET /api/vouchers/` — list all vouchers, supports `?type=` and `?status=` filters
- `GET /api/financial-accounts/` — dropdown options for source/destination accounts
- `GET /api/financial-events/` — dropdown options for financial events

### Where Data is SAVED
- `POST /api/vouchers/` — create new voucher (reference auto-generated from `TransactionSequence`)
- `PATCH /api/vouchers/:id/` — update DRAFT voucher (amount, date, description, accounts, event)
- `POST /api/vouchers/:id/post_voucher/` — post DRAFT voucher to ledger (creates journal entries)
- `POST /api/vouchers/:id/cancel_voucher/` — cancel a DRAFT voucher
- `DELETE /api/vouchers/:id/` — permanently delete a DRAFT voucher

## Variables User Interacts With
| Field | Required | Notes |
|-------|----------|-------|
| Voucher Type | Yes (create only) | TRANSFER, RECEIPT, PAYMENT — locked after creation |
| Amount | Yes | Decimal, min 0.01 |
| Date | Yes | Date picker |
| Description | No | Free text |
| Source Account | Yes for Transfer/Payment | Dropdown from FinancialAccounts |
| Destination Account | Yes for Transfer/Receipt | Dropdown from FinancialAccounts |
| Financial Event | Optional for Receipt/Payment | Dropdown from FinancialEvents |
| Reference | Auto-generated | Via TransactionSequence (VOUCHER_TRANSFER/RECEIPT/PAYMENT) |

## Business Rules
1. Only **DRAFT** vouchers can be edited, cancelled, or deleted
2. **POSTED** vouchers are immutable (display "Posted" label)
3. **CANCELLED** vouchers display "Cancelled" and cannot be modified
4. Reference is auto-generated on creation and cannot be changed
5. Voucher type is set on creation and locked for edits

## Step-by-Step Workflow

### Create Voucher
1. Click "+ New Voucher" button
2. Select type (Transfer/Receipt/Payment) via type selector
3. Fill in amount, date, description
4. Select required accounts and/or financial event
5. Click "Create Voucher" → backend auto-generates reference

### Edit Draft Voucher
1. Hover over a DRAFT voucher row → Edit (pencil) icon appears
2. Click Edit → dialog opens with current values pre-filled
3. Type is shown as locked badge (cannot change)
4. Modify fields → Click "Save Changes"

### Post Voucher
1. Click "Post" button on a DRAFT voucher row
2. Backend creates journal entries and marks status as POSTED
3. Voucher becomes immutable

### Cancel Voucher
1. Hover over a DRAFT row → Cancel (X) icon appears
2. Click Cancel → voucher status changes to CANCELLED

### Delete Voucher
1. Hover over a DRAFT row → Trash icon appears
2. Click Delete → confirmation dialog appears
3. Confirm → voucher is permanently deleted

## UI Features
- **Loading skeleton** while data fetches
- **Type tabs** (All/Transfers/Receipts/Payments) with icons
- **Search** by reference or description
- **Column sorting** (date, type, reference, amount, status) with asc/desc indicators
- **Group hover** reveals edit/cancel/delete actions on draft rows
- **Table footer** shows filtered count and total amount
- **Toast notifications** for all operations
- **Confirmation dialog** for destructive delete action

## Files
- Backend ViewSet: `erp_backend/apps/finance/views.py` → `VoucherViewSet`
- Backend Service: `erp_backend/apps/finance/services.py` → `VoucherService`
- Server Actions: `src/app/actions/finance/vouchers.ts`
- Frontend Page: `src/app/(privileged)/finance/vouchers/page.tsx`
