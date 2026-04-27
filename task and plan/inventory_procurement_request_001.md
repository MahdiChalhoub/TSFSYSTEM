# Inventory — "Request Purchase / Transfer" from Product List

Plan ID: `inventory_procurement_request_001`
Module: `inventory` (frontend) + `pos` (existing `ProcurementRequest` model) + `erp` (config endpoint)
Created: 2026-04-27

## Goal

Replace the dead "Request Purchase" / "Request Transfer" buttons on the inventory products list with a real flow that:

1. Opens a dialog (default Phase 1) — or one-click instant create / cart accumulator (Phase 3) — based on a per-tenant setting.
2. Pre-fills suggested quantity from the active `PurchaseAnalyticsConfig` (`proposed_qty_lead_days × proposed_qty_safety_multiplier × avg_daily_sales`).
3. Creates a `ProcurementRequest` (existing model at `apps/pos/models/procurement_request_models.py`) and toasts a link to `/inventory/requests`.
4. Tracks the request lifecycle on the product itself via a new `procurement_status` field with the user-defined transitions:
   `AVAILABLE → REQUESTED → PO_SENT → PO_ACCEPTED → IN_TRANSIT → AVAILABLE | FAILED`.

The product list shows `procurement_status` as a separate badge from the existing `Product.status` lifecycle (ACTIVE/INACTIVE/DRAFT/ARCHIVED) — they are orthogonal concerns.

## Existing infrastructure (verified)

- `ProcurementRequest` model — `apps/pos/models/procurement_request_models.py:12`. Types TRANSFER/PURCHASE, statuses PENDING/APPROVED/REJECTED/EXECUTED/CANCELLED.
- POST endpoint — `procurement-requests/` (registered in `apps/pos/urls.py:51`).
- Server action — `createProcurementRequest` at `src/app/actions/commercial/procurement-requests.ts`.
- Settings page — `/settings/purchase-analytics` with `PurchaseAnalyticsConfig` (sales_avg_period_days, proposed_qty_lead_days, proposed_qty_safety_multiplier, proposed_qty_formula) stored as a JSON blob in `Organization.settings['purchase_analytics_config']`.
- Backend config endpoint — `erp/views_system.py:561` (`purchase-analytics-config` action).
- Existing requests UI — `/inventory/requests/page.tsx` (uses `OperationalRequest`, a separate but related model — Phase 2 will reconcile).

## Phase 1 — Dialog flow + setting (~1.5h)

### Backend
1. `erp/views_system.py:561+` — accept `request_flow_mode` in the config payload (`'INSTANT' | 'DIALOG' | 'CART'`, default `'DIALOG'`). No migration; field lives in the JSON blob.

### Frontend types
2. `src/app/actions/settings/purchase-analytics-config.ts` — add `request_flow_mode` to `PurchaseAnalyticsConfig` interface + `DEFAULTS`.

### New shared dialog
3. `src/components/products/RequestProductDialog.tsx` — reusable dialog. Props: `open`, `onClose`, `requestType: 'PURCHASE' | 'TRANSFER'`, `products: { id: number; name: string; reorder_quantity?: number; min_stock_level?: number }[]`, `onCreated?(): void`. Renders: list of products with a suggested-qty input per row, priority dropdown, reason textarea. Suggested qty (Phase 1 placeholder): `product.reorder_quantity ?? (product.min_stock_level × config.proposed_qty_safety_multiplier) ?? 1`. Submit creates one ProcurementRequest per product via `createProcurementRequest`. Toast on success with link to `/inventory/requests`.

### Wire buttons
4. `src/app/(privileged)/inventory/products/manager.tsx:310,320` — replace `window.location.href = ...` with dialog opens (single-product and bulk-action).
5. `src/app/(privileged)/inventory/products/_components/ProductDetailCards.tsx:52` — same.
6. `src/app/(privileged)/inventory/products/_components/ProductRow.tsx:123` — same.

### Settings page
7. `src/app/(privileged)/settings/purchase-analytics/page.tsx` — add a small "Request Flow" section with 3 toggle buttons (Instant / Dialog / Cart), defaulted from `request_flow_mode`. Saves via `savePurchaseAnalyticsConfig`. Phase 1 only honors DIALOG; INSTANT and CART will be wired in Phase 3 (button is disabled with a "Coming soon" hint).

### Tests / smoke
- `npx tsc --noEmit` clean
- Manual: click each of 4 buttons, fill dialog, submit, verify request appears at `/inventory/requests`

### Out of scope for Phase 1
- `procurement_status` field on Product (Phase 2)
- INSTANT and CART flows (Phase 3)
- Honest avg_daily_sales-based suggested qty (Phase 2 — needs a backend endpoint)
- Supplier/warehouse selection in the dialog (deferred — request review screen handles them)

## Phase 2 — Lifecycle status (DONE 2026-04-27)

**Implemented as a derived SerializerMethodField, not a stored field.** No migration needed; always accurate.

- `procurement_status` on `ProductSerializer` reads the latest `ProcurementRequest` for the product (gated import, isolation rule).
- Lifecycle map:
  - PENDING / APPROVED → `REQUESTED`
  - EXECUTED + linked `source_po` → follows the PO state (DRAFT/SUBMITTED/APPROVED/SENT/CONFIRMED → `PO_SENT`; IN_TRANSIT/PARTIALLY_RECEIVED → `IN_TRANSIT`; RECEIVED+/INVOICED+/COMPLETED → `NONE`; REJECTED/CANCELLED → `FAILED`)
  - EXECUTED without PO → `PO_SENT`
  - REJECTED → `FAILED`
  - No recent request → fall back to direct-PO check (any open `PurchaseOrderLine` for this product)
- Frontend `procurement` column added to `ProductColumns.tsx` (defaultVisible: true). Combines stock tier (Out of Stock / Low Stock / Available from `on_hand_qty` vs `min_stock_level`) with the lifecycle label, e.g. `Low Stock · Requested`.
- "Procurement" cell added to the Stock card in `ProductDetailCards.tsx`.

## Phase 2.5 — Honest qty + Convert-to-PO (DONE 2026-04-27)

- Backend `procurement-requests/suggest-quantity/?product_id=N` action. Reads `purchase_analytics_config`, computes `avg_daily_sales` from `InventoryMovement` over `sales_avg_period_days`, returns `avg × lead × safety`. Falls back through `reorder_quantity` → `min_stock × safety` → `1` when no sales history. Returns reason + raw inputs for transparency.
- Backend `procurement-requests/{id}/convert-to-po/` action. Builds a draft `PurchaseOrder` + line (uses `req.suggested_unit_price` falling back to `product.cost_price_ht`, applies `product.tva_rate`), links `req.source_po`, flips request to EXECUTED, returns `{po_id, po_url}`.
- Frontend `getSuggestedQuantity` server action. Dialog refines its placeholder qty by calling the endpoint per product after the modal opens.
- Frontend `convertProcurementRequestToPO` server action. New "Create PO" button on RequestRow (APPROVED + PURCHASE only) — sends, navigates to the PO detail page on success.

## Phase 3 — Three flows + per-user mode (DONE 2026-04-27)

- `RequestFlowProvider` (`src/components/products/RequestFlowProvider.tsx`) mounted around the products manager via `page.tsx`. Reads `request_flow_mode` from `getPurchaseAnalyticsConfig()` on mount; exposes `trigger(type, products)`, `cart`, `addToCart`, `removeFromCart`, `clearCart`, `submitCart`.
- INSTANT — calls `getSuggestedQuantity` → `createProcurementRequest` immediately. Toast with "View →" link.
- DIALOG — opens the existing `RequestProductDialog`.
- CART — adds to a sticky tray (bottom-right desktop, full-width on mobile <640px). Persists to localStorage (`tsf_request_cart_v1`). Submit creates one request per line.
- Settings page Request Flow card now enables all 3 modes; toggle saves inline (bypasses the global Save button) via `savePurchaseAnalyticsConfig({ request_flow_mode: mode })`. Profile-edit mode keeps the override pattern.

## Deferred (not done this session)

- **Notifications** when a request is created/approved/converted. `NotificationService` exists but needs a `NotificationTemplate` registered.
- **Permission gating** with `@require_permission`. The decorator isn't used in `apps/pos` or `apps/inventory` views — adding it to one endpoint would be inconsistent. Wants a broader RBAC audit first.
- **Backend tests** for `procurement_status` derivation, `suggest_quantity`, `convert_to_po`.
- ~~Mobile product list~~ — audited 2026-04-27, no separate `Mobile*Client.tsx` exists for products. The desktop manager handles all viewports via responsive Tailwind classes. The cart tray is mobile-safe. No follow-up needed.

## Risks

- **Two parallel request systems** — `ProcurementRequest` (apps/pos) and `OperationalRequest` (used by /inventory/requests page). Phase 1 uses `ProcurementRequest` because that's what the existing `createProcurementRequest` action targets. Phase 2 must reconcile (probably: keep `ProcurementRequest` as the single-product quick request, surface it in the existing `/inventory/requests` table).
- **Pre-existing `/purchases/restored/form.tsx` typecheck errors** — unrelated, predates this work.

## Files touched (Phase 1)

NEW
- `src/components/products/RequestProductDialog.tsx`
- `task and plan/inventory_procurement_request_001.md` (this file)

MODIFIED
- `erp_backend/erp/views_system.py`
- `src/app/actions/settings/purchase-analytics-config.ts`
- `src/app/(privileged)/inventory/products/manager.tsx`
- `src/app/(privileged)/inventory/products/_components/ProductDetailCards.tsx`
- `src/app/(privileged)/inventory/products/_components/ProductRow.tsx`
- `src/app/(privileged)/settings/purchase-analytics/page.tsx`
