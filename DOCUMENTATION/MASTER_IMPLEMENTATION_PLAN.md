# HMZ ERP — Master Implementation Plan

> **Purpose**: Persistent master plan for closing ALL gaps between the HMZ ERP presentation and the actual codebase.
> **Source Analysis**: [gap_analysis.md] — 81 actual models vs 257 claimed, 9 apps vs 24 claimed.
> **Created**: 2026-02-19
> **Last Updated**: 2026-02-19

---

## Phase 1: Core Business Completeness 🔴 CRITICAL (2-3 weeks)

### 1.1 Dedicated Invoice Model
- [x] Backend: Invoice Model (`apps/finance/invoice_models.py`) — Status lifecycle, FNE/ZATCA fields, multi-currency
- [x] Backend: InvoiceLine Model
- [x] Backend: Invoice Serializer, ViewSet, URLs
- [x] Backend: Auto-Invoice from Sale (in `apps/pos/services.py`)
- [x] Frontend: Invoices List, Detail, New pages
- [x] Documentation: `DOCUMENTATION/invoices.md`

### 1.2 Payment Model & Invoice Status Flow
- [ ] Backend: Payment Model (`apps/finance/payment_models.py`) — 6 methods, allocation logic
- [ ] Backend: PaymentAllocation Model — Partial payment support
- [ ] Backend: Auto-Status Transition Service — PARTIAL/PAID/OVERDUE detection
- [ ] Frontend: Record Payment Dialog, Payment History
- [ ] Documentation: `DOCUMENTATION/payments.md`

### 1.3 Purchase Order Workflow (10-state lifecycle)
- [ ] Backend: PurchaseOrder Model (`apps/pos/purchase_order_models.py`) — 10 states, 20+ paths
- [ ] Backend: PurchaseOrderLine Model
- [ ] Backend: PO State Machine with transition validation
- [ ] Backend: PO ViewSet with lifecycle actions
- [ ] Frontend: PO List, Detail with State Transitions, New PO
- [ ] Documentation: `DOCUMENTATION/purchase_orders.md`

### 1.4 Stock Alerts & Reorder Points
- [ ] Backend: Add `min_stock_level`, `max_stock_level`, `reorder_point`, `reorder_quantity` to Product
- [ ] Backend: StockAlert Model (`apps/inventory/alert_models.py`)
- [ ] Backend: Stock Alert Service
- [ ] Frontend: Stock Alerts Dashboard Widget, Low Stock Report
- [ ] Documentation: `DOCUMENTATION/stock_alerts.md`

---

## Phase 2: Infrastructure 🟠 HIGH (1-2 weeks)

### 2.1 Celery Integration
- [ ] Backend: `erp_backend/celery.py` — App configuration
- [ ] Backend: `erp_backend/erp/tasks.py` — Overdue invoice checker, low stock alerts, backup, log cleanup
- [ ] Backend: Celery Beat schedule in settings.py
- [ ] Backend: Add celery & redis to requirements.txt
- [ ] Deployment: Worker & beat startup scripts
- [ ] Documentation: `DOCUMENTATION/background_processing.md`

### 2.2 Multi-Channel Notification Engine
- [ ] Backend: Enhance Notification model with channels (IN_APP/EMAIL/SMS/PUSH)
- [ ] Backend: NotificationTemplate Model
- [ ] Backend: NotificationPreference Model
- [ ] Backend: Email Delivery Service (SMTP/SendGrid)
- [ ] Frontend: Notification Preferences Page
- [ ] Documentation: `DOCUMENTATION/notifications.md`

---

## Phase 3: Module Enrichment 🟡 MEDIUM (2-3 weeks)

### 3.1 CRM Enhancement
- [ ] Backend: Customer Analytics fields on Contact (lifetime_value, avg_order_value, etc.)
- [ ] Backend: Auto-compute via signals on Order completion
- [ ] Backend: Loyalty Program Service (earn/burn/tiers)
- [ ] Frontend: Enhanced Customer Profile, Loyalty Dashboard
- [ ] Documentation: `DOCUMENTATION/crm.md`

### 3.2 Supplier Enhancement
- [ ] Backend: 5-type ratings, performance metrics, EU reverse charge fields on Contact
- [ ] Backend: Auto-update performance on PO state changes
- [ ] Frontend: Supplier Scorecard Page
- [ ] Documentation: `DOCUMENTATION/suppliers.md`

### 3.3 Category Auto-Computed Fields
- [ ] Backend: Add `level`, `full_path`, `products_count`, `barcode_sequence` to Category
- [ ] Backend: Override save() to compute
- [ ] Frontend: Category Tree with counts
- [ ] Documentation: update `DOCUMENTATION/inventory.md`

### 3.4 Warehouse Location System
- [ ] Backend: WarehouseZone, Aisle, Rack, Shelf, Bin models (`apps/inventory/location_models.py`)
- [ ] Backend: ProductLocation model, location coding system
- [ ] Frontend: Warehouse Layout, Location Assignment
- [ ] Documentation: update `DOCUMENTATION/inventory.md`

### 3.5 HR Expansion
- [ ] Backend: Department, Attendance, Leave, Shift models
- [ ] Frontend: Attendance, Leave Requests, Department Tree pages
- [ ] Documentation: `DOCUMENTATION/hr.md`

---

## Phase 4: Integrations 🔵 FUTURE (3-4 weeks)

### 4.1 Payment Gateway — Stripe
- [ ] Backend: Stripe gateway (`apps/finance/gateways/stripe_gateway.py`)
- [ ] Backend: Gateway Config Model (encrypted API keys per tenant)
- [ ] Frontend: Stripe Checkout Component
- [ ] Documentation: `DOCUMENTATION/payment_gateways.md`

### 4.2 E-commerce Sync
- [ ] Backend: Shopify/WooCommerce connector (product sync, order import)
- [ ] Frontend: Integration Settings Page
- [ ] Documentation: `DOCUMENTATION/integrations.md`

### 4.3 ZATCA/FNE E-Invoicing
- [ ] Backend: FNE Certification Service, ZATCA Service
- [ ] Frontend: FNE Status on Invoice Pages
- [ ] Documentation: `DOCUMENTATION/e_invoicing.md`

### 4.4 Report Builder
- [ ] Backend: ReportDefinition Model, Dynamic Query Builder, PDF/Excel export
- [ ] Backend: Celery Task for Scheduled Reports
- [ ] Frontend: Report Builder UI, Report Library
- [ ] Documentation: `DOCUMENTATION/reports.md`

---

## Progress Tracking

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 1.1 Invoice Model | ⬜ Not Started | — | — |
| 1.2 Payment Tracking | ⬜ Not Started | — | — |
| 1.3 Purchase Order | ⬜ Not Started | — | — |
| 1.4 Stock Alerts | ⬜ Not Started | — | — |
| 2.1 Celery | ⬜ Not Started | — | — |
| 2.2 Notifications | ⬜ Not Started | — | — |
| 3.1 CRM | ⬜ Not Started | — | — |
| 3.2 Suppliers | ⬜ Not Started | — | — |
| 3.3 Categories | ⬜ Not Started | — | — |
| 3.4 Warehouse | ⬜ Not Started | — | — |
| 3.5 HR | ⬜ Not Started | — | — |
| 4.1 Stripe | ⬜ Not Started | — | — |
| 4.2 E-commerce | ⬜ Not Started | — | — |
| 4.3 ZATCA/FNE | ⬜ Not Started | — | — |
| 4.4 Reports | ⬜ Not Started | — | — |
