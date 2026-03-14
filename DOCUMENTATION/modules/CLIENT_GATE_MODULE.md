# Client Gate Module — Documentation

## Goal
The Client Gate module provides a client-facing portal for eCommerce order management,
digital wallet / loyalty points, and support ticketing — **all configurable per organization**.

## Per-Organization Configuration (`ClientPortalConfig`)

Each organization gets its own configuration (auto-created on first use).  
Admin page: **Workspace → Client Gate → Portal Config**

### Configurable Settings

| Section | Setting | Default | Description |
|---------|---------|---------|-------------|
| **Loyalty** | `loyalty_enabled` | ✅ true | Enable/disable loyalty system |
| | `loyalty_earn_rate` | 1.0 | Points earned per 1 currency unit |
| | `loyalty_redemption_ratio` | 100 | Points needed for 1 currency unit |
| | `loyalty_min_redeem` | 100 | Minimum points to redeem |
| | `loyalty_max_redeem_percent` | 50% | Max % of order payable with points |
| **Wallet** | `wallet_enabled` | ✅ true | Enable/disable wallet |
| | `wallet_currency` | USD | Wallet currency code |
| | `wallet_auto_create` | ✅ true | Auto-create on client activation |
| | `wallet_max_balance` | 999999 | Max wallet balance |
| **Delivery** | `default_delivery_fee` | 0.00 | Default delivery fee |
| | `free_delivery_threshold` | 0.00 | Order amount for free delivery |
| **Tickets** | `tickets_enabled` | ✅ true | Enable/disable tickets |
| | `enabled_ticket_types` | [] (all) | Which ticket types are available |
| | `auto_assign_tickets` | ❌ false | Auto-assign new tickets |
| | `default_ticket_assignee` | null | Default agent for auto-assign |
| **eCommerce** | `ecommerce_enabled` | ✅ true | Allow order placement |
| | `min_order_amount` | 0.00 | Minimum order subtotal |
| | `allow_wallet_payment` | ✅ true | Allow paying with wallet |

---

## Pages

### 1. Portal Config (`/workspace/portal-config`)
- **Goal**: Configure loyalty/wallet/delivery/tickets/eCommerce per organization
- **Reads**: `client_portal_config` (via `GET /api/client-portal/config/current/`)
- **Writes**: `client_portal_config` (via `PATCH /api/client-portal/config/{id}/`)
- **Variables**: All 20+ config fields in sections (Loyalty, Wallet, Delivery, Tickets, eCommerce)
- **Workflow**: Admin opens page → config auto-created with defaults → edit fields → Save

### 2. Client Access (`/workspace/client-access`)
- **Goal**: Grant, manage, and monitor client portal access
- **Reads**: `client_portal_access` (`GET /api/client-portal/client-access/`)
- **Writes**: `client_portal_access` (create, activate, suspend, revoke, set_permissions, generate_barcode)
- **Variables**: contact, user, status, permissions, barcode
- **Workflow**: Admin creates access → Reviews pending → Activates (auto-generates barcode, auto-creates wallet per config)

### 3. Client Orders (`/workspace/client-orders`)
- **Goal**: Review and manage client eCommerce orders
- **Reads**: `client_order` (`GET /api/client-portal/admin-orders/`)
- **Writes**: `client_order` (confirm, process, ship, deliver, cancel)
- **Variables**: order_number, status, payment_status, total_amount, delivery_fee (from config)
- **Workflow**: Order PLACED → Confirm → Process → Ship → Deliver (auto-awards loyalty per config earn rate)

### 4. Client Tickets (`/workspace/client-tickets`)
- **Goal**: Handle customer support tickets
- **Reads**: `client_ticket` (`GET /api/client-portal/admin-tickets/`)
- **Writes**: `client_ticket` (assign, resolve, close, reopen)
- **Variables**: ticket_number, type, status, priority, assigned_to, satisfaction_rating
- **Workflow**: Ticket OPEN → Assign (auto if config) → IN_PROGRESS → Resolve → Close

---

## Database Tables

### `client_portal_config`
- **Purpose**: Per-organization portal settings
- **Columns**: loyalty_enabled, loyalty_earn_rate, loyalty_redemption_ratio, loyalty_min_redeem, loyalty_max_redeem_percent, wallet_enabled, wallet_currency, wallet_auto_create, wallet_max_balance, default_delivery_fee, free_delivery_threshold, tickets_enabled, enabled_ticket_types, auto_assign_tickets, default_ticket_assignee, ecommerce_enabled, min_order_amount, allow_wallet_payment, organization, created_at, updated_at
- **Relationships**: FK to Organization, FK to User (default_ticket_assignee)
- **Read by**: Portal Config page, all views (signals, wallet, orders, tickets)
- **Written by**: Portal Config page

### `client_portal_access`
- **Purpose**: Links CRM Contact (CUSTOMER) to User with permissions
- **Columns**: contact, user, status, permissions (JSONField), barcode, granted_by, granted_at, last_login
- **Relationships**: 1:1 Contact, 1:1 User, FK granted_by User
- **Read by**: Client Access page, Dashboard, all client-side views
- **Written by**: Client Access page

### `client_wallet`
- **Purpose**: Digital currency balance and loyalty points
- **Columns**: contact, balance, loyalty_points, lifetime_points, currency, is_active
- **Relationships**: 1:1 Contact
- **Read by**: Wallet page, Dashboard, Order placement
- **Written by**: Order delivery (auto-loyalty), Manual credit/debit, Point redemption

### `wallet_transaction`
- **Purpose**: Audit log of all wallet credits/debits
- **Columns**: wallet, transaction_type, amount, balance_after, reason, reference_type, reference_id
- **Relationships**: FK to ClientWallet
- **Read by**: Wallet transactions page
- **Written by**: Any wallet credit/debit operation

### `client_order`
- **Purpose**: eCommerce orders with lifecycle
- **Columns**: order_number, contact, status, payment_status, payment_method, delivery_*, subtotal, tax_amount, discount_amount, delivery_fee, total_amount, wallet_amount, loyalty_points_used, currency, pos_order
- **Relationships**: FK Contact, FK POS Order (optional)
- **Read by**: Orders page, Dashboard
- **Written by**: Cart operations, Order placement, Admin lifecycle actions

### `client_order_line`
- **Purpose**: Line items for orders
- **Columns**: order, product, product_name, quantity, unit_price, tax_rate, discount_percent, line_total, tax_amount
- **Relationships**: FK ClientOrder, FK Product (optional)
- **Read by**: Order detail view
- **Written by**: Add-to-cart action

### `client_ticket`
- **Purpose**: Customer support tickets
- **Columns**: ticket_number, contact, ticket_type, status, priority, subject, description, related_order, assigned_to, resolution_notes, resolved_at, satisfaction_rating, satisfaction_feedback
- **Relationships**: FK Contact, FK ClientOrder (optional), FK User (assigned_to)
- **Read by**: Tickets page, Dashboard
- **Written by**: Ticket creation, Admin resolve/close/reopen

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/client-portal/config/` | List/create portal configs |
| GET | `/api/client-portal/config/current/` | Get current org's config |
| PATCH | `/api/client-portal/config/{id}/` | Update config |
| GET/POST | `/api/client-portal/client-access/` | Manage access |
| POST | `/api/client-portal/client-access/{id}/activate/` | Activate |
| POST | `/api/client-portal/client-access/{id}/suspend/` | Suspend |
| POST | `/api/client-portal/client-access/{id}/revoke/` | Revoke |
| POST | `/api/client-portal/client-access/{id}/set_permissions/` | Set perms |
| POST | `/api/client-portal/client-access/{id}/generate_barcode/` | Gen barcode |
| GET | `/api/client-portal/admin-orders/` | List orders |
| POST | `/api/client-portal/admin-orders/{id}/confirm/` | Confirm |
| POST | `/api/client-portal/admin-orders/{id}/process/` | Process |
| POST | `/api/client-portal/admin-orders/{id}/ship/` | Ship |
| POST | `/api/client-portal/admin-orders/{id}/deliver/` | Deliver |
| POST | `/api/client-portal/admin-orders/{id}/cancel/` | Cancel |
| GET | `/api/client-portal/admin-tickets/` | List tickets |
| POST | `/api/client-portal/admin-tickets/{id}/assign/` | Assign |
| POST | `/api/client-portal/admin-tickets/{id}/resolve/` | Resolve |
| POST | `/api/client-portal/admin-tickets/{id}/close/` | Close |
| POST | `/api/client-portal/admin-tickets/{id}/reopen/` | Reopen |
| GET | `/api/client-portal/admin-wallets/` | List wallets |
| POST | `/api/client-portal/admin-wallets/{id}/manual_credit/` | Credit |
| POST | `/api/client-portal/admin-wallets/{id}/manual_debit/` | Debit |

---

## Permissions

| Code | Description |
|------|-------------|
| `VIEW_ORDER_HISTORY` | View past orders |
| `PLACE_ORDERS` | Place eCommerce orders |
| `VIEW_WALLET` | View wallet & loyalty |
| `REDEEM_LOYALTY` | Redeem loyalty points |
| `SUBMIT_TICKETS` | Submit support tickets |
| `VIEW_CATALOG` | Browse product catalog |

---

## Automation Signals

| Trigger | Action | Config Used |
|---------|--------|-------------|
| ClientOrder → DELIVERED | Award loyalty points | `loyalty_earn_rate` |
| ClientPortalAccess → ACTIVE | Auto-create wallet | `wallet_auto_create`, `wallet_currency` |
| ClientTicket created | Auto-assign to agent | `auto_assign_tickets`, `default_ticket_assignee` |
