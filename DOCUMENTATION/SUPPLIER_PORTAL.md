# Supplier Portal Documentation

## Purpose
The supplier portal provides external suppliers with a self-service interface to manage their relationship with the buying organization. Suppliers can view purchase orders, submit proformas, request price changes, review financial statements, manage notifications, and update their profile.

## Access
- URL: `/supplier-portal/[slug]`
- Authentication: Email/password login with localStorage session
- Session stored as `supplier_session` in localStorage
- Session validates against organization slug

## Pages

### 1. Login & Dashboard (`/supplier-portal/[slug]`)
- **Goal**: Authenticate supplier and display overview
- **Data READ**: `GET /api/supplier-portal/auth/login/` (POST), `GET /api/supplier-portal/dashboard/`
- **Variables**: email, password, session stats
- **Workflow**: Login → store session → show stats (Active POs, Total POs, Pending Proformas, Price Requests) + 4 nav cards

### 2. Purchase Orders (`/supplier-portal/[slug]/orders`)
- **Goal**: List all purchase orders directed to this supplier
- **Data READ**: `GET /api/supplier-portal/my-orders/`
- **Variables**: orders list, status filter
- **Workflow**: Fetch orders → display with PO number, status badge, line count, ETA, total amount

### 3. Proformas (`/supplier-portal/[slug]/proformas`)
- **Goal**: Create and manage quotations sent to buyer
- **Data READ**: `GET /api/supplier-portal/my-proformas/`
- **Data SAVED**: `POST /api/supplier-portal/my-proformas/`
- **Variables**: notes, valid_until date
- **Workflow**: View list + "New Proforma" button → inline create form → submit → refresh list

### 4. Price Change Requests (`/supplier-portal/[slug]/price-requests`)
- **Goal**: Request price adjustments for products
- **Data READ**: `GET /api/supplier-portal/my-price-requests/`
- **Data SAVED**: `POST /api/supplier-portal/my-price-requests/`
- **Variables**: product_name, current_price, proposed_price, reason
- **Workflow**: View requests with status + buyer response. Create new with product, prices, reason

### 5. Financial Statement (`/supplier-portal/[slug]/statement`)
- **Goal**: View payable/receivable ledger
- **Data READ**: `GET /api/supplier-portal/my-statement/`
- **Variables**: date_from, date_to filters
- **Workflow**: Summary cards (Total Invoiced, Total Paid, Outstanding) → date filter → ledger table

### 6. Notifications (`/supplier-portal/[slug]/notifications`)
- **Goal**: View supplier notifications (orders, proformas, payments, system)
- **Data READ**: `GET /api/supplier-portal/notifications/`
- **Data SAVED**: `POST /api/supplier-portal/notifications/{id}/read/`, `POST /api/supplier-portal/notifications/mark-all-read/`
- **Variables**: filter (All/Unread), notification list
- **Workflow**: Filter → click to mark read → Mark All Read button

### 7. Profile & Settings (`/supplier-portal/[slug]/profile`)
- **Goal**: Manage contact information and password
- **Data SAVED**: `POST /api/supplier-portal/profile/update/`, `POST /api/supplier-portal/profile/change-password/`
- **Variables**: name, company, currentPassword, newPassword, confirmPassword
- **Workflow**: Edit name/company → Save. Change password with 8-char minimum + confirmation

## Layout
- Sidebar navigation (7 items): Dashboard, Purchase Orders, Proformas, Price Requests, Statement, Notifications, Profile
- Mobile: hamburger menu with slide-out sidebar
- Session expired fallback → redirect to login
- Indigo/blue color theme (vs emerald for client portal)

## Frontend Files
- `src/app/supplier-portal/[slug]/page.tsx` — Login + Dashboard
- `src/app/supplier-portal/[slug]/layout.tsx` — Sidebar layout with session management
- `src/app/supplier-portal/[slug]/orders/page.tsx` — Purchase orders list
- `src/app/supplier-portal/[slug]/proformas/page.tsx` — Proformas list + create
- `src/app/supplier-portal/[slug]/price-requests/page.tsx` — Price requests + create
- `src/app/supplier-portal/[slug]/statement/page.tsx` — Financial statement + date filter
- `src/app/supplier-portal/[slug]/notifications/page.tsx` — Notification inbox
- `src/app/supplier-portal/[slug]/profile/page.tsx` — Profile & password settings
