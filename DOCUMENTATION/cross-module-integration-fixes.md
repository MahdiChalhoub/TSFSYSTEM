# Cross-Module Integration Fixes

## Overview
This document covers the integration gap fixes applied after the cross-module audit identified 14 disconnections between backend APIs and frontend pages.

## Backend Signal Handlers

### Finance Signals (`apps/finance/signals.py`)

**Goal**: Wire automatic financial lifecycle events between Payment, Invoice, and GL.

**Signals Added**:
1. **PaymentAllocation → Invoice Auto-Status**: When a `PaymentAllocation` is created, it calls `invoice.record_payment()` to update `paid_amount` and auto-transition status (PARTIAL_PAID → PAID). Also updates `CustomerBalance` for AR tracking.
2. **Invoice → JournalEntry Auto-Posting**: When an Invoice `status` transitions to `SENT`, auto-creates a `JournalEntry` with Debit AR / Credit Revenue lines and links back to the invoice.

**Data Flow**:
- PaymentAllocation saved → `finance.PaymentAllocation` → `Invoice.record_payment()` → status update + `CustomerBalance` update
- Invoice saved (status=SENT) → `finance.Invoice` → `JournalEntry` + `JournalEntryLine` created → `CustomerBalance` AR increase

### POS Signals (`apps/pos/signals.py`)

**Goal**: Wire order completion to CRM analytics, supplier metrics, and inventory movements.

**Signals Added**:
1. **Order (SALE, COMPLETED) → CRM Analytics**: Updates `Contact.total_orders`, `lifetime_value`, `average_order_value`, `first/last_purchase_date` on sale completion.
2. **PurchaseOrder (RECEIVED) → Inventory Stock Receipt**: Creates `InventoryMovement` records for each received PO line with idempotency checks (skips duplicates).
3. **PurchaseOrder (COMPLETED) → Supplier Metrics**: Updates `Contact.supplier_total_orders`, `total_purchase_amount`, `avg_lead_time_days` and recalculates supplier rating.

**Data Flow**:
- Order COMPLETED (SALE) → `crm.Contact.recalculate_analytics()` → customer stats updated
- PO RECEIVED → `inventory.InventoryMovement.create()` → stock levels updated
- PO COMPLETED → `crm.Contact.recalculate_supplier_rating()` → supplier performance updated

---

## Frontend Server Actions Created

### HR Module (Gap 1)
| File | Backend Endpoint | Operations |
|------|-----------------|------------|
| `actions/hr/departments.ts` | `hr/departments/` | CRUD + tree hierarchy |
| `actions/hr/shifts.ts` | `hr/shifts/` | CRUD |
| `actions/hr/attendance.ts` | `hr/attendance/` | CRUD + check_in/check_out |
| `actions/hr/leaves.ts` | `hr/leaves/` | CRUD + approve/reject |

### POS Module (Gap 4)
| File | Backend Endpoint | Operations |
|------|-----------------|------------|
| `actions/pos/quotations.ts` | `pos/quotations/` | CRUD + convert to order |
| `actions/pos/deliveries.ts` | `pos/deliveries/` + `pos/delivery-zones/` | CRUD both |
| `actions/pos/discounts.ts` | `pos/discount-rules/` | CRUD |
| `actions/pos/consignment.ts` | `pos/consignment-settlements/` | CRUD |
| `actions/pos/sourcing.ts` | `pos/sourcing/` + `pos/supplier-pricing/` | CRUD both |
| `actions/pos/credit-notes.ts` | `pos/credit-notes/` | CRUD |
| `actions/pos/purchase-returns.ts` | `pos/purchase-returns/` | CRUD |

### Inventory Module (Gap 2)
| File | Backend Endpoint | Operations |
|------|-----------------|------------|
| `actions/inventory/warehouse-locations.ts` | `inventory/zones/`, `aisles/`, `racks/`, `shelves/`, `bins/`, `product-locations/` | Full location hierarchy CRUD |

---

## Sidebar Updates

### HR & Teams Section
Added 4 new links:
- Departments → `/hr/departments`
- Shifts → `/hr/shifts`
- Attendance → `/hr/attendance`
- Leave Requests → `/hr/leaves`

---

## Variables Users Interact With

### Backend Signals (Automatic)
- `PaymentAllocation.allocated_amount` → triggers invoice update
- `Invoice.status` → triggers GL posting when set to 'SENT'
- `Order.status` → triggers CRM analytics when set to 'COMPLETED'
- `PurchaseOrder.status` → triggers stock receipt when set to 'RECEIVED'

### Frontend Actions (User-Initiated)
- All CRUD forms for HR, POS, and Inventory location management
- Approval/rejection flows for leaves
- Check-in/check-out for attendance

## Tables Affected
| Table | Read By | Written By |
|-------|---------|------------|
| `invoice` | Finance pages | PaymentAllocation signal, Invoice GL signal |
| `payment_allocation` | Payment pages | Payment form |
| `journal_entry` + `journal_entry_line` | Ledger, reports | Invoice GL signal |
| `customer_balance` | Finance dashboard | PaymentAllocation signal, Invoice GL signal |
| `contact` (CRM analytics) | CRM Insights, Supplier Perf | Order signal, PO signal |
| `inventory_movement` | Inventory movements page | PO receipt signal |
