# TSFSYSTEM Purchases Module — Complete Documentation

> **Generated**: 2026-03-10 | **Version**: V3 (Intelligence Grid Overhaul)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Map](#2-file-map)
3. [Page: `/purchases` — Procurement Center](#3-page-purchases--procurement-center)
4. [Page: `/purchases/new-order` — Enterprise PO Form](#4-page-purchasesnew-order--enterprise-po-form)
5. [Page: `/purchases/purchase-orders` — PO Workspace](#5-page-purchasespurchase-orders--po-workspace)
6. [Backend Architecture](#6-backend-architecture)
7. [Lifecycle State Machine (13 States)](#7-lifecycle-state-machine-13-states)
8. [Server Action Layer](#8-server-action-layer)
9. [Quick Purchase Service (Deep Dive)](#9-quick-purchase-service-deep-dive)
10. [Catalogue Modal (Deep Dive)](#10-catalogue-modal-deep-dive)
11. [Receipt & Discrepancy Workflow (Deep Dive)](#11-receipt--discrepancy-workflow-deep-dive)
12. [Invoice & 3-Way Matching (Deep Dive)](#12-invoice--3-way-matching-deep-dive)
13. [Procurement Request System](#13-procurement-request-system)
14. [Auto-Replenishment Engine](#14-auto-replenishment-engine)
15. [Event System & Workspace Tasks](#15-event-system--workspace-tasks)
16. [Data Flow Diagrams](#16-data-flow-diagrams)

---

## 1. Architecture Overview

The Purchases module has a **dual-engine architecture**:

| Engine | Backend Route | Model | Purpose |
|--------|--------------|-------|---------|
| **Legacy/Quick** | `purchase/` | `Order` (generic POS model) | Fast stock intake, receipt-based, skips formal PO workflow |
| **Formal PO** | `purchase-orders/` | `PurchaseOrder` (dedicated) | Enterprise 13-state lifecycle, approval workflow, invoicing |

### Key Architectural Principles

- **Tenant isolation** via `TenantModel` on all models
- **Posting rules** for dynamic COA resolution (zero hardcoded accounts)
- **Tax Engine integration** via `TaxEngineContext` and `TaxCalculator`
- **Gated cross-module imports** using `_safe_import()` for loose coupling
- **Event-driven workspace tasks** via `trigger_purchasing_event()`
- **V3 Design Language** — Glassmorphism, split-panel UX, responsive mobile cards

---

## 2. File Map

```
BACKEND (erp_backend/apps/pos/)
├── models/
│   ├── purchase_order_models.py          # PurchaseOrder + PurchaseOrderLine (456 lines)
│   ├── purchase_enhancement_models.py    # LandedCost, PurchaseAttachment (114 lines)
│   └── procurement_request_models.py     # ProcurementRequest (104 lines)
├── views/purchase_views.py               # PurchaseViewSet + PurchaseOrderViewSet +
│                                         #   PurchaseOrderLineViewSet +
│                                         #   ProcurementRequestViewSet (608 lines)
├── serializers/purchase_serializers.py    # PO + POLine serializers (104 lines)
└── services/purchase_service.py          # PurchaseService (660 lines)

FRONTEND (src/app/)
├── (privileged)/purchases/
│   ├── page.tsx                          # /purchases — Registry Center (265 lines, SSR)
│   ├── PurchasesRegistryClient.tsx       # TypicalListView table (219 lines, Client)
│   ├── AutoReplenishButton.tsx           # Min/Max auto-replenishment trigger
│   ├── new-order/
│   │   ├── page.tsx                      # SSR wrapper — fetches suppliers, sites, terms, drivers (61 lines)
│   │   └── form.tsx                      # Intelligence Grid form (1078 lines, Client)
│   └── purchase-orders/
│       ├── page.tsx                      # SSR wrapper with metadata (12 lines)
│       └── page-client.tsx              # Split-panel PO workspace (328 lines, Client)
├── actions/
│   ├── purchases/purchase-orders.ts     # Dedicated PO CRUD + lifecycle server actions (170 lines)
│   ├── pos/purchases.ts                 # Unified PO + quotation + consignment actions (129 lines)
│   └── commercial/purchases.ts          # FormData-based: quick purchase + formal PO creation (197 lines)
```

### Backend URL Registration

```python
# erp_backend/apps/pos/urls.py
router.register(r'purchase', PurchaseViewSet, basename='purchase')          # Legacy engine
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-orders')  # Formal PO engine
```

---

## 3. Page: `/purchases` — Procurement Center

**File**: `src/app/(privileged)/purchases/page.tsx` (SSR)

### Purpose
Master registry and dashboard — the landing page providing a bird's-eye view of all purchase activity.

### Data Loading (Parallel)

```typescript
const [advancedOrders, legacyOrders, dashboard, context] = await Promise.all([
    getPurchaseOrders(searchParams),     // GET /purchase-orders/?status=X&query=Y
    getLegacyPurchases(searchParams),    // GET /orders/?type=PURCHASE&status=X&query=Y
    getPODashboard(),                   // GET /purchase-orders/dashboard/
    getCommercialContext(),              // currency, tradeSubTypesEnabled
]);
```

Orders are merged and sorted by `created_at` descending, with legacy orders tagged `is_legacy: true`.

### UI Sections

| Section | Description |
|---------|-------------|
| **Header** | Title "Procurement Center" with icon-box |
| **Quick Nav** | 6 links: Purchase Orders, New Order, Invoices, Receipts, Returns, Sourcing |
| **KPI Row** (5 cards) | Total Orders, Drafts, Pending Approval, Incoming Stock (SENT+PARTIALLY_RECEIVED), Total Value |
| **Order Pipeline** | Horizontal visual: Draft → Pending → Approved → Ordered → In Transit → Received → Complete |
| **Auto Replenish** | Button triggers Min/Max engine |
| **Registry Table** | `PurchasesRegistryClient` — `TypicalListView` with lifecycle badges |

### PurchasesRegistryClient Component

Uses the standardized `TypicalListView` + `TypicalFilter` framework:

- **Columns**: PO Number (with created date), Supplier, Sub-Type (conditional), Priority, Amount, Expected Date
- **Status Badges**: 12-status mapping with variant colors (default/success/warning/danger/info)
- **Priority Display**: LOW (muted), NORMAL (blue), HIGH (amber), URGENT (rose + triangle icon)
- **Sub-Type Tags**: STANDARD (gray), WHOLESALE (amber), CONSIGNEE (emerald) — conditionally shown
- **Search**: URL-param based (`?query=`), pushes to router
- **Filter**: Status dropdown via `TypicalFilter`
- **Sorting**: Configurable via `useListViewSettings('purch_registry')`
- **Row Click**: Navigates to `/purchases/{id}` (with `?type=legacy` for legacy orders)

---

## 4. Page: `/purchases/new-order` — Enterprise PO Form

**Files**: `page.tsx` (SSR) + `form.tsx` (Client, 1078 lines)

### Purpose
The primary formal procurement workspace with an **11-zone Intelligence Grid** and rich per-product analytics.

### SSR Data Loading (`page.tsx`)

```typescript
const [suppliers, sites, paymentTerms, drivers] = await Promise.all([
    getContactsByType('SUPPLIER'),          // GET /contacts/?type=SUPPLIER
    getSitesAndWarehouses(),                // GET /sites/?include_warehouses=true
    getPaymentTerms(),                      // GET /payment-terms/
    getDrivers(),                           // GET /users/?is_driver=true (fallback: all active users)
]);
```

All data is serialized via `serializeDecimals()` before passing to the client component.

### Configuration Panel (Collapsible)

| Row | Fields |
|-----|--------|
| **Row 1** | Branch (select) → Site/Warehouse (cascaded) → Supplier |
| **Row 2** | Scope (OFFICIAL/INTERNAL toggle) → Stock View (Branch/All toggle) → Payment Terms → Assigned Driver |
| **Row 3** | Notes (text) |

**Site → Warehouse Cascade**: When a branch is selected, its `warehouses` array (from `?include_warehouses=true`) populates the warehouse dropdown. If no children exist, the site itself is used.

### Product Addition Methods

1. **Search Bar** (`ProductSearchInput`) — Debounced 300ms search via `searchProductsSimple()`. Dropdown shows name, barcode/SKU, stock level, and safety badge.
2. **Catalogue Modal** — Full product browser (see [Deep Dive §10](#10-catalogue-modal-deep-dive))
3. **External Link** — "New Product" opens `/products/new` in a new tab

### OrderLine Type (Intelligence Grid Data)

```typescript
interface OrderLine {
    id: string;                    // Unique line ID
    productId: number;             // Product FK
    productName: string;           // Display name
    barcode: string;               // Product barcode
    category: string;              // Category name
    qtyRequired: number;           // Auto-calculated: ceil(monthlyAvg * 1.5) - totalStock
    qtyProposed: number;           // Editable proposed qty
    stockOnLocation: number;       // Stock at selected warehouse
    stockTransfer: number;         // Stock in transit
    stockAnnual: number;           // Annual stock figure
    purchaseCount: number;         // Historical purchase count
    productStatus: string;         // 'Available' or 'Unavailable'
    dailySales: number;            // Average daily sales
    monthlyAverage: number;        // Monthly sales average
    financialScore: number;        // Business intelligence score
    adjustmentScore: number;       // Adjustment risk score
    totalPurchase: number;         // Total value purchased
    totalSales: number;            // Total value sold
    unitCost: number;              // Cost price HT
    sellingPrice: number;          // Selling price HT
    bestSupplier: string;          // Best supplier name
    bestPrice: number;             // Best supplier price
    isExpiryTracked: boolean;      // Whether product tracks expiry
    shelfLifeDays: number;         // Manufacturer shelf life
    avgExpiryDays: number;         // Average expiry days in stock
    daysToSellAll: number;         // Days to sell current stock
    safetyTag: 'SAFE'|'CAUTION'|'RISKY';  // Expiry safety classification
    otherWarehouseStock: { warehouse: string; warehouse_id: number; qty: number }[];
    actionQty: number;             // Final quantity to order
}
```

### 11-Zone Intelligence Grid (Desktop Table)

| # | Zone | Columns | Purpose |
|---|------|---------|---------|
| 1 | **Product** | Name, barcode, category badge | Identification |
| 2 | **Qty Required** | Auto-calculated + editable proposed | Smart replenishment: `ceil(monthlyAvg × 1.5) - totalStock` |
| 3 | **Stock** | On-location (colored), in-transit, "⇄ elsewhere" link | Multi-branch visibility + transfer trigger |
| 4 | **Purchases** | Purchase count, active status | Procurement history |
| 5 | **Sales/Day** | Daily average, monthly average | Demand velocity |
| 6 | **Score** | Financial score (green/amber), adjustment risk (red if ≥500) | Business intelligence |
| 7 | **Purchase $** | Total purchased, total sold | Volume spend |
| 8 | **Cost** | Unit cost HT, selling price | Pricing reference |
| 9 | **Best Supplier** | Name + best price | Sourcing intelligence |
| 10 | **Expiry** | Safety badge (SAFE/CAUTION/RISKY), shelf days, sell days | Expiry risk management |
| 11 | **Action Qty** | Editable quantity + delete button | Final order quantity |

**Safety Badge Logic**:
- `SAFE` (emerald) — Sufficient shelf life relative to sales velocity
- `CAUTION` (amber) — Approaching risk threshold
- `RISKY` (rose) — High expiry risk given sales velocity

### Mobile Layout
Uses `MobileCard` component: compact header with expand/collapse, 4-stat strip (Stock, Sales/d, Score, Cost), expandable detail grid with 12+ stats and transfer button.

### Live Summary Bar
Shows KPI chips: Lines count, Total Qty, Estimated Cost, Risky Items count.

### Submit Footer
Displays stats (Products, Total Units, Estimated Cost, Risky count) and submit button with gradient styling. Hidden form fields encode lines as `lines[N][productId]`, `lines[N][quantity]`, etc.

### Form Submission Flow

```
FormData → createFormalPurchaseOrder() [commercial/purchases.ts]
  → Parse lines[n][field] from FormData entries
  → Build payload: { supplier, site, warehouse, status:'DRAFT', lines: [...] }
  → POST /api/erp/purchase-orders/
  → revalidatePath('/purchases', '/purchases/purchase-orders')
  → redirect('/purchases/purchase-orders')
```

Backend `PurchaseOrderViewSet.create()` creates PO header + lines in a single transaction, then calls `po.recalculate_totals()`.

---

## 5. Page: `/purchases/purchase-orders` — PO Workspace

**File**: `src/app/(privileged)/purchases/purchase-orders/page-client.tsx` (Client)

### Purpose
Split-panel workspace for viewing and managing all formal Purchase Orders.

### Data Loading

```typescript
// On mount (useEffect):
const data = await fetchPurchaseOrders();  // GET /purchase-orders/
// On row click:
const detail = await fetchPurchaseOrder(id);  // GET /purchase-orders/{id}/
```

### UI Layout

| Section | Description |
|---------|-------------|
| **Header** | "Purchase Orders" title + Refresh + "New PO" link |
| **KPI Strip** (3 cards) | Total Value, In Progress, Completed |
| **Search & Filters** | Text search + status filter tabs (9 statuses) |
| **Split Panel** | Left: scrollable order list. Right: sticky detail panel |

### Order List (Left Panel)
- Each row shows: PO number, status badge, supplier name, date, total amount
- Selected row highlighted with blue border
- Min height 64px, touch-friendly
- Empty state with "Create one →" link

### Detail Panel (Right Panel)
- **Header**: PO number, supplier name, order date, expected delivery, total amount, status badge
- **Quick Links**: "Full View" → `/purchases/{id}`, "Ledger" → `/finance/ledger?q={po_number}`
- **Notes** section (if present)
- **Order Lines**: Each line shows product name, SKU, qty × price, subtotal
- **Receipt Progress**: Per-line progress bar — `qty_received / qty_ordered` with color:
  - 100% → emerald
  - Partial → amber
  - 0% → gray

### Status Configuration (13 statuses)

```typescript
const STATUS_CONFIG = {
    DRAFT:              { label: 'Draft',     class: 'bg-gray-100 text-gray-600' },
    SUBMITTED:          { label: 'Pending',   class: 'bg-amber-50 text-amber-600' },
    APPROVED:           { label: 'Approved',  class: 'bg-blue-50 text-blue-600' },
    REJECTED:           { label: 'Rejected',  class: 'bg-rose-50 text-rose-600' },
    ORDERED:            { label: 'Ordered',   class: 'bg-indigo-50 text-indigo-600' },
    SENT:               { label: 'Sent',      class: 'bg-cyan-50 text-cyan-600' },
    CONFIRMED:          { label: 'Confirmed', class: 'bg-teal-50 text-teal-600' },
    IN_TRANSIT:         { label: 'In Transit',class: 'bg-orange-50 text-orange-600' },
    PARTIALLY_RECEIVED: { label: 'Partial',   class: 'bg-amber-50 text-amber-600' },
    RECEIVED:           { label: 'Received',  class: 'bg-emerald-50 text-emerald-600' },
    INVOICED:           { label: 'Invoiced',  class: 'bg-purple-50 text-purple-600' },
    COMPLETED:          { label: 'Complete',  class: 'bg-emerald-50 text-emerald-700' },
    CANCELLED:          { label: 'Cancelled', class: 'bg-rose-50 text-rose-600' },
}
```

---

## 6. Backend Architecture

### Models

#### `PurchaseOrder` (TenantModel) — `purchase_order` table

| Field Group | Fields | Description |
|-------------|--------|-------------|
| **Reference** | `po_number` (auto-generated), `status`, `priority`, `purchase_sub_type` | Identity & classification |
| **Supplier** | `supplier` (FK→Contact), `supplier_name` (snapshot), `supplier_ref` | Vendor link |
| **Location** | `site` (FK→Warehouse), `warehouse` (FK→Warehouse) | Receiving location |
| **Dates** | `order_date`, `expected_date`, `received_date` | Timeline |
| **Financials** | `currency`, `exchange_rate`, `subtotal`, `tax_amount`, `discount_amount`, `shipping_cost`, `total_amount` | Money |
| **Approval** | `submitted_by/at`, `approved_by/at`, `rejected_by/at`, `rejection_reason` | Approval audit trail |
| **Cancellation** | `cancelled_by/at`, `cancellation_reason` | Cancellation audit |
| **Invoice** | `invoice` (FK→Invoice), `invoice_policy` (RECEIVED_QTY or ORDERED_QTY) | Invoice matching |
| **Payment** | `payment_term` (FK→PaymentTerm) | Payment conditions |
| **Logistics** | `assigned_driver` (FK→User), `tracking_number`, `tracking_url`, `dispatched_at` | Delivery tracking |
| **Audit** | `created_by`, `created_at`, `updated_at`, `notes`, `internal_notes` | Standard audit |

**Key Methods**:
- `save()` — Auto-generates `po_number` via `TransactionSequence` on first non-DRAFT save; snapshots `supplier_name`
- `transition_to(new_status, user, reason)` — Validates transition against `VALID_TRANSITIONS` map, records audit fields
- `recalculate_totals()` — Sums line totals and taxes
- `check_receipt_completeness()` — Auto-transitions SENT→PARTIALLY_RECEIVED or →RECEIVED
- `check_invoice_completeness()` — Auto-transitions RECEIVED→PARTIALLY_INVOICED→INVOICED
- `get_discrepancy_summary()` — Aggregates all line discrepancies for dashboard

**DB Indexes**: `[organization, status]`, `[organization, supplier]`, `[po_number]`

#### `PurchaseOrderLine` (TenantModel) — `purchase_order_line` table

| Field Group | Fields |
|-------------|--------|
| **Identity** | `order` (FK→PO), `product` (FK→Product), `description`, `sort_order` |
| **Quantities** | `quantity`, `supplier_declared_qty`, `qty_received`, `qty_invoiced` |
| **Pricing** | `unit_price`, `tax_rate`, `discount_percent`, `line_total` (auto), `tax_amount` (auto) |
| **Discrepancies** | `qty_missing`, `qty_damaged`, `qty_rejected`, `receipt_notes` |
| **Location** | `warehouse` (per-line override), `expected_date` |

**Computed Properties** (Phase 5):
- `declared_gap` — `supplier_declared_qty - quantity` (None if no declaration)
- `receipt_gap_vs_declared` — `declared - (received + damaged)`
- `receipt_gap_vs_ordered` — `ordered - (received + damaged + rejected)`
- `missing_vs_po` — `max(0, ordered - received - damaged - rejected)`
- `missing_vs_declared` — `max(0, declared - received - damaged - rejected)`
- `received_amount`, `damaged_amount`, `missing_amount` — monetary equivalents

**Immutability Guard**: `save()` and `delete()` raise `ValidationError` if PO status is RECEIVED/INVOICED/COMPLETED/CANCELLED.

**Auto-calculation on save**:
```python
base = quantity × unit_price
discount = base × (discount_percent / 100)
net = base - discount
tax_amount = net × (tax_rate / 100)
line_total = net
```

#### Enhancement Models

| Model | Table | Purpose |
|-------|-------|---------|
| `LandedCost` | `landed_cost` | Allocates freight/customs/insurance to PO. Methods: BY_VALUE, BY_QUANTITY, BY_WEIGHT |
| `LandedCostLine` | `landed_cost_line` | Cost components: FREIGHT, CUSTOMS, INSURANCE, HANDLING, OTHER |
| `PurchaseAttachment` | `purchase_attachment` | Documents: QUOTATION, CONTRACT, BL, PROFORMA, CUSTOMS, OTHER |

### Serializers

**`PurchaseOrderSerializer`**: Exposes all fields + computed:
- `lines` (nested `PurchaseOrderLineSerializer`)
- `supplier_display`, `warehouse_name`, `site_name`
- `submitted_by_name`, `approved_by_name`, `created_by_name`
- `line_count`, `receipt_progress` (% lines fully received)
- `discrepancy_summary` (aggregated discrepancy data)

**`PurchaseOrderLineSerializer`**: All fields + Phase 5 computed:
- `product_name`, `product_sku`, `warehouse_name`
- `declared_gap`, `receipt_gap_vs_declared`, `receipt_gap_vs_ordered`
- `missing_vs_po`, `missing_vs_declared`
- `received_amount`, `damaged_amount`, `missing_amount`

### ViewSets

#### `PurchaseOrderViewSet` (ModelViewSet)

| Action | Method | URL | Description |
|--------|--------|-----|-------------|
| `list` | GET | `/purchase-orders/` | Filtered by status, supplier, query (PO#, supplier name, notes) |
| `retrieve` | GET | `/purchase-orders/{id}/` | Full PO with nested lines |
| `create` | POST | `/purchase-orders/` | Nested line creation in single POST |
| `submit` | POST | `/purchase-orders/{id}/submit/` | DRAFT→SUBMITTED + fires PURCHASE_ENTERED event |
| `approve` | POST | `/purchase-orders/{id}/approve/` | SUBMITTED→APPROVED + fires PO_APPROVED event |
| `reject` | POST | `/purchase-orders/{id}/reject/` | SUBMITTED→REJECTED (with reason) |
| `send_to_supplier` | POST | `/purchase-orders/{id}/send-to-supplier/` | APPROVED→SENT |
| `revert_to_draft` | POST | `/purchase-orders/{id}/revert-to-draft/` | Revert from SUBMITTED/APPROVED/REJECTED/CANCELLED |
| `receive_line` | POST | `/purchase-orders/{id}/receive-line/` | Receive goods + update inventory + discrepancies |
| `cancel` | POST | `/purchase-orders/{id}/cancel/` | Any non-terminal→CANCELLED |
| `record_supplier_declaration` | POST | `/purchase-orders/{id}/record-supplier-declaration/` | BL/Proforma declared quantities |
| `mark_invoiced` | POST | `/purchase-orders/{id}/mark-invoiced/` | Creates invoice + 3-way matching |
| `complete` | POST | `/purchase-orders/{id}/complete/` | INVOICED→COMPLETED |
| `add_line` | POST | `/purchase-orders/{id}/add-line/` | Add line to DRAFT PO |
| `remove_line` | DELETE | `/purchase-orders/{id}/remove-line/{line_id}/` | Remove line from DRAFT PO |
| `dashboard` | GET | `/purchase-orders/dashboard/` | Aggregated stats by status |
| `auto_replenish` | POST | `/purchase-orders/auto-replenish/` | Min/Max replenishment engine |
| `pending_invoice` | GET | `/purchase-orders/pending-invoice/` | POs in RECEIVED status |

---

## 7. Lifecycle State Machine (13 States)

```
                 ┌─────────── CANCELLED ◄──── (any non-terminal)
                 │
DRAFT ──► SUBMITTED ──► APPROVED ──► SENT ──► CONFIRMED ──► IN_TRANSIT
  ▲             │                              │              │
  │             └──► REJECTED ──────────┐      │              │
  │                                     │      │              │
  └─────────────────────────────────────┘      ▼              ▼
                                        PARTIALLY_RECEIVED ◄──┘
                                               │
                                               ▼
                                          RECEIVED ──► PARTIALLY_INVOICED ──► INVOICED ──► COMPLETED
```

| From | Allowed Targets |
|------|----------------|
| DRAFT | SUBMITTED, CANCELLED |
| SUBMITTED | APPROVED, REJECTED, CANCELLED |
| APPROVED | SENT, CANCELLED |
| REJECTED | DRAFT (re-open) |
| SENT | CONFIRMED, CANCELLED, PARTIALLY_RECEIVED, RECEIVED |
| CONFIRMED | IN_TRANSIT, CANCELLED, PARTIALLY_RECEIVED, RECEIVED |
| IN_TRANSIT | PARTIALLY_RECEIVED, RECEIVED, CANCELLED |
| PARTIALLY_RECEIVED | RECEIVED, CANCELLED |
| RECEIVED | PARTIALLY_INVOICED, INVOICED, COMPLETED |
| PARTIALLY_INVOICED | INVOICED, COMPLETED |
| INVOICED | COMPLETED |
| COMPLETED | ∅ (terminal) |
| CANCELLED | ∅ (terminal) |

**Revert to Draft**: Allowed from SUBMITTED, APPROVED, REJECTED, CANCELLED. Clears `approved_by`, appends reason to notes.

---

## 8. Server Action Layer

### `actions/purchases/purchase-orders.ts` — Dedicated PO Actions

| Function | API Call | Purpose |
|----------|---------|---------|
| `getPurchaseOrders(status?, priority?, supplierId?, purchaseSubType?)` | GET `/purchase-orders/` | List with filters |
| `getPurchaseOrder(id)` | GET `/purchase-orders/{id}/` | Single PO detail |
| `createPurchaseOrder(data)` | POST `/purchase-orders/` | Create + revalidate |
| `updatePurchaseOrder(id, data)` | PATCH `/purchase-orders/{id}/` | Update + revalidate |
| `deletePurchaseOrder(id)` | DELETE `/purchase-orders/{id}/` | Delete + revalidate |
| `submitPO(id)` | POST `/purchase-orders/{id}/submit/` | Submit for approval |
| `approvePO(id)` | POST `/purchase-orders/{id}/approve/` | Approve |
| `rejectPO(id, reason)` | POST `/purchase-orders/{id}/reject/` | Reject with reason |
| `sendPOToSupplier(id)` | POST `/purchase-orders/{id}/send-to-supplier/` | Mark as sent |
| `receivePOLine(id, lineId, qty, discrepancies?)` | POST `/purchase-orders/{id}/receive-line/` | Receive with discrepancies |
| `cancelPO(id)` | POST `/purchase-orders/{id}/cancel/` | Cancel |
| `markPOInvoiced(id, invoiceNumber)` | POST `/purchase-orders/{id}/mark-invoiced/` | Invoice + 3-way match |
| `completePO(id)` | POST `/purchase-orders/{id}/complete/` | Complete |
| `addPOLine(id, data)` | POST `/purchase-orders/{id}/add-line/` | Add line |
| `removePOLine(id, lineId)` | DELETE `/purchase-orders/{id}/remove-line/{lineId}/` | Remove line |
| `autoReplenish()` | POST `/purchase-orders/auto-replenish/` | Run engine |
| `getPODashboard()` | GET `/purchase-orders/dashboard/` | Stats by status |

### `actions/pos/purchases.ts` — Unified Actions

Mirrors PO lifecycle actions, plus:

| Function | Purpose |
|----------|---------|
| `revertToDraft(id)` | Revert to DRAFT |
| `recordSupplierDeclaration(id, lines)` | BL/Proforma quantities |
| `printPO(id)` | Generate PDF |
| `fetchQuotations()`, `createQuotation()`, `updateQuotation()` | RFQ hub |
| `fetchConsignments()`, `fetchConsignment(id)` | Consignment settlements |
| `fetchCreditNotes()`, `fetchCreditNote(id)` | Vendor debits |
| `fetchProductSuppliers()`, `fetchSupplierPriceHistory()` | Sourcing intelligence |

### `actions/commercial/purchases.ts` — FormData-Based Actions

| Function | API Call | Purpose |
|----------|---------|---------|
| `createPurchaseInvoice(prevState, formData)` | POST `/purchase/quick_purchase/` | Quick purchase with Zod validation, extra fees, initial payment |
| `createFormalPurchaseOrder(prevState, formData)` | POST `/purchase-orders/` | Formal PO (used by `/new-order`) |
| `getOpenPurchaseOrders(supplierId)` | GET `/purchase/pending-invoice/` | POs awaiting invoice |
| `authorizePurchaseOrder(id)` | POST `/purchase/{id}/authorize/` | Authorize legacy PO |
| `receivePurchaseOrder(id, formData)` | POST `/purchase/{id}/receive/` | Receive legacy PO |
| `invoicePurchaseOrder(id, formData)` | POST `/purchase/{id}/invoice/` | Invoice legacy PO |

---

## 9. Quick Purchase Service (Deep Dive)

**File**: `erp_backend/apps/pos/services/purchase_service.py` → `PurchaseService.quick_purchase()`

This is a **375-line atomic transaction** that performs a complete purchase cycle in a single call — "receipt order" style where goods arrive immediately.

### Input Parameters

```python
quick_purchase(organization, supplier_id, warehouse_id, site_id, scope,
               invoice_price_type, vat_recoverable, lines,
               notes=None, ref_code=None, user=None, **kwargs)
# kwargs: discountAmount, extraFees, initialPayment, is_export
```

### Execution Steps

1. **Tax Engine Context**: Creates `TaxEngineContext.from_org()` and `_SupplierProfile.from_contact()` to derive VAT recoverability
2. **AIRSI Detection**: Checks global AIRSI rate and supplier's `is_airsi_subject` flag
3. **Order Creation**: Creates `Order(type='PURCHASE', status='COMPLETED')` immediately
4. **Per-Line Processing** (for each line):
   - **HT/TTC Resolution**: Bidirectional — if one is provided, calculates the other
   - **Tax Calculation**: `TaxCalculator.resolve_purchase_costs()` computes VAT, AIRSI, cost views
   - **Cost Basis Resolution**: `FORCE_HT`, `FORCE_TTC`, or `AUTO` (uses `cost_official` from engine)
   - **OrderLine Creation** with `effective_cost`
   - **Tax Entry Recording**: `OrderLineTaxEntry.from_tax_line_dict()` for per-line tax audit
   - **ProductBatch Creation**: `PUR-{order_id}-{product_id}` batch number with expiry
   - **Inventory Update**: `Inventory.get_or_create()` + increment quantity
   - **InventoryMovement**: Type='IN' with cost tracking
   - **Serial Number Registration**: If `product.tracks_serials`, validates and registers each serial
   - **Product Price Update**: Updates `cost_price`, `cost_price_ht`, `cost_price_ttc`, selling prices
   - **Sourcing Intelligence**: Creates/updates `ProductSupplier` link + `SupplierPriceHistory` record

5. **Order Totals**: `total_amount = HT + tax + AIRSI + extra_fees - discount`

6. **Ledger Posting** (posting rules-driven):

   | Line | Account (from posting rules) | Debit | Credit |
   |------|------------------------------|-------|--------|
   | AP | `purchases.payable` or `supplier.linked_account` | — | AP amount |
   | Inventory | `purchases.inventory` | Inventory value (HT + capitalized taxes) | — |
   | Extra Fees | `purchases.delivery_fees` or fee-specific account | Fee amount | — |
   | Discount | `purchases.discount_earned` | — | Discount amount |
   | VAT Recoverable | `purchases.vat_recoverable` | Tax amount | — |
   | VAT Reverse Charge | `purchases.reverse_charge_vat` + `sales.vat_collected` | Input | Output |
   | AIRSI | `purchases.airsi` or `purchases.airsi_payable` | Varies by treatment | Varies |

   AIRSI treatment modes: `CAPITALIZE` (adds to inventory cost), `EXPENSE`, `RECOVER`

7. **Initial Payment** (optional): Creates second journal entry — DR AP, CR Cash/Bank

---

## 10. Catalogue Modal (Deep Dive)

**File**: `form.tsx` → `CatalogueModal` component (lines 860-1077)

### Architecture
Full-screen modal with **sidebar filters** + **infinite-scroll product grid**.

### Data Loading

```typescript
// On mount: Load filter options
const data = await getCatalogueFilters();  // categories, brands

// On filter/search change (debounced 300ms):
const data = await getCatalogueProducts({
    page, page_size: 30, query, category, brand,
    site_id, supplier, min_stock, max_stock, min_margin, status
});
```

### Filter Sidebar (6 Filters)

| Filter | Options |
|--------|---------|
| **Category** | Dynamic from `getCatalogueFilters()` |
| **Brand** | Dynamic from `getCatalogueFilters()` |
| **Available Qty** | All levels, In Stock (≥1), High (≥50), Low (1-10), Out of Stock (0) |
| **Min Margin %** | Any, ≥5%, ≥10%, ≥20%, ≥30%, ≥50% |
| **Rotation** | All, Fast (≥5/day), Medium (1-5), Slow (<1), Dead (0) — **client-side filter** |
| **Status** | Active, Discontinued |

Active filter count badge shown on Filters button. "Clear all" button when filters active.

### Product Grid (2-column on desktop)

Each product card shows:
- **Header**: Product name, SKU, barcode, category
- **4-stat grid**: Available stock (colored), Proposed qty, Margin %, Rotation (days of stock)
- **Footer**: Cost → Sell prices, daily sales, safety badge (if expiry tracked)

**Proposed Qty Calculation**: `max(0, round(daily_sales × 14 - stock))`
**Days of Stock**: `stock > 0 ? round(stock / daily_sales) : 0` (999 if no sales but has stock)

### Infinite Scroll
`handleScroll` checks if within 100px of bottom and loads next page with `append=true`.

---

## 11. Receipt & Discrepancy Workflow (Deep Dive)

**Backend**: `PurchaseOrderViewSet.receive_line()` (lines 318-407)

### Input

```json
{
    "line_id": 42,
    "quantity": 100,          // Good qty received
    "qty_damaged": 5,         // Arrived damaged
    "qty_rejected": 2,        // Wrong spec/expired
    "qty_missing": 3,         // Supplier didn't deliver
    "receipt_notes": "Box #7 water damaged"
}
```

### Execution Steps

1. **Inventory Update**: `StockService.receive_stock()` — only for accepted qty (not damaged/rejected)
2. **Discrepancy Recording**: Increments `qty_damaged`, `qty_rejected`, `qty_missing` on the line
3. **Receipt Notes**: Appends to existing notes
4. **Tolerance Check** (`PurchaseOrderLine.receive()`):
   - Total arrived = `qty_received + qty_damaged + qty_rejected`
   - Max allowed = `quantity × (1 + tolerance%)`
   - Tolerance from `ConfigurationService.get_global_settings()` key `po_over_receipt_tolerance` (default 5%)
   - Raises `ValidationError` if over-receipt
5. **PO Status Auto-Update** (`check_receipt_completeness()`):
   - All lines fully received → RECEIVED
   - Some lines received → PARTIALLY_RECEIVED
6. **Workspace Events**:
   - If product has no barcode → fires `BARCODE_MISSING_PURCHASE` event
   - If PO fully received → fires `DELIVERY_COMPLETED` event
   - If no invoice attached → fires `PURCHASE_NO_ATTACHMENT` event

### Discrepancy Dashboard (Serializer)

The `PurchaseOrderSerializer.get_discrepancy_summary()` aggregates across all lines:

```python
{
    'total_ordered': Σ quantity,
    'total_declared': Σ supplier_declared_qty,
    'has_declarations': any line has declaration,
    'total_received': Σ qty_received,
    'total_damaged': Σ qty_damaged,
    'total_rejected': Σ qty_rejected,
    'total_invoiced': Σ qty_invoiced,
    'total_missing_vs_po': Σ missing_vs_po,
    'total_received_amount': Σ (qty_received × unit_price),
    'total_damaged_amount': Σ (qty_damaged × unit_price),
    'total_missing_amount': Σ (missing_vs_po × unit_price),
}
```

### Supplier Declaration Flow

Separate endpoint `record_supplier_declaration` allows recording what the supplier claims they shipped (BL/Proforma). This enables **declared vs received** gap analysis.

---

## 12. Invoice & 3-Way Matching (Deep Dive)

**Backend**: `PurchaseService.invoice_po()` (lines 547-660)

### 3-Way Matching
Compares: **PO quantities** ↔ **Receipt quantities** ↔ **Invoice quantities**

### Execution Steps

1. **Invoice Creation**: `Invoice(type='PURCHASE', status='DRAFT')`
2. **Invoice Lines**: For each PO line where `qty_received > qty_invoiced`:
   - Creates `InvoiceLine` with `purchase_order_line` FK
   - Calculates `line_total_ht` and `line_total_ttc`
   - Increments `line.qty_invoiced`
3. **3-Way Match Validation**: `ThreeWayMatchService.validate_invoice()`
   - If valid → Invoice status = POSTED
   - If invalid → Invoice marked DISPUTED + payment blocked
4. **Ledger Posting**:
   - DR `suspense.reception` (clearing accrual from receiving)
   - CR `purchases.payable` (establishing AP)
5. **PO Status Update**: `check_invoice_completeness()`:
   - Partial → PARTIALLY_INVOICED
   - Full → INVOICED

### Invoice Policy
- `RECEIVED_QTY` (default, 3-way match) — Invoice matched against received qty
- `ORDERED_QTY` (2-way match) — Invoice matched against ordered qty

---

## 13. Procurement Request System

**Model**: `ProcurementRequest` (TenantModel) — `procurement_request` table

A lightweight **request queue** for transfer and purchase requests that can be reviewed before execution.

### Request Types

| Type | Fields Used | Converts To |
|------|-------------|-------------|
| `TRANSFER` | `from_warehouse`, `to_warehouse`, `quantity` | StockMove |
| `PURCHASE` | `supplier`, `suggested_unit_price`, `quantity` | PurchaseOrder |

### Lifecycle: `PENDING → APPROVED → EXECUTED` or `PENDING → REJECTED/CANCELLED`

### Integration with PO Form
When creating a new PO, the Intelligence Grid allows:
- **Transfer Request**: Click "⇄ elsewhere" on a product that has stock in other warehouses → opens transfer dialog → creates `ProcurementRequest(type='TRANSFER')`
- **Purchase Request**: Request product from a different supplier → creates `ProcurementRequest(type='PURCHASE')`

Both dialogs are modal overlays within the PO form that call `createProcurementRequest()` server action.

---

## 14. Auto-Replenishment Engine

**Endpoint**: `POST /purchase-orders/auto-replenish/`
**Service**: `AutomatedReplenishmentService.run_auto_replenishment(organization)`

Scans all products against Min/Max thresholds and generates Draft POs automatically. Returns:

```json
{
    "success": true,
    "message": "Generated 3 Draft POs off 150 products scanned.",
    "data": { "pos_created": 3, "products_scanned": 150 }
}
```

Triggered from the `/purchases` registry page via the Auto Replenish button.

---

## 15. Event System & Workspace Tasks

The PO ViewSet fires events for workspace task automation:

| Event | When Fired | Data |
|-------|-----------|------|
| `PURCHASE_ENTERED` | PO submitted | PO number, amount, site |
| `PO_APPROVED` | PO approved | PO number, amount |
| `DELIVERY_COMPLETED` | PO fully received | PO number, amount |
| `PURCHASE_NO_ATTACHMENT` | PO received without invoice | PO number |
| `BARCODE_MISSING_PURCHASE` | Received product has no barcode | Product name/id, qty |

These use `trigger_purchasing_event()` from `apps.workspace.signals` (wrapped in try/except to never block purchases).

---

## 16. Data Flow Diagrams

### Full Module Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND PAGES                                   │
├─────────────────┬──────────────────┬────────────────────────────────┤
│ /purchases      │ /purchases/      │ /purchases/purchase-orders     │
│ (Registry)      │ new-order        │ (PO Workspace)                 │
│                 │ (Intelligence    │                                │
│ SSR merges:     │  Grid)           │ Client-side:                   │
│ • POs (formal)  │                  │ • fetchPurchaseOrders()        │
│ • Legacy orders │ SSR loads:       │ • fetchPurchaseOrder(id)       │
│ • Dashboard     │ • suppliers      │                                │
│                 │ • sites+wh       │ Split panel:                   │
│ Shows:          │ • payment terms  │ • Left: Order list             │
│ • KPI row (5)   │ • drivers        │ • Right: Detail + lines        │
│ • Pipeline      │                  │   with receipt progress bars   │
│ • Registry table│ Client form:     │                                │
│                 │ • Intelligence   │                                │
│                 │   Grid (11 zones)│                                │
│                 │ • Catalogue Modal│                                │
│                 │ • Procurement    │                                │
│                 │   Request dialogs│                                │
└────────┬────────┴────────┬─────────┴─────────────┬──────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SERVER ACTIONS                                    │
├─────────────────────────────────────────────────────────────────────┤
│ purchases/purchase-orders.ts  — Dedicated PO CRUD + lifecycle       │
│ pos/purchases.ts              — Unified (quotations, consignments)  │
│ commercial/purchases.ts       — FormData (quick purchase, formal PO)│
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ erpFetch()
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Django REST)                         │
├─────────────────────────────────────────────────────────────────────┤
│ PurchaseOrderViewSet (/purchase-orders/)                            │
│   ├── CRUD + 13-state lifecycle actions                             │
│   ├── receive_line → StockService + discrepancies                   │
│   ├── mark_invoiced → PurchaseService.invoice_po() → 3-way match   │
│   └── auto_replenish → AutomatedReplenishmentService                │
│                                                                     │
│ PurchaseViewSet (/purchase/)                                        │
│   └── Legacy: list/create/receive/invoice/quick_purchase            │
│                                                                     │
│ ProcurementRequestViewSet (/procurement-requests/)                  │
│   └── PENDING → APPROVED/REJECTED → EXECUTED/CANCELLED              │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SERVICES                                         │
├─────────────────────────────────────────────────────────────────────┤
│ PurchaseService                                                     │
│   ├── quick_purchase() → Order + Inventory + Ledger + Tax           │
│   ├── receive_po()     → Inventory + Accrual Ledger Entry           │
│   ├── invoice_po()     → Invoice + 3-Way Match + Clearing Entry     │
│   └── create_purchase_order() → Order + Lines                       │
│                                                                     │
│ StockService.receive_stock()    → Inventory module                  │
│ LedgerService.create_journal_entry() → Finance module               │
│ TaxCalculator.resolve_purchase_costs() → Tax engine                 │
│ AutomatedReplenishmentService → Min/Max engine                      │
│ ThreeWayMatchService.validate_invoice() → Invoice validation        │
└─────────────────────────────────────────────────────────────────────┘
```

### PO Lifecycle Journey

```
User creates PO (/new-order)
  → POST /purchase-orders/ (status: DRAFT)
    → PO saved with lines
  
User submits PO
  → POST /purchase-orders/{id}/submit/ (DRAFT → SUBMITTED)
    → Fires PURCHASE_ENTERED workspace event

Manager approves PO  
  → POST /purchase-orders/{id}/approve/ (SUBMITTED → APPROVED)
    → Fires PO_APPROVED workspace event

Procurement sends to supplier
  → POST /purchase-orders/{id}/send-to-supplier/ (APPROVED → SENT)
    → Sets order_date

Supplier confirms
  → (External action, status update via API)

Goods arrive — per-line receiving
  → POST /purchase-orders/{id}/receive-line/ (SENT → PARTIALLY_RECEIVED → RECEIVED)
    → StockService.receive_stock() — inventory updated
    → Tolerance check (configurable %, default 5%)
    → Discrepancies recorded (damaged, rejected, missing)
    → Fires DELIVERY_COMPLETED when fully received

Invoice matched
  → POST /purchase-orders/{id}/mark-invoiced/ (RECEIVED → INVOICED)
    → Invoice created + 3-way match validation
    → Ledger: DR Suspense, CR Accounts Payable
    → If match fails → Invoice DISPUTED

PO completed
  → POST /purchase-orders/{id}/complete/ (INVOICED → COMPLETED)
    → Terminal state
```

---

## 17. Transition Side-Effects Table

| Transition | Business Effect | Inventory Effect | Finance Effect | Event Effect | Locking Effect |
|-----------|----------------|-----------------|---------------|-------------|---------------|
| DRAFT → SUBMITTED | PO# assigned, enters workflow | None | None | `PURCHASE_ENTERED` | Lines frozen except allowed edits |
| SUBMITTED → APPROVED | Approval complete | None | Budget commitment (if active) | `PO_APPROVED` | Supplier, prices, qty locked |
| APPROVED → SENT | Supplier-facing PO finalized | None | None | `PO_SENT` | Commercial snapshot frozen |
| SENT → CONFIRMED | Supplier confirms | None | None | `PO_CONFIRMED` | No commercial edits |
| CONFIRMED → IN_TRANSIT | Shipment underway | None | None | `PO_IN_TRANSIT` | Logistical tracking editable |
| */→ PARTIALLY_RECEIVED | First goods arrive | Accepted stock in via GRN, discrepancies recorded | DR Inventory, CR GRNI (accrual) | `RECEIPT_POSTED` | Receipt lines immutable after posting |
| PARTIALLY_RECEIVED → RECEIVED | All expected goods received | Remaining stock updates via GRN | GRNI finalization | `DELIVERY_COMPLETED` | PO commercial data locked |
| RECEIVED → PARTIALLY_INVOICED | Some invoice entered | None | AP partially recognized | `INVOICE_PARTIAL` | Invoice policy locked |
| RECEIVED → INVOICED | All invoice entered | None | DR GRNI, CR AP + 3-way match | `INVOICE_MATCHED` or `INVOICE_DISPUTED` | Fully finance-locked except dispute |
| INVOICED → COMPLETED | All closed | None | Final close | `PO_COMPLETED` | Hard lock |
| Any non-terminal → CANCELLED | Abort process | Pending expectations cancelled | Release budget commitment | `PO_CANCELLED` | Hard lock except notes |
| RECEIVED/INVOICED → RETURN_CREATED | Return initiated | Stock reserve/reverse | Return accrual / supplier credit pending | `PURCHASE_RETURN_OPENED` | Return workflow controls edits |

---

## 18. Locking / Editability Matrix

| Status | Header | Supplier | Lines | Qty/Price | Receipt | Invoice | Notes | Attachments |
|--------|--------|----------|-------|-----------|---------|---------|-------|-------------|
| DRAFT | ✏️ | ✏️ | ✏️ | ✏️ | ❌ | ❌ | ✏️ | ✏️ |
| SUBMITTED | Limited | 🔒 | Limited | 🔒 | ❌ | ❌ | ✏️ | ✏️ |
| APPROVED | Limited | 🔒 | 🔒 | 🔒 | ❌ | ❌ | ✏️ | ✏️ |
| SENT | 🔒 | 🔒 | 🔒 | 🔒 | ✏️ via GRN | ❌ | ✏️ | ✏️ |
| CONFIRMED | 🔒 | 🔒 | 🔒 | 🔒 | ✏️ via GRN | ❌ | ✏️ | ✏️ |
| IN_TRANSIT | 🔒 | 🔒 | 🔒 | 🔒 | ✏️ via GRN | ❌ | ✏️ | ✏️ |
| PARTIALLY_RECEIVED | 🔒 | 🔒 | 🔒 | 🔒 | ✏️ | Partial | ✏️ | ✏️ |
| RECEIVED | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✏️ | ✏️ | ✏️ |
| PARTIALLY_INVOICED | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✏️ | ✏️ | ✏️ |
| INVOICED | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | Limited | ✏️ | ✏️ |
| COMPLETED | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | Admin only | ✏️ |
| CANCELLED | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | Admin only | ✏️ |

**Enforcement**: `ProcurementDomainService.EDITABLE_FIELDS_BY_STATUS` constant + `check_field_editability()` method.

---

## 19. Exception Handling Matrix

| Scenario | System Behavior |
|---------|----------------|
| **Over-receipt** | Blocked if `total_arrived > qty × (1 + tolerance%)`. Tolerance from `po_over_receipt_tolerance` setting (default 5%). Raises `ValidationError`. |
| **Receipt with no barcode** | Allow receipt, emit `BARCODE_MISSING_PURCHASE` workspace task. |
| **Receipt with missing expiry (tracked item)** | Block or quarantine based on org policy. GoodsReceiptLine status → `UNDER_REVIEW`. |
| **Invoice before any receipt** | Blocked for `RECEIVED_QTY` invoice policy (3-way match). Allowed for `ORDERED_QTY` policy (2-way match). |
| **Invoice unit price > allowed variance** | `ThreeWayMatchResult.status = 'PRICE_VARIANCE'`, `payment_blocked = True`. |
| **Supplier declaration < receipt** | `declared_gap` computed property flags discrepancy. Queryable via serializer `discrepancy_summary`. |
| **Duplicate invoice number** | Hard block via unique constraint `(invoice_number, organization)`. DB error. |
| **Receipt in closed fiscal period** | Hard block. `LedgerService.create_journal_entry()` validates `FiscalPeriod.is_closed`. |
| **PO approval missing required approver** | Block transition. `ApprovalPolicy` + `TxnApproval` levels must be satisfied. |
| **Return greater than received qty** | Hard block. `PurchaseReturnLine.clean()` validates `qty_returned ≤ original_line.qty_received`. |
| **Supplier credit note missing for return closure** | Keep return status `CREDIT_PENDING` until linked. |
| **Cross-tenant access** | `TenantManager.get_queryset()` auto-filters. ViewSet `get_queryset()` double-checks `organization_id`. |
| **Budget exceeded** | `ProcurementDomainService.check_budget()` returns warnings. Can be blocking or advisory per org settings. |
| **Price variance vs historical** | `ApprovalRule` with `max_price_variance_percent` condition triggers extra approval level. |

---

## 20. Security / RBAC Matrix

| Action | Required Role/Permission | Notes |
|--------|-------------------------|-------|
| Create Draft PO | Purchaser, Branch Buyer | `pos.add_purchaseorder` |
| Submit PO | Purchaser | `pos.change_purchaseorder` |
| Approve PO | Manager / Finance (per policy) | `ApprovalPolicy` level requirements |
| Send PO | Procurement Officer | `pos.change_purchaseorder` |
| Create Receipt (GRN) | Warehouse Receiver, Store Manager | `inventory.add_goodsreceipt` |
| Approve Over-Receipt Override | Operations Manager / Admin | Manager override PIN required |
| Mark Invoiced | AP Accountant / Finance | `finance.add_invoice` |
| Complete PO | Finance Controller / Procurement Manager | `pos.change_purchaseorder` + final status |
| Create Return | Receiver / Procurement | `pos.add_purchasereturn` |
| Close Return | AP Accountant / Finance | Supplier credit note must be linked |
| Revert to Draft | Manager / Admin only | From SUBMITTED/APPROVED/REJECTED/CANCELLED |
| Cancel PO | Manager / Admin | Requires cancellation reason |
| Configure Approval Policies | Admin | `/settings/procurement-approvals` |
| Configure Budgets | Finance Controller | `/settings/procurement-budgets` |
| Auto-Replenish | Procurement Manager | `pos.run_replenishment` |

---

## 21. Performance Strategy

| Aspect | Strategy |
|--------|----------|
| **QuerySet optimization** | `select_related('supplier', 'site', 'warehouse', 'created_by', 'approved_by')` + `prefetch_related('lines', 'lines__product')` on all list endpoints |
| **Serializer nesting** | Lines nested on `retrieve` only; list returns flat header fields + `line_count` + `receipt_progress` (avoids N+1) |
| **Pagination** | Default `page_size=25` on list, configurable via `useListViewSettings`. Infinite scroll on catalogue modal (`page_size=30`) |
| **Registry merge** | SSR parallel fetch of formal POs + legacy orders via `Promise.all()`, client-side merge sort by `created_at` desc |
| **Dashboard aggregation** | Single DB query: `PurchaseOrder.objects.values('status').annotate(count=Count('id'), total=Sum('total_amount'))` |
| **Intelligence Grid** | `search_enhanced` endpoint uses subquery stock aggregation + pre-computed analytics. Avoids per-product queries |
| **Catalogue modal** | Infinite scroll, debounced search (300ms), client-side rotation filter. Server does heavy filtering |
| **Concurrency safety** | `receive_line/` and `invoice/` use `select_for_update()` on PO lines within atomic transactions |
| **Safe for high-volume** | Indexed endpoints: `dashboard/`, `list/`, `catalogue_list/`. Paginated with DB-level filtering |
| **3-Way Match** | `ThreeWayMatchResult` persisted — avoids recalculation. Match lines created lazily on invoice |

---

## 22. Integration Contract Map

| Module | Integration Point | Direction | Mechanism |
|--------|-------------------|-----------|-----------|
| **Inventory** | `StockService.receive_stock()` | POS → Inventory | Gated import via `_safe_import()` |
| **Inventory** | `GoodsReceipt` / `GoodsReceiptLine` | POS → Inventory | FK `purchase_order`, `po_line`. Created by `ProcurementDomainService.receive()` |
| **Inventory** | `Inventory`, `InventoryMovement`, `ProductBatch` | POS → Inventory | Direct write on `quick_purchase` |
| **Finance** | `LedgerService.create_journal_entry()` | POS → Finance | Gated import, posting rules resolution |
| **Finance** | `Invoice`, `InvoiceLine` | POS → Finance | Created by `invoice_po()`, FK `source_order` |
| **Finance** | `TransactionSequence.next_value()` | POS → Finance | PO/GRN/REQ number generation |
| **CRM** | `Contact` (SUPPLIER type) | POS ← CRM | FK `supplier`, `linked_account_id` for AP |
| **CRM** | `ProductSupplier`, `SupplierPriceHistory` | POS → CRM | Sourcing intelligence updates |
| **Tax Engine** | `TaxEngineContext`, `TaxCalculator` | POS ← Finance | VAT, AIRSI, cost views |
| **Workspace** | `trigger_purchasing_event()` | POS → Workspace | Fire-and-forget via `emit_events()`, never blocks |
| **Products** | `Product.cost_price` update | POS → Inventory | Updated on `quick_purchase` per-line |
| **Branch/Site** | `Warehouse` hierarchy | POS → Inventory | Site-scoped POs, branch-scoped GRNs (auto-derived) |
| **Approval** | `ApprovalPolicy` + `TxnApproval` | POS ← Kernel | Policy resolution in `resolve_approval_policy()` |
| **Budget** | `ProcurementBudget` + `BudgetCommitment` | POS ↔ POS | Commit on approval, release on cancel |

### Procurement Accounting Policy Map

| Operation | Debit | Credit | Posting Rule Keys |
|-----------|-------|--------|-------------------|
| **Receipt (accrual)** | `purchases.inventory` (Stock) | `suspense.reception` (GRNI) | Via `ProcurementDomainService._post_receipt_accrual()` |
| **Invoice (3-way matched)** | `suspense.reception` (GRNI) + `purchases.vat_recoverable` | `purchases.payable` (AP) | Via `PurchaseService.invoice_po()` |
| **Quick purchase (immediate)** | `purchases.inventory` + `purchases.vat_recoverable` | `purchases.payable` (AP) | Via `PurchaseService.quick_purchase()` |
| **Immediate payment** | `purchases.payable` (AP) | Cash / Bank account | Via `quick_purchase()` initial payment |
| **Landed cost** | `purchases.inventory` (Stock) | Freight/Customs AP | Via `LandedCost` allocation |
| **Purchase return** | `purchases.payable` / Return clearing | `purchases.inventory` (Stock) | Via `ReturnsService` |
| **Damaged receipt** | `expenses.inventory_loss` | `purchases.inventory` / GRNI | Per org damage policy |

---

## 23. Enterprise Procurement Architecture (11/10 Target)

### Domain Structure

```
Procurement Core Domain (ProcurementDomainService)
├─ Requisition Engine        [PurchaseRequisition + PurchaseRequisitionLine]
├─ RFQ / Comparison Engine   [SupplierQuotation + SupplierQuotationLine]
├─ Purchase Order Engine     [PurchaseOrder + PurchaseOrderLine]
├─ Goods Receipt Engine      [GoodsReceipt + GoodsReceiptLine] (inventory module)
├─ Invoice / 3-Way Match     [ThreeWayMatchResult + ThreeWayMatchLine + DisputeCase]
├─ Return to Vendor Engine   [PurchaseReturn + PurchaseReturnLine] (existing)
├─ Vendor Performance Engine [SupplierPerformanceSnapshot]
├─ Budget / Approval Engine  [ProcurementBudget + BudgetCommitment + kernel ApprovalPolicy]
└─ Procurement Analytics     [Dashboard endpoint + SupplierPerformanceSnapshot]
```

### Service Architecture

```
services/
├── procurement_domain_service.py    # Unified orchestration (NEW)
├── purchase_service.py              # Legacy quick_purchase + invoice_po (existing)
├── three_way_match_service.py       # 3-way match validation (existing, hardened)
├── returns_service.py               # Sales + purchase returns (existing)
├── replenishment_service.py         # Auto-replenishment engine (existing)
├── pos_service.py                   # POS terminal operations (existing)
├── analytics_service.py             # Sales analytics (existing)
├── accounting_poster.py             # Sales accounting (existing)
├── reconciliation_service.py        # Payment reconciliation (existing)
├── workflow_service.py              # Sales workflow (existing)
└── permission_service.py            # Permission checks (existing)
```

### New Model Index

| Model | Table | Module | Purpose |
|-------|-------|--------|---------|
| `ThreeWayMatchResult` | `three_way_match_result` | pos | Persisted match outcomes (MATCHED/DISPUTED/VARIANCE) |
| `ThreeWayMatchLine` | `three_way_match_line` | pos | Per-line ordered/declared/received/invoiced comparison |
| `DisputeCase` | `dispute_case` | pos | Formal procurement dispute tracking with resolution workflow |
| `PurchaseRequisition` | `purchase_requisition` | pos | Internal purchase request (upstream of RFQ/PO) |
| `PurchaseRequisitionLine` | `purchase_requisition_line` | pos | Product lines within a requisition |
| `SupplierQuotation` | `supplier_quotation` | pos | Procurement-side quote from supplier |
| `SupplierQuotationLine` | `supplier_quotation_line` | pos | Product lines within a supplier quote |
| `ProcurementBudget` | `procurement_budget` | pos | Budget envelope for spending control |
| `BudgetCommitment` | `budget_commitment` | pos | Links PO to budget with committed/released amounts |
| `SupplierPerformanceSnapshot` | `supplier_performance_snapshot` | pos | Periodic vendor scorecard (weighted metrics) |

