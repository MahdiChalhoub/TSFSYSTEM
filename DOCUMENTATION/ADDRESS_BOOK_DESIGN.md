# Address Book — Cashier Daily Ledger ("Livre de Caisse")

## Philosophy
> Keep the business running even when no trusted manager is present.
> Cashiers can pay and receive money freely. Everything is tracked.
> Owner/authorized persons audit and approve daily for full control.

---

## 1. Entry Types (Comprehensive)

Every entry has a **type** that determines how it's processed after approval:

| Type | Direction | Description | Auto-Link Target |
|------|-----------|-------------|------------------|
| `SUPPLIER_PAYMENT` | OUT (Sortie) | Payment to a supplier | Supplier → Invoice (AP) |
| `EXPENSE` | OUT (Sortie) | Business expense | Expense Account by category |
| `PARTNER_CONTRIBUTION` | IN (Entrée) | Money injected by owner/partner | Partner Capital / Owner Equity |
| `PARTNER_WITHDRAWAL` | OUT (Sortie) | Owner/partner takes cash out | Partner Drawings |
| `CLIENT_PAYMENT` | IN (Entrée) | Client pays for an invoice | Client → Invoice (AR) |
| `CLIENT_PREPAYMENT` | IN (Entrée) | Client pays before invoice exists | Client Advance (reconcile later) |
| `SALE_DEPOSIT` | IN (Entrée) | Cash from POS sales | Sales Revenue |
| `SALES_RETURN` | OUT (Sortie) | Refund to client for returned goods | Sales Return account → linked to original order |
| `CASH_OVERAGE` | IN (Entrée) | Register count shows extra (+) | Écart de Caisse Account (auto-hide) |
| `CASH_SHORTAGE` | OUT (Sortie) | Register count shows deficit (-) | Écart de Caisse Account (needs explanation) |
| `MONEY_TRANSFER` | IN/OUT | Transfer between registers/safe | Inter-Account Transfer |
| `OTHER_IN` | IN (Entrée) | Any other money received | Pending Classification |
| `OTHER_OUT` | OUT (Sortie) | Any other money paid out | Pending Classification |

### Special Rules:
- **CASH_OVERAGE**: Auto-approved, auto-hidden from cashier, posted directly to "Écart de Caisse" account. Manager sees it in audit view only.
- **CASH_SHORTAGE**: Requires explanation. Stays visible until resolved.
- **CLIENT_PREPAYMENT**: Can be reassigned to an invoice later for reconciliation.
- **SUPPLIER_PAYMENT**: Can be entered before or after the invoice. Link when available.
- **SALES_RETURN**: Special split behavior (see below).

### SALES_RETURN — Split Behavior:

> **Stock** → affected immediately (products return to inventory)
> **Money** → NOT refunded until manager approves in Address Book

**Flow:**
1. Cashier creates return in POS (selects original order, items to return)
2. Stock is updated immediately — returned products go back to inventory (client is standing there, can't wait)
3. An Address Book entry is auto-created: type = `SALES_RETURN`, amount = refund amount, linked to original order
4. **Cash stays in the register** — cashier does NOT give money back yet
5. Cashier tells client: "Your refund is being processed, you'll receive it shortly"
6. Manager reviews the return in Address Book:
   - **Approve** → system releases the refund (cashier can then give money, or it's posted to client balance)
   - **Reject** → stock reversal is cancelled, entry stays as credit on cashier
   - **Need Info** → manager asks for reason/photos/details before deciding

**Benefits:**
- Manager sees ALL returns during the day in one place
- Prevents fake returns (cashier creates return, pockets the cash)
- Stock is handled immediately (operational necessity)
- Money is controlled (financial security)

---

## 2. Entry Fields

```
AddressBookEntry {
  id: auto
  register_id: FK → POSRegister (which register/cashier)
  created_by: FK → User (who entered it — ALWAYS tracked)
  created_at: datetime
  
  # Classification
  entry_type: enum (see table above)
  direction: 'IN' | 'OUT' (auto-derived from type)
  amount: decimal
  description: string (freeform note)
  
  # Linking (optional, depends on type)
  supplier_id: FK → Contact (nullable)
  supplier_invoice_id: FK → Invoice (nullable)
  client_id: FK → Contact (nullable)
  client_invoice_id: FK → Invoice (nullable)
  expense_category: string (nullable)
  partner_id: FK → User/Contact (nullable)
  account_id: FK → COA Account (nullable, for direct posting)
  
  # Workflow
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEED_INFO' | 'MODIFIED'
  reviewed_by: FK → User (nullable — who approved/rejected)
  reviewed_at: datetime (nullable)
  reviewer_comment: string (nullable — reason for rejection / info request)
  cashier_response: string (nullable — explanation after rejection)
  
  # Audit
  daily_snapshot_id: FK → DailySnapshot
  original_entry_id: FK → self (nullable, for modifications tracking)
}
```

---

## 3. Approval Workflow

```
                    ┌─────────────┐
                    │   PENDING   │ ← Created by cashier
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌───────────┐ ┌──────────┐
     │  APPROVED  │ │ NEED_INFO │ │ REJECTED │
     └─────┬──────┘ └─────┬─────┘ └─────┬────┘
           │              │             │
           ▼              ▼             ▼
    Auto-hide from    Cashier sees    Returns as credit
    active view.      badge "Info     on cashier. Cashier
    Auto-post to      Requested".    must fix or explain.
    correct ledger    Can respond     │
    account.          with details.   ▼
                           │     ┌──────────┐
                           └────▶│ MODIFIED │
                                 └────┬─────┘
                                      │
                                      ▼
                                 Back to PENDING
                                 (re-submit for review)
```

### State Transitions:

| From | To | Who | Action |
|------|----|-----|--------|
| PENDING | APPROVED | Manager/Owner | Approve — entry is auto-posted & hidden |
| PENDING | REJECTED | Manager/Owner | Reject — returns as credit, needs fix |
| PENDING | NEED_INFO | Manager/Owner | Ask for more details |
| NEED_INFO | MODIFIED | Cashier | Adds explanation/edits, resubmits |
| MODIFIED | PENDING | System | Auto-transitions back for review |
| REJECTED | MODIFIED | Cashier | Fixes entry, resubmits |

---

## 4. Security Rules (Same as POS)

### Creating Entries:
- Any cashier on an open register can create entries
- `created_by` is ALWAYS logged automatically

### Deleting Entries:
- **Managers**: Can delete with PIN confirmation
- **Cashiers**: Cannot delete. Must send delete request to manager
- **Delete Request**: Creates a notification/task for manager approval
- Deleted entries are soft-deleted (kept for audit trail)

### Modifying Entries:
- **PENDING entries**: Cashier who created it can modify
- **APPROVED entries**: Cannot be modified (immutable)
- **REJECTED entries**: Only the original cashier can modify and resubmit
- All modifications create a version trail (original_entry_id)

### Viewing:
- **Cashiers**: See their own entries + active (non-approved) entries
- **Managers/Owners**: See ALL entries, can filter by status, date, cashier

---

## 5. Reconciliation Features

### Pre-Payment → Invoice Linking:
1. Cashier enters `CLIENT_PREPAYMENT` with client name + amount
2. Later, when invoice is created, system suggests unlinked prepayments for that client
3. Manager or cashier can link prepayment to invoice
4. Balance adjusts automatically

### Supplier Payment → Invoice Linking:
1. Cashier enters `SUPPLIER_PAYMENT` with supplier + amount
2. If invoice exists: link immediately
3. If invoice doesn't exist yet: mark as "unlinked", link later
4. System shows unlinked supplier payments in a reconciliation view

---

## 6. Écart de Caisse (Register Variance)

### When register is counted:
- **Expected** = System total (all sales - all payouts)
- **Actual** = Physical count by cashier
- **Variance** = Actual - Expected

### If variance > 0 (overage):

> ⚠️ **CRITICAL SECURITY RULE: Cashier must NEVER see or know about an overage.**
>
> **Why?** If a cashier sees "+500 CFA extra", human nature kicks in:
> - They may feel the money "belongs to them" and ask why it's being taken
> - They may secretly withdraw money from the register to cancel the surplus (THEFT)
> - Even if honest, showing the overage creates unnecessary confusion
>
> **Root causes** of overage (all investigated privately by manager):
> - Client accidentally overpaid
> - Cashier miscounted earlier (gave wrong change)
> - A refund was processed but cash wasn't returned
> - Counting error during close

1. Auto-create `CASH_OVERAGE` entry — **visible ONLY to manager/owner**
2. Status = `APPROVED` (auto, immediate)
3. **Completely hidden** from cashier — their screen shows "Register closed successfully"
4. Auto-posted to "Écart de Caisse" account (debit cash, credit écart)
5. In manager's Address Book view: shows `Entrée = Sortie` as indication only
6. Manager can investigate privately (was it client overpayment? error? missing refund?)

### If variance < 0 (shortage):
1. Auto-create `CASH_SHORTAGE` entry
2. Status = `PENDING` (requires explanation)
3. Visible to cashier — they must acknowledge and explain
4. Cashier must provide explanation before register can fully close
5. Manager reviews and can:
   - Approve (write off the shortage — posted to Écart de Caisse)
   - Reject (shortage amount becomes a debt on the cashier until resolved)

---

## 7. Daily Snapshot ("Copie du Livre de Caisse")

### At end of each day (or on register close):
```
DailySnapshot {
  id: auto
  date: date
  register_id: FK → POSRegister
  cashier_id: FK → User
  
  # Totals
  total_in: decimal
  total_out: decimal
  balance: decimal
  
  # Counts by status
  pending_count: int
  approved_count: int
  rejected_count: int
  
  # Immutable copy
  entries_json: JSON (full copy of all entries for this day)
  
  created_at: datetime
}
```

### Rules:
- Snapshot is created automatically when register is closed
- Can also be triggered manually by manager
- Snapshot is **immutable** — serves as legal/audit trail
- Historical snapshots accessible from manager dashboard

---

## 8. Goal: Balance = 0

The ultimate goal is to process all entries so the Address Book balance reaches 0:

```
Balance = Σ(IN entries not yet approved) - Σ(OUT entries not yet approved)

When all entries are approved/linked/posted:
  → Balance = 0
  → All money is accounted for in the ledger
```

Manager's daily task: Review pending entries → Approve/Reject → until balance = 0.

---

## 9. UI Flow (POS Address Book Modal)

### Cashier View:
1. **Header**: IN total | OUT total | BALANCE | PENDING count
2. **Entry List**: Active (non-approved) entries with status badges
3. **New Entry Button**: Opens form with type selector
4. **Entry Form**:
   - Type dropdown (Supplier Payment, Expense, etc.)
   - Amount input
   - Dynamic fields based on type (supplier selector, invoice selector, etc.)
   - Description/notes
   - Submit → status = PENDING

### Manager View (separate page or expanded modal):
1. **All entries** across all registers/cashiers
2. **Filter by**: Date, Status, Cashier, Type
3. **Bulk approve** for routine entries
4. **Individual review** with approve/reject/need-info buttons
5. **Daily snapshot** download/view
6. **Reconciliation panel**: unlinked payments

---

## 10. Implementation Phases

### Phase 1: Core CRUD + Types (Backend + Frontend)
- AddressBookEntry model with all entry types
- Create/Read/Update API
- POS modal with type-aware entry form
- Basic list view with status badges

### Phase 2: Approval Workflow
- Manager approval/rejection/need-info flow
- PIN-protected delete for managers
- Delete request flow for cashiers
- Status transitions and notifications

### Phase 3: Auto-Linking + Reconciliation
- Auto-post approved entries to correct ledger accounts
- Supplier/Client/Invoice selectors in entry form
- Reconciliation view for unlinked payments
- Prepayment → Invoice linking

### Phase 4: Register Variance (Écart de Caisse)
- Integration with register close flow
- Auto-creation of overage/shortage entries
- Auto-approval for overages

### Phase 5: Daily Snapshots + Audit
- Auto-snapshot on register close
- Manager dashboard for historical review
- Export/print daily snapshots
- Audit trail for all modifications
