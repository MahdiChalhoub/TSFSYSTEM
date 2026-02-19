# Client Gate Module Documentation

## Overview
**Module**: Client Gate (Client Community Portal)
**Backend**: `apps/client_portal/`
**Frontend Actions**: `src/app/actions/client-portal/index.ts`
**Admin Pages**: Under `(privileged)/workspace/client-*`

**Goal**: Full client portal — eCommerce, wallet, loyalty, order tracking, support tickets, POS barcode identification.

---

## Pages

### 1. Client Access Management (`/workspace/client-access`)
- **Goal**: Admin grants/revokes portal access with granular permissions
- **Read**: `client-portal/client-access/` API
- **Save**: POST to `client-access/`, `activate/`, `suspend/`, `revoke/`, `set_permissions/`, `generate_barcode/`
- **Variables**: Contact (CUSTOMER), User, status, permissions[], barcode
- **Workflow**: Select customer → Create access → Activate (auto-creates wallet + barcode) → Set permissions → Monitor
- **Key Feature**: Barcode generation for POS scanning identification

### 2. Client Orders Review (`/workspace/client-orders`)
- **Goal**: Admin manages the lifecycle of client eCommerce orders
- **Read**: `client-portal/admin-orders/` API
- **Save**: POST to `confirm/`, `process/`, `ship/`, `deliver/`, `cancel/`
- **Variables**: Order status, payment status, delivery info, ratings
- **Workflow**: PLACED → Confirm → Process → Ship (set ETA) → Deliver | Cancel (auto-refund wallet)

### 3. Client Tickets (`/workspace/client-tickets`)
- **Goal**: Admin reviews and resolves client support tickets
- **Read**: `client-portal/admin-tickets/` API
- **Save**: POST to `assign/`, `resolve/`, `close/`, `reopen/`
- **Variables**: Ticket type, priority, status, resolution notes, satisfaction rating
- **Workflow**: OPEN → Assign agent → Resolve (add notes) → Close | Reopen

---

## Database Tables

### `client_portal_access`
| Column | Type | Purpose |
|--------|------|---------|
| contact | FK → Contact | Customer link |
| user | FK → User | Login account |
| status | CHAR | PENDING/ACTIVE/SUSPENDED/REVOKED |
| permissions | JSON | Array of permission codes |
| barcode | CHAR | POS scanning identifier |
| granted_by | FK → User | Admin who granted access |

### `client_wallet`
| Column | Type | Purpose |
|--------|------|---------|
| contact | FK → Contact | Owner |
| balance | DECIMAL | Current wallet balance |
| loyalty_points | INT | Redeemable points |
| lifetime_points | INT | Total points ever earned |
| currency | CHAR | Wallet currency |

### `wallet_transaction`
| Column | Type | Purpose |
|--------|------|---------|
| wallet | FK → ClientWallet | Parent wallet |
| transaction_type | CHAR | CREDIT/DEBIT |
| amount | DECIMAL | Transaction amount |
| balance_after | DECIMAL | Balance after transaction |
| reason | CHAR | Description |
| reference_type | CHAR | Source (ClientOrder, LoyaltyRedemption, POSChange, etc.) |

### `client_order`
| Column | Type | Purpose |
|--------|------|---------|
| order_number | CHAR | Auto-generated CLO-YYMMDD-XXXXXX |
| contact | FK → Contact | Client |
| status | CHAR | CART/PLACED/CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED/RETURNED |
| payment_status | CHAR | UNPAID/PAID/PARTIAL/REFUNDED |
| delivery_address | TEXT | Delivery destination |
| total_amount | DECIMAL | Calculated total |
| wallet_amount | DECIMAL | Amount paid from wallet |
| pos_order | FK → Order | Linked POS order if converted |
| delivery_rating | INT | 1-5 star rating |

### `client_order_line`
| Column | Type | Purpose |
|--------|------|---------|
| order | FK → ClientOrder | Parent order |
| product | FK → Product | Inventory product |
| product_name | CHAR | Snapshot name |
| quantity | DECIMAL | Ordered quantity |
| unit_price | DECIMAL | Unit price at time of order |
| line_total | DECIMAL | Auto-calculated |

### `client_ticket`
| Column | Type | Purpose |
|--------|------|---------|
| ticket_number | CHAR | Auto-generated TKT-YYMMDD-XXXXXX |
| contact | FK → Contact | Client |
| ticket_type | CHAR | GENERAL/ORDER_ISSUE/DELIVERY_PROBLEM/RETURN_REQUEST/PRODUCT_FEEDBACK/COMPLAINT/SUGGESTION |
| status | CHAR | OPEN/IN_PROGRESS/WAITING_CLIENT/RESOLVED/CLOSED |
| priority | CHAR | LOW/NORMAL/HIGH/URGENT |
| assigned_to | FK → User | Support agent |
| satisfaction_rating | INT | 1-5 star rating |

---

## API Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `client-portal/client-access/` | Admin: manage client portal access | Admin |
| `client-portal/admin-orders/` | Admin: review/manage client orders | Admin |
| `client-portal/admin-tickets/` | Admin: handle support tickets | Admin |
| `client-portal/admin-wallets/` | Admin: manage client wallets | Admin |
| `client-portal/order-lines/` | Admin: manage order lines | Admin |
| `client-portal/dashboard/` | Client: dashboard metrics | ClientUser |
| `client-portal/my-orders/` | Client: own orders + cart | ClientUser |
| `client-portal/my-wallet/` | Client: wallet + loyalty | ClientUser |
| `client-portal/my-tickets/` | Client: support tickets | ClientUser |

---

## Permission System

| Permission | Description |
|-----------|-------------|
| `VIEW_ORDER_HISTORY` | View past orders |
| `PLACE_ORDERS` | Create eCommerce orders |
| `VIEW_WALLET` | View wallet and loyalty balances |
| `REDEEM_LOYALTY` | Convert loyalty points to wallet credit |
| `SUBMIT_TICKETS` | Create support tickets |
| `VIEW_CATALOG` | Browse product catalog |

---

## Signals & Automation

| Trigger | Action |
|---------|--------|
| Order DELIVERED | Auto-award loyalty points (1 point per currency unit) |
| Order DELIVERED | Auto-create wallet if none exists |
| Order CANCELLED | Auto-refund wallet balance |
| Access ACTIVATED | Auto-create wallet + barcode |
