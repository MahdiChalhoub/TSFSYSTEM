# Supplier Portal Documentation

## Goal
Provide a dedicated supplier-facing portal for managing purchase orders, proformas, price change requests, and notifications. Completely separate from the client storefront.

## Architecture
The supplier portal lives at `/supplier-portal/[slug]/` and uses its own localStorage session (separate from client portal). Authentication goes through `SupplierPortalLoginView` which validates `SupplierPortalAccess`.

## Data Flow

### READ from
| Page | Endpoint | Description |
|------|----------|-------------|
| Dashboard stats | `GET /api/supplier-portal/dashboard/` | Auth required |
| Purchase Orders | `GET /api/supplier-portal/my-orders/` | Auth required |
| Proformas | `GET /api/supplier-portal/my-proformas/` | Auth required |
| Price Requests | `GET /api/supplier-portal/my-price-requests/` | Auth required |
| Notifications | `GET /api/supplier-portal/my-notifications/` | Auth required |

### SAVE to
| Action | Endpoint | Method |
|--------|----------|--------|
| Login | `POST /api/supplier-portal/auth/login/` | POST |
| Create proforma | `POST /api/supplier-portal/my-proformas/` | POST |
| Submit price request | `POST /api/supplier-portal/my-price-requests/` | POST |

## User Variables
- **Email** — Supplier login credential
- **Password** — Supplier login credential
- **Proforma notes** — Description for new proforma
- **Valid until** — Proforma expiry date
- **Product name** — Price request target product
- **Current price** — Existing price for the product
- **Proposed price** — Requested new price
- **Reason** — Justification for price change

## Workflow

### Supplier Login
1. Supplier navigates to `/supplier-portal/[slug]`
2. Enters email and password
3. System validates via `SupplierPortalLoginView`:
   - Checks user exists and password matches
   - Validates `SupplierPortalAccess.status == ACTIVE`
   - Validates slug matches the contact's organization
4. Token issued, session stored in localStorage
5. Dashboard displayed with stats and navigation

### Purchase Orders
1. Supplier views POs at `/supplier-portal/[slug]/orders`
2. POs are created by the buyer (admin), not the supplier
3. Supplier can view PO details, line items, delivery dates
4. Status tracking: DRAFT → SENT → CONFIRMED → IN_TRANSIT → RECEIVED

### Proformas
1. Supplier creates proformas at `/supplier-portal/[slug]/proformas`
2. Sets validity date and notes
3. Can add line items after creation (via admin endpoint)
4. Submits proforma for buyer review
5. Status flow: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED

### Price Change Requests
1. Supplier submits at `/supplier-portal/[slug]/price-requests`
2. Enters product name, current price, proposed price, reason
3. Buyer reviews and responds (approve/reject/counter-offer)
4. Status flow: PENDING → APPROVED/REJECTED/COUNTER_OFFER

## Frontend Files
- `src/app/supplier-portal/[slug]/page.tsx` — Login + Dashboard
- `src/app/supplier-portal/[slug]/orders/page.tsx` — Purchase Orders
- `src/app/supplier-portal/[slug]/proformas/page.tsx` — Proformas
- `src/app/supplier-portal/[slug]/price-requests/page.tsx` — Price Requests

## Backend Files
- `erp_backend/apps/supplier_portal/models.py` — SupplierPortalAccess, SupplierProforma, PriceChangeRequest
- `erp_backend/apps/supplier_portal/views.py` — SupplierPortalLoginView + ViewSets
- `erp_backend/apps/supplier_portal/urls.py` — Auth + router URLs
