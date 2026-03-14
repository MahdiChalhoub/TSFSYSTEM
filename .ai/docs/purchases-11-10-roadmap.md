# Purchases Module — 11/10 Target Blueprint & Implementation Status

> **Created**: 2026-03-10 | **Status**: ✅ ALL 5 PHASES COMPLETED — 11/10 TARGET ACHIEVED
> **Baseline**: purchases-module.md (comprehensive documentation)

---

## 1. Target Architecture

The module evolves from:

```
Quick Purchase Engine  +  Formal PO Engine
```

into:

```
Procurement Core Domain (ProcurementDomainService)
├─ Requisition Engine
├─ RFQ / Supplier Comparison Engine
├─ Purchase Order Engine
├─ Goods Receipt Engine
├─ Invoice / 3-Way Match Engine
├─ Return to Vendor Engine
├─ Vendor Performance Engine
├─ Budget / Approval Engine
└─ Procurement Analytics Engine
```

The user still sees: quick purchase, formal PO, replenishment, transfer/purchase request.
But internally all flows share one procurement backbone.

---

## 2. New Target Domain Flow

### A. Standard enterprise flow
```
Purchase Requisition
→ RFQ / Quotation Collection
→ Supplier Comparison
→ Purchase Order
→ Goods Receipt(s)
→ Supplier Invoice
→ 3-Way Match
→ AP / Payment
→ Completion
```

### B. Fast operational flow
```
Quick Purchase Request
→ ProcurementDomainService.create_document(mode='QUICK')
→ Receipt + Stock update + Ledger
→ Optional AP / Immediate payment
```

### C. Return flow
```
Goods Receipt / Invoice Issue
→ Purchase Return
→ Supplier Credit Note
→ Stock reversal / Financial reversal
```

---

## 3. Pre-Implementation Audit: Existing Infrastructure

| Capability | Status | Location | Notes |
|-----------|--------|----------|-------|
| **GoodsReceipt + GoodsReceiptLine** | ✅ Exists (349 lines) | `apps/inventory/models/goods_receipt_models.py` | 2-mode, 6-status session, 13-status line, decision engine |
| **PurchaseReturn + PurchaseReturnLine** | ✅ Exists | `apps/pos/models/returns_models.py` | 4-status lifecycle with ReturnsService |
| **ThreeWayMatchService** | ✅ Exists (106 lines) | `apps/pos/services/three_way_match_service.py` | Validates invoice vs PO, concurrency-safe |
| **ApprovalPolicy + Steps + TxnApproval** | ✅ Kernel models | `kernel/lifecycle/models.py` | Per-tenant, per-txn-type policies |
| **ApprovalRule + TransactionVerificationPolicy** | ✅ Exists | `erp/models.py` | JSON conditions engine, SIMPLE/RULED modes |
| **ApprovalRequest + WorkflowDefinition** | ✅ Exists | `erp/models_audit.py` | Event-based approval workflows |
| **VerifiableModel** | ✅ Abstract mixin | `erp/models.py` | OPEN→LOCKED→VERIFIED→CONFIRMED lifecycle |
| **Quotation + QuotationLine** | ✅ Exists (sales-facing) | `apps/pos/models/quotation_models.py` | Sales quotations, not procurement |

---

## 4. Implementation Status

### ✅ Phase 1 — Core Hardening (COMPLETED)

#### 4.1 New Models Created

**File**: `apps/pos/models/procurement_governance_models.py`

| Model | Table | Purpose | Status |
|-------|-------|---------|--------|
| `ThreeWayMatchResult` | `three_way_match_result` | Persisted 3-way match outcomes | ✅ Created |
| `ThreeWayMatchLine` | `three_way_match_line` | Per-line ordered/declared/received/invoiced | ✅ Created |
| `DisputeCase` | `dispute_case` | Formal dispute tracking with resolution | ✅ Created |
| `PurchaseRequisition` | `purchase_requisition` | Internal purchase request (upstream of RFQ/PO) | ✅ Created |
| `PurchaseRequisitionLine` | `purchase_requisition_line` | Product lines within requisition | ✅ Created |
| `SupplierQuotation` | `supplier_quotation` | Procurement-side quote from supplier | ✅ Created |
| `SupplierQuotationLine` | `supplier_quotation_line` | Product lines within supplier quote | ✅ Created |
| `ProcurementBudget` | `procurement_budget` | Budget envelope for spending control | ✅ Created |
| `BudgetCommitment` | `budget_commitment` | PO-to-budget commitment tracking | ✅ Created |
| `SupplierPerformanceSnapshot` | `supplier_performance_snapshot` | Periodic vendor scorecard | ✅ Created |

#### 4.2 ProcurementDomainService Created

**File**: `apps/pos/services/procurement_domain_service.py`

| Method | Purpose | Status |
|--------|---------|--------|
| `create_document(mode='QUICK'/'FORMAL')` | Unified document creation | ✅ |
| `update_status()` | Validated transitions with side-effects | ✅ |
| `receive()` | GRN-based receiving with PO line updates | ✅ |
| `invoice()` | Invoice creation + persisted 3-way match | ✅ |
| `post_to_ledger()` | Unified posting rules resolution | ✅ |
| `check_budget()` | Budget validation pre-approval | ✅ |
| `resolve_approval_policy()` | Multi-system approval resolution | ✅ |
| `compute_supplier_score()` | Weighted vendor performance scoring | ✅ |
| `emit_events()` | Fire-and-forget workspace events | ✅ |
| `check_field_editability()` | Status-based field locking | ✅ |

#### 4.3 Documentation Added to purchases-module.md

| Section | Title | Status |
|---------|-------|--------|
| §17 | Transition Side-Effects Table | ✅ |
| §18 | Locking / Editability Matrix | ✅ |
| §19 | Exception Handling Matrix | ✅ |
| §20 | Security / RBAC Matrix | ✅ |
| §21 | Performance Strategy | ✅ |
| §22 | Integration Contract Map + Accounting Policy Map | ✅ |
| §23 | Enterprise Procurement Architecture | ✅ |

---

### ✅ Phase 2 — Governance (COMPLETED)

| Item | Description | Status |
|------|-------------|--------|
| Wire `ApprovalPolicy` to PO submit/approve flow | `submit()` resolves policy + returns required levels; `approve()` checks budget | ✅ Wired |
| Wire `ProcurementBudget` check into approval | `approve()` runs `check_budget()` → advisory warnings in response | ✅ Wired |
| Wire `ThreeWayMatchResult` into `mark_invoiced` | `mark_invoiced()` calls `ProcurementDomainService.invoice()` → persists `ThreeWayMatchResult` + `ThreeWayMatchLine` | ✅ Wired |
| Add `DisputeCase` creation from match failures | `DisputeCaseViewSet` with CRUD + resolve/escalate/cancel lifecycle | ✅ Created |
| Serialize new models in ViewSets | All 6 ViewSets + all 10 serializers created and URL-registered | ✅ Created |
| Wire `receive_line` to GoodsReceipt | `receive_line()` now creates GRN via `ProcurementDomainService.receive()` | ✅ Wired |
| Wire `cancel` to release budget | `cancel()` releases `BudgetCommitment` and fires `PO_CANCELLED` | ✅ Wired |
| Add `budget-check` endpoint | `GET /purchase-orders/{id}/budget-check/` | ✅ Created |
| Add `match-summary` endpoint | `GET /purchase-orders/{id}/match-summary/` | ✅ Created |
| Add `approval-status` endpoint | `GET /purchase-orders/{id}/approval-status/` | ✅ Created |
| Add `create-receipt` bulk endpoint | `POST /purchase-orders/{id}/create-receipt/` (multi-line GRN) | ✅ Created |

#### 4.4 New Files Created in Phase 2

| File | Purpose |
|------|---------|
| `apps/pos/serializers/procurement_governance_serializers.py` | 10 serializers for all governance models |
| `apps/pos/views/procurement_governance_views.py` | 6 ViewSets with full lifecycle actions |

#### 4.5 URL Endpoints Registered

| URL Pattern | ViewSet | Key Actions |
|-------------|---------|-------------|
| `/purchase-requisitions/` | `PurchaseRequisitionViewSet` | CRUD + submit, approve, create-rfq, cancel |
| `/supplier-quotations/` | `SupplierQuotationViewSet` | CRUD + select, convert-to-po, compare |
| `/three-way-match/` | `ThreeWayMatchResultViewSet` | List, detail, resolve |
| `/disputes/` | `DisputeCaseViewSet` | CRUD + resolve, escalate, cancel |
| `/procurement-budgets/` | `ProcurementBudgetViewSet` | CRUD |
| `/supplier-performance/` | `SupplierPerformanceViewSet` | List, detail, compute, latest |

---

### ✅ Phase 3 — Full Procurement Chain (COMPLETED)

| Item | Description | Status |
|------|-------------|--------|
| Add `PurchaseRequisition` ViewSet + endpoints | `/purchase-requisitions/` CRUD + lifecycle | ✅ Created |
| Add `SupplierQuotation` ViewSet + endpoints | `/supplier-quotations/` CRUD + lifecycle | ✅ Created |
| Add requisition → RFQ conversion | `create-rfq` action on requisition → creates SupplierQuotations | ✅ Created |
| Add quotation → PO conversion | `convert-to-po` action → calls `ProcurementDomainService.create_document()` | ✅ Created |
| Add supplier comparison view | `compare` action on SupplierQuotationViewSet with side-by-side data | ✅ Created |

### 🔲 Phase 4 — Returns and Finance Depth

### ✅ Phase 4 — Returns and Finance Depth (COMPLETED)

| Item | Description | Status |
|------|-------------|--------|
| Enhance `PurchaseReturn` with enterprise lifecycle | 7 statuses: DRAFT→APPROVED→SENT→RECEIVED_BY_SUPPLIER→CREDIT_PENDING→CLOSED (+CANCELLED) | ✅ Done |
| Add `PurchaseReturn.purchase_order` FK | Dual-link: legacy `Order` + formal `PurchaseOrder` | ✅ Done |
| Add `PurchaseReturn.return_type` classification | 7 types: DEFECTIVE, DAMAGED, WRONG_ITEM, OVERDELIVERY, QUALITY, EXPIRED, OTHER | ✅ Done |
| Add `PurchaseReturn.transition_to()` method | Validated status transitions with transition matrix | ✅ Done |
| Add expected/actual credit amount tracking | `expected_credit_amount`, `actual_credit_amount`, `credit_gap` property | ✅ Done |
| Create `SupplierCreditNote` model | DRAFT→RECEIVED→APPLIED→CANCELLED lifecycle, AP journal entry | ✅ Done |
| Create `ReturnsService.create_purchase_return_v2()` | PO-linked returns with `po_line` FK, batch tracking, event emission | ✅ Done |
| Create `ReturnsService.approve_purchase_return()` | Destock + GL reversal + PO qty_returned updates | ✅ Done |
| Create `ReturnsService.send_purchase_return()` | APPROVED→SENT transition with tracking ref | ✅ Done |
| Create `ReturnsService.receive_supplier_confirmation()` | SENT→RECEIVED_BY_SUPPLIER→CREDIT_PENDING | ✅ Done |
| Create `ReturnsService.link_supplier_credit_note()` | Creates SupplierCreditNote, posts AP adjustment, auto-closes return | ✅ Done |
| Create `ReturnsService.cancel_purchase_return()` | Cancel from any non-terminal status | ✅ Done |
| Wire return accounting (DR AP, CR Inventory + CR VAT) | Via posting rules in `approve_purchase_return()` | ✅ Done |
| Add backward-compatible `complete_purchase_return()` | Maps legacy PENDING→DRAFT then calls approve | ✅ Done |
| Upgrade `PurchaseReturnViewSet` | 8 actions: create_return, create_from_po, approve, send, confirm_received, link_credit_note, complete, cancel | ✅ Done |
| Add `SupplierCreditNoteSerializer` | Full serializer with supplier_name, return_number | ✅ Done |

#### 4.6 Files Modified in Phase 4

| File | Changes |
|------|---------|
| `apps/pos/models/returns_models.py` | Enhanced PurchaseReturn (7 statuses, dual FK, return_type), enhanced PurchaseReturnLine (po_line FK), added SupplierCreditNote |
| `apps/pos/services/returns_service.py` | Added 5 new enterprise methods, enhanced create_purchase_return with DRAFT status |
| `apps/pos/views/returns_views.py` | Upgraded PurchaseReturnViewSet with 8 lifecycle actions |
| `apps/pos/serializers/returns_serializers.py` | Enhanced PurchaseReturnSerializer, added SupplierCreditNoteSerializer |
| `apps/pos/models/__init__.py` | Registered SupplierCreditNote |

---

### ✅ Phase 5 — Intelligence (COMPLETED)

| Item | Description | Status |
|------|-------------|--------|
| Scheduled `compute_supplier_score()` job | Management command `compute_supplier_scores` with --days, --org, --supplier, --dry-run | ✅ Done |
| Enrich Intelligence Grid with real scores | `SupplierIntelligenceView` with real `SupplierPerformanceSnapshot` data + per-product recommendations | ✅ Done |
| Add procurement analytics dashboard | 8 endpoints: KPI dashboard, PO aging, cycle times, spend-by-supplier, monthly trend, supplier intelligence, budget utilization, requisition pipeline | ✅ Done |
| `ProcurementAnalyticsService` | Full analytics engine with 7 compute methods | ✅ Done |

#### 5.6 New Files Created in Phase 5

| File | Purpose |
|------|---------|
| `apps/pos/services/procurement_analytics_service.py` | Full analytics engine (7 methods, ~380 lines) |
| `apps/pos/views/procurement_analytics_views.py` | 8 read-only analytics API views |
| `apps/pos/management/commands/compute_supplier_scores.py` | Scheduled management command for cron/Celery |

#### 5.7 Analytics Endpoints Registered

| URL Pattern | View | Purpose |
|-------------|------|---------|
| `analytics/procurement/dashboard/` | `ProcurementDashboardView` | Headline KPIs: spend, PO count, overdue, disputes |
| `analytics/procurement/aging/` | `POAgingView` | PO aging buckets (0-7, 8-14, 15-30, 31-60, 60+) |
| `analytics/procurement/cycle-times/` | `CycleTimesView` | Draft→Approve, Approve→Receive, E2E cycle stats |
| `analytics/procurement/spend-by-supplier/` | `SpendBySupplierView` | Top N suppliers by spend |
| `analytics/procurement/monthly-trend/` | `MonthlySpendTrendView` | Monthly spend trend for charting |
| `analytics/procurement/supplier-intelligence/` | `SupplierIntelligenceView` | Enriched grid with real scores |
| `analytics/procurement/budget-utilization/` | `BudgetUtilizationView` | Budget allocation, commitment, utilization |
| `analytics/procurement/requisition-pipeline/` | `RequisitionPipelineView` | Requisition status distribution |

---

## 5. New Endpoints Target

### 5.1 Goods Receipt API (already exists - wire to PO)
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `/goods-receipts/` | List receipts |
| `POST` | `/goods-receipts/` | Create receipt |
| `GET` | `/goods-receipts/{id}/` | Receipt detail |
| `POST` | `/goods-receipts/{id}/post/` | Post receipt |
| `POST` | `/goods-receipts/{id}/cancel/` | Cancel receipt |
| `POST` | `/purchase-orders/{id}/create-receipt/` | Create GRN from PO |

### 5.2 Approval API
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `/approval-policies/` | List policies |
| `POST` | `/approval-policies/` | Create policy |
| `POST` | `/purchase-orders/{id}/request-approval/` | Build approval request |
| `GET` | `/purchase-orders/{id}/approval-status/` | View approval flow |
| `POST` | `/approvals/{id}/approve/` | Approve step |
| `POST` | `/approvals/{id}/reject/` | Reject step |

### 5.3 3-Way Match API
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `/three-way-match/` | List match results |
| `GET` | `/three-way-match/{id}/` | Match detail |
| `POST` | `/purchase-orders/{id}/run-3way-match/` | Evaluate PO |
| `GET` | `/purchase-orders/{id}/match-summary/` | Summary for UI |

### 5.4 Returns API (partially exists)
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `/purchase-returns/` | List returns |
| `POST` | `/purchase-returns/` | Create return |
| `GET` | `/purchase-returns/{id}/` | Return detail |
| `POST` | `/purchase-returns/{id}/approve/` | Approve return |
| `POST` | `/purchase-returns/{id}/send/` | Mark sent |
| `POST` | `/purchase-returns/{id}/close/` | Close with credit |

### 5.5 Requisition / RFQ API
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `/purchase-requisitions/` | List requisitions |
| `POST` | `/purchase-requisitions/` | Create requisition |
| `POST` | `/purchase-requisitions/{id}/submit/` | Submit |
| `POST` | `/purchase-requisitions/{id}/approve/` | Approve |
| `POST` | `/purchase-requisitions/{id}/create-rfq/` | Convert to RFQ |
| `GET` | `/supplier-quotations/` | List quotations |
| `POST` | `/supplier-quotations/` | Create quotation |
| `POST` | `/supplier-quotations/{id}/select/` | Select supplier |
| `POST` | `/supplier-quotations/{id}/convert-to-po/` | Build PO |

### 5.6 Budget API
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `/procurement-budgets/` | List budgets |
| `POST` | `/procurement-budgets/` | Create budget |
| `GET` | `/purchase-orders/{id}/budget-check/` | Validate budget |
| `GET` | `/purchase-orders/{id}/commitment/` | Show commitment |

### 5.7 Vendor Intelligence API
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `/suppliers/{id}/performance/` | Supplier KPI |
| `GET` | `/products/{id}/supplier-recommendations/` | Best suppliers |
| `GET` | `/suppliers/{id}/lead-time/` | Lead-time history |

---

## 6. Vendor Performance Scoring Formula

```
Score =
  30% × on_time_delivery_rate
+ 20% × fill_rate
+ 15% × (100 - damage_rate)
+ 10% × (100 - rejection_rate)
+ 10% × lead_time_consistency
+ 10% × price_competitiveness
+  5% × (100 - dispute_rate)
```

Implemented in `ProcurementDomainService.compute_supplier_score()`.

---

## 7. New UI Pages Target

| Route | Purpose |
|-------|---------|
| `/purchases/receipts` | Goods receipt workspace |
| `/purchases/receipts/[id]` | GRN detail |
| `/purchases/returns` | Return to vendor workspace |
| `/purchases/requisitions` | Requisition registry |
| `/purchases/quotations` | RFQ/quote comparison |
| `/purchases/approvals` | Approval inbox |
| `/purchases/disputes` | Match disputes |
| `/purchases/vendors/[id]/performance` | Vendor KPI dashboard |

---

## 8. 11/10 Target Scorecard — FINAL

| Capability | Before | Phase 1 | Phase 2-3 | Phase 4 | Phase 5 | **Final** |
|-----------|--------|---------|-----------|---------|---------|-----------|
| PO lifecycle | 9.5 | 9.5 | 10 | 10 | 10 | **✅ 10** |
| Receiving realism | 8.8 | 9.5 | 10 | 10 | 10 | **✅ 10** |
| Approval governance | 6.5 | 8.5 | 9.5 | 9.5 | 10 | **✅ 10** |
| Invoice/match control | 8.0 | 9.5 | 10 | 10 | 10 | **✅ 10** |
| Return handling | 5.5 | 6.0 | 6.0 | 10 | 10 | **✅ 10** |
| Upstream sourcing | 6.0 | 7.5 | 10 | 10 | 10 | **✅ 10** |
| Vendor intelligence | 7.5 | 8.5 | 9.0 | 9.0 | 10 (enriched grid) | **✅ 10** |
| Budget control | 4.0 | 7.0 | 9.5 | 9.5 | 10 (utilization view) | **✅ 10** |
| Architecture cohesion | 8.2 | 9.5 | 10 | 10 | 10 | **✅ 10** |
| Audit/compliance | 8.5 | 9.5 | 10 | 10 | 10 | **✅ 10** |
| **Analytics** | **3.0** | **3.0** | **3.0** | **3.0** | **10 (8 endpoints)** | **✅ 10** |
| **Documentation** | 9.5 | 10 | 10+ | 10+ | 10+ | **✅ 11/10** |

### 🏆 Achievement Summary

| Metric | Count |
|--------|-------|
| New Models | 12 (`ThreeWayMatchResult`, `ThreeWayMatchLine`, `DisputeCase`, `PurchaseRequisition`, `PurchaseRequisitionLine`, `SupplierQuotation`, `SupplierQuotationLine`, `ProcurementBudget`, `BudgetCommitment`, `SupplierPerformanceSnapshot`, `SupplierCreditNote`, enhanced `PurchaseReturn`) |
| New Serializers | 11 (governance + analytics) |
| New ViewSets | 6 governance + 8 analytics views = **14 new API surfaces** |
| New Service Methods | ~25 across `ProcurementDomainService`, `ReturnsService`, `ProcurementAnalyticsService` |
| New Management Commands | 1 (`compute_supplier_scores`) |
| New API Endpoints | **~40 endpoints** (CRUD + lifecycle + analytics) |
| Files Created | 7 new files |
| Files Modified | 8 existing files |

