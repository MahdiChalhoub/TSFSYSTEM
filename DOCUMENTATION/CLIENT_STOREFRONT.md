# Client Storefront Documentation

## Goal
Provide a configurable, multi-mode eCommerce storefront for clients (B2C, B2B, Catalog+Quote, Hybrid), with full shopping cart, checkout, account management, and portal authentication.

## Architecture

### Store Modes (per-organization)
| Mode | Pricing | Checkout | Description |
|------|---------|----------|-------------|
| `B2C` | Retail prices for all | Standard eCommerce | Standard online store |
| `B2B` | Tier/negotiated prices | Approval-gated | Wholesale portal |
| `CATALOG_QUOTE` | Prices hidden | Quote request | Browse-only catalog |
| `HYBRID` | B2C default, B2B for tier clients | Standard + approval | Default mode |

### Configuration
The `ClientPortalConfig` model stores per-org settings:
- `store_mode` — Controls pricing logic and checkout behavior
- `show_stock_levels` — Show exact quantities vs In Stock/Out of Stock
- `allow_guest_browsing` — Allow unauthenticated catalog browsing
- `require_approval_for_orders` — Orders need admin approval (B2B)
- `storefront_title` / `storefront_tagline` — Custom branding

## Data Flow

### READ from
| Page | Endpoint | Description |
|------|----------|-------------|
| Storefront config | `GET /api/client-portal/storefront/config/?slug=` | Public, no auth |
| Dashboard | `GET /api/client-portal/dashboard/` | Auth required |
| Orders | `GET /api/client-portal/my-orders/` | Auth required |
| Wallet | `GET /api/client-portal/my-wallet/` | Auth required |
| Tickets | `GET /api/client-portal/my-tickets/` | Auth required |
| Quote Request | `POST /api/client-portal/quote-request/` | Optional auth |

### SAVE to
| Action | Endpoint | Method |
|--------|----------|--------|
| Login | `POST /api/client-portal/auth/login/` | POST |
| Create order | `POST /api/client-portal/my-orders/` | POST |
| Add to cart | `POST /api/client-portal/my-orders/{id}/add_to_cart/` | POST |
| Place order | `POST /api/client-portal/my-orders/{id}/place_order/` | POST |
| Create ticket | `POST /api/client-portal/my-tickets/` | POST |
| Submit quote | `POST /api/client-portal/quote-request/` | POST |

## User Variables
- **Email** — Client login credential
- **Password** — Client login credential
- **Delivery address** — Checkout delivery form
- **Phone number** — Checkout delivery form
- **Delivery notes** — Optional checkout notes
- **Payment method** — WALLET / CASH / CARD
- **Cart items** — Products added to cart (localStorage)
- **Ticket type** — GENERAL / ORDER_ISSUE / DELIVERY_PROBLEM / etc.
- **Ticket subject** — Support ticket subject
- **Ticket description** — Support ticket description

## Workflow

### Shopping Flow
1. Client visits `/tenant/[slug]`
2. Browses catalog (StorefrontCatalog component)
3. Clicks "Client Portal Login" → enters email/password
4. System validates via `ClientPortalLoginView` (checks `ClientPortalAccess.status == ACTIVE`)
5. Token + session stored in localStorage, user card appears
6. Client adds products to cart → cart persisted in localStorage
7. Navigates to `/tenant/[slug]/cart` → reviews items, adjusts quantities
8. Proceeds to `/tenant/[slug]/checkout`:
   - Step 1: Enter delivery details
   - Step 2: Choose payment method
   - Step 3: Review order summary
   - Step 4: Place order → success confirmation
9. Order created via backend API, cart cleared

### Quote Request (CATALOG_QUOTE mode)
1. Client navigates to `/tenant/[slug]/quote`
2. Enters contact info (name, email, phone, company)
3. Adds line items manually or imports from cart
4. Submits message with additional requirements
5. System sends quote request to organization

### Account Management
- `/tenant/[slug]/account` — Dashboard with stats, POS barcode
- `/tenant/[slug]/account/orders` — Order history with status tracking
- `/tenant/[slug]/account/wallet` — Balance, loyalty points, transactions
- `/tenant/[slug]/account/tickets` — Support tickets, create new tickets

## Frontend Files
- `src/app/tenant/[slug]/quote/page.tsx` — Quote request form
- `src/context/PortalContext.tsx` — Auth state, cart, config management
- `src/components/tenant/ClientPortalLogin.tsx` — Login CTA / form / user card
- `src/app/tenant/[slug]/layout.tsx` — PortalProvider wrapper
- `src/app/tenant/[slug]/cart/page.tsx` — Shopping cart
- `src/app/tenant/[slug]/checkout/page.tsx` — Multi-step checkout
- `src/app/tenant/[slug]/account/page.tsx` — Account dashboard
- `src/app/tenant/[slug]/account/orders/page.tsx` — Order history
- `src/app/tenant/[slug]/account/wallet/page.tsx` — Wallet & loyalty
- `src/app/tenant/[slug]/account/tickets/page.tsx` — Support tickets
- `src/app/tenant/[slug]/actions.ts` — Server actions (10+ storefront API helpers)

## Backend Files
- `erp_backend/apps/client_portal/models.py` — ClientPortalConfig with store_mode
- `erp_backend/apps/client_portal/views.py` — ClientPortalLoginView, StorefrontPublicConfigView
- `erp_backend/apps/client_portal/urls.py` — Auth + router URLs
