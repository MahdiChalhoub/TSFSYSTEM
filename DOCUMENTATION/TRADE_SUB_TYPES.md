# Trade Sub-Types (Sales & Purchase Decomposition)

## Goal
Decompose sales and purchase transactions into sub-categories for better margin analysis, supplier negotiation tracking, and financial reporting.

## Feature Toggle
- **Per-Organization**: Controlled via `Organization.settings.enable_trade_sub_types` (boolean)
- **Default**: Disabled — all invoices default to `RETAIL`, POs default to `STANDARD`
- **When Enabled**: Sub-type dropdowns, filter pills, and table columns appear on Invoices and Purchase Orders pages

## Sales Sub-Types (Invoice)
| Sub-Type | Code | Description |
|----------|------|-------------|
| Retail | `RETAIL` | Standard retail sale to end consumers (normal margin) |
| Wholesale | `WHOLESALE` | Bulk sale to resellers/distributors (lower margin, higher volume) |
| Consignee | `CONSIGNEE` | Goods on consignment — revenue on actual sale (variable margin) |

## Purchase Sub-Types (Purchase Order)
| Sub-Type | Code | Description |
|----------|------|-------------|
| Standard | `STANDARD` | Regular purchase at market price |
| Wholesale | `WHOLESALE` | Bulk purchase at discounted unit cost → better margins downstream |
| Consignee | `CONSIGNEE` | Goods received on consignment — paid only when sold (lower risk) |

## Data Model

### Invoice (`finance.Invoice`)
- **Field**: `sub_type` (CharField, max_length=20)
- **Choices**: RETAIL, WHOLESALE, CONSIGNEE (sales) + STANDARD, WHOLESALE, CONSIGNEE (purchase)
- **Default**: `RETAIL`
- **Read from**: Invoices page, Invoice detail, reports
- **Written by**: Invoice create form, API

### Purchase Order (`pos.PurchaseOrder`)
- **Field**: `purchase_sub_type` (CharField, max_length=20)
- **Choices**: STANDARD, WHOLESALE, CONSIGNEE
- **Default**: `STANDARD`
- **Read from**: Purchase Orders page, PO detail
- **Written by**: PO create form, API

### Organization Settings
- **Field**: `settings` (JSONField) → key `enable_trade_sub_types`
- **Read from**: Invoice page, PO page (to show/hide sub-type UI)
- **Written by**: Settings page, API

## API Endpoints

### Filtering
- `GET /api/invoices/?sub_type=WHOLESALE` — filter invoices by sub-type
- `GET /api/purchase-orders/?purchase_sub_type=WHOLESALE` — filter POs by sub-type

### Creating
- `POST /api/invoices/` → include `sub_type` in body
- `POST /api/purchase-orders/` → include `purchase_sub_type` in body

## Frontend Files
- `src/app/(privileged)/finance/invoices/page.tsx` — Invoice page with sub-type filter pills + table column + badge
- `src/app/(privileged)/purchases/page.tsx` — PO page with sub-type table column + badge
- `src/app/actions/finance/invoices.ts` — Invoice server actions (sub_type param)
- `src/app/actions/purchases/purchase-orders.ts` — PO server actions (purchase_sub_type param)
- `src/app/actions/settings/trade-settings.ts` — Trade settings read/write

## Backend Files
- `erp_backend/apps/finance/invoice_models.py` — Invoice.sub_type field
- `erp_backend/apps/pos/purchase_order_models.py` — PurchaseOrder.purchase_sub_type field
- `erp_backend/apps/finance/views.py` — InvoiceViewSet sub_type filtering
- `erp_backend/apps/pos/views.py` — PurchaseOrderViewSet purchase_sub_type filtering

## Workflow
1. Admin enables "Trade Sub-Types" in Organization settings
2. Users see sub-type dropdowns when creating invoices/POs
3. Sub-type badges appear in tables (Retail=slate, Wholesale=amber, Consignee=purple)
4. Filter pills allow quick filtering by sub-type
5. Wholesale purchases flag better unit costs → higher margins in reports
