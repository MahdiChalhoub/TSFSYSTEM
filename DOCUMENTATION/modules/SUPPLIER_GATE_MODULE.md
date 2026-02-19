# Supplier Gate Module Documentation

## Overview

The Supplier Gate module provides a supplier community portal with controlled access to order data, stock levels, and collaborative workflows (proformas, price change requests).

**Module Code:** `supplier_portal`  
**Backend Path:** `erp_backend/apps/supplier_portal/`  
**Frontend Path:** `src/app/(privileged)/workspace/supplier-access|proformas|price-requests/`  
**API Base:** `/api/supplier-portal/`

---

## Pages

### 1. Supplier Access Management (`/workspace/supplier-access`)

**Goal:** Grant, manage, and revoke supplier portal access with granular permissions.

**Data Sources (READ):**
- `supplier_portal_access` — All portal access grants
- `crm.Contact` (type=SUPPLIER) — Available suppliers

**Data Written (SAVE):**
- `supplier_portal_access` — Create, activate, suspend, revoke access; update permissions

**Variables User Interacts With:**
- Supplier contact, linked user account, status (ACTIVE/SUSPENDED/REVOKED/PENDING)
- Permissions: VIEW_OWN_ORDERS, VIEW_OWN_STOCK, VIEW_OWN_STATEMENT, CREATE_PROFORMA, REQUEST_PRICE_CHANGE, VIEW_PRODUCT_PERFORMANCE

**Workflow:**
1. Admin selects a supplier Contact and links to a User account
2. Sets initial permissions via checkbox editor
3. Activates access → supplier can now log in to portal
4. Can suspend/revoke at any time

---

### 2. Proforma Review (`/workspace/proformas`)

**Goal:** Review, approve, reject, or negotiate supplier-submitted proformas. Convert approved proformas to Purchase Orders.

**Data Sources (READ):**
- `supplier_proforma` — All proformas with line items

**Data Written (SAVE):**
- `supplier_proforma` — Status transitions (approve/reject/negotiate/convert)
- `purchase_order` — Auto-created when proforma is converted

**Workflow:**
1. Supplier submits proforma via portal → appears in admin review queue
2. Admin reviews: Approve ✅, Reject ❌ (with reason), or Negotiate 💬 (with counter-proposal)
3. If approved: "Convert to PO" button auto-creates PurchaseOrder with matching line items
4. Supplier is notified of status changes via portal notifications

---

### 3. Price Change Requests (`/workspace/price-requests`)

**Goal:** Review supplier price change proposals. Approve, reject, or send counter-proposals.

**Data Sources (READ):**
- `supplier_price_change_request` — All price change requests

**Data Written (SAVE):**
- `supplier_price_change_request` — Status (approve/reject/counter-propose)
- `supplier_notification` — Auto-created on decision

**Workflow:**
1. Supplier submits price change request (selling or purchase price) via portal
2. Admin sees current→proposed price with % change visualization
3. Admin can: Approve ✅, Reject ❌ (with reason), Counter-propose 🔄 (with counter price)
4. Supplier notified and can accept counter-proposal

---

## Database Tables

| Table | Purpose | Read By | Written By |
|-------|---------|---------|------------|
| `supplier_portal_access` | Links Contact→User with permissions | Access page, all supplier ViewSets | Access page (admin) |
| `supplier_proforma` | Supplier-created proformas (8-state workflow) | Proforma pages | Supplier portal, admin review |
| `supplier_proforma_line` | Line items on proformas | Proforma detail | Supplier portal |
| `supplier_price_change_request` | Price change proposals | Price page | Supplier portal, admin review |
| `supplier_notification` | In-portal notifications | Supplier dashboard | Signals, admin actions |

---

## API Endpoints

| Endpoint | ViewSet | Side | Actions |
|----------|---------|------|---------|
| `/api/supplier-portal/portal-access/` | SupplierPortalAccessViewSet | Admin | CRUD + activate/suspend/revoke/set_permissions |
| `/api/supplier-portal/admin-proformas/` | SupplierProformaAdminViewSet | Admin | CRUD + approve/reject/negotiate/convert_to_po |
| `/api/supplier-portal/admin-price-requests/` | PriceChangeRequestAdminViewSet | Admin | CRUD + approve/reject/counter_propose |
| `/api/supplier-portal/proforma-lines/` | ProformaLineViewSet | Admin | CRUD |
| `/api/supplier-portal/dashboard/` | SupplierDashboardViewSet | Supplier | Aggregated metrics |
| `/api/supplier-portal/my-orders/` | SupplierOrdersViewSet | Supplier | Read-only PO list |
| `/api/supplier-portal/my-stock/` | SupplierStockViewSet | Supplier | Read-only stock levels |
| `/api/supplier-portal/my-proformas/` | SupplierProformaViewSet | Supplier | CRUD + submit/add_line |
| `/api/supplier-portal/my-price-requests/` | SupplierPriceChangeViewSet | Supplier | CRUD + accept_counter |
| `/api/supplier-portal/my-notifications/` | SupplierNotificationViewSet | Supplier | List + mark_read/mark_all_read |

---

## Permission System

| Permission Code | Description |
|----------------|-------------|
| `VIEW_OWN_ORDERS` | See their POs and order history |
| `VIEW_OWN_STOCK` | See stock levels of their products |
| `VIEW_OWN_STATEMENT` | See their financial statement |
| `CREATE_PROFORMA` | Propose new proformas |
| `REQUEST_PRICE_CHANGE` | Propose price adjustments |
| `VIEW_PRODUCT_PERFORMANCE` | See evaluation/sell-through metrics |

---

## Signal Engine

- **Proforma status change** → auto-creates `SupplierNotification` (via `post_save` signal)
- **PO status change** → call `notify_po_status_to_supplier(po)` from PO lifecycle hooks
- **Price request decision** → auto-creates `SupplierNotification` (in ViewSet action)
