# CRM + Portal Implementation Master Plan
**Project:** TSFSYSTEM ERP — Full CRM with Client & Supplier Portals
**Start Date:** 2026-03-06
**Estimated Duration:** 3-4 weeks
**Status:** 🚀 READY TO START

---

## 🎯 Project Scope

Build comprehensive frontend for:

1. **CRM Module** (Admin-facing)
   - Contacts management (customers, suppliers, leads)
   - Customer analytics & loyalty programs
   - Supplier scorecards & performance tracking
   - Pricing rules & price groups

2. **Client Portal** (Customer-facing)
   - Dashboard with Statement of Account
   - Wallet & Loyalty Points management
   - Order history & invoice downloads
   - Coupons & promotions
   - Ecommerce storefront integration
   - Support tickets & quotes

3. **Supplier Portal** (Supplier-facing)
   - Dashboard with Statement of Account
   - Product catalog view
   - Proforma invoice creation & management
   - Purchase order tracking
   - Price change requests
   - Performance metrics & notifications

---

## 📊 Backend Audit (Already Complete!)

| Feature | Backend Model | API Endpoint | Status |
|---------|---------------|--------------|--------|
| **CRM Contacts** | `Contact` | `/api/crm/contacts/` | ✅ Complete |
| **Contact Analytics** | Built-in | `/api/crm/contacts/{id}/summary/` | ✅ Complete |
| **Loyalty System** | `Contact.loyalty_points` | `/api/crm/contacts/{id}/loyalty/` | ✅ Complete |
| **Supplier Scorecard** | Contact ratings | `/api/crm/contacts/{id}/scorecard/` | ✅ Complete |
| **Price Rules** | `ClientPriceRule` | `/api/crm/price-rules/` | ✅ Complete |
| **Client Portal Access** | `ClientPortalAccess` | `/api/client-portal/access/` | ✅ Complete |
| **Client Wallet** | `ClientWallet` | `/api/client-portal/wallet/` | ✅ Complete |
| **Wallet Transactions** | `WalletTransaction` | Built-in | ✅ Complete |
| **Coupons** | `Coupon`, `CouponUsage` | `/api/client-portal/coupons/` | ✅ Complete |
| **Client Orders** | `ClientOrder` | `/api/client-portal/orders/` | ✅ Complete |
| **Quote Requests** | `QuoteRequest` | `/api/client-portal/quotes/` | ✅ Complete |
| **Support Tickets** | `ClientTicket` | `/api/client-portal/tickets/` | ✅ Complete |
| **Product Reviews** | `ProductReview` | `/api/client-portal/reviews/` | ✅ Complete |
| **Wishlist** | `WishlistItem` | `/api/client-portal/wishlist/` | ✅ Complete |
| **Promotions** | `CartPromotion` | `/api/client-portal/promotions/` | ✅ Complete |
| **Shipping Rates** | `ShippingRate` | `/api/client-portal/shipping/` | ✅ Complete |
| **Supplier Portal Access** | `SupplierPortalAccess` | `/api/supplier-portal/access/` | ✅ Complete |
| **Proforma Invoices** | `SupplierProforma` | `/api/supplier-portal/proformas/` | ✅ Complete |
| **Price Change Requests** | `PriceChangeRequest` | `/api/supplier-portal/price-requests/` | ✅ Complete |
| **Supplier Notifications** | `SupplierNotification` | `/api/supplier-portal/notifications/` | ✅ Complete |
| **Customer Balance (SOA)** | `CustomerBalance` | `/api/finance/customer-balance/` | ✅ Complete |
| **Supplier Balance (SOA)** | `SupplierBalance` | `/api/finance/supplier-balance/` | ✅ Complete |
| **Payments** | `Payment` | `/api/finance/payments/` | ✅ Complete |

**Result:** 🎉 **ZERO backend work required!** All APIs exist and are production-ready.

---

## 🏗️ Implementation Phases

### **Phase 1: Foundation (Week 1)**

#### 1.1 TypeScript Type Definitions
Create complete type definitions for all entities:

**File:** `src/types/crm.ts`
```typescript
// Contact types
interface Contact {
  id: number
  type: 'CUSTOMER' | 'SUPPLIER' | 'LEAD' | 'PARTNER'
  name: string
  company_name?: string
  email?: string
  phone?: string
  address?: string
  balance: number
  credit_limit: number
  loyalty_points: number
  wallet_balance: number
  customer_tier?: 'STANDARD' | 'VIP' | 'WHOLESALE' | 'RETAIL'
  // Analytics
  total_orders: number
  lifetime_value: number
  average_order_value: number
  first_purchase_date?: string
  last_purchase_date?: string
  // Supplier metrics
  overall_rating: number
  quality_rating: number
  delivery_rating: number
  pricing_rating: number
  service_rating: number
  supplier_category?: 'REGULAR' | 'DEPOT_VENTE' | 'MIXED'
  is_active: boolean
  created_at: string
  updated_at: string
}
```

**File:** `src/types/client-portal.ts`
```typescript
// Client wallet
interface ClientWallet {
  id: number
  balance: number
  loyalty_points: number
  lifetime_points: number
  currency: string
  is_active: boolean
}

interface WalletTransaction {
  id: number
  transaction_type: 'CREDIT' | 'DEBIT'
  amount: number
  balance_after: number
  reason: string
  created_at: string
}

// Coupons
interface Coupon {
  id: number
  code: string
  description: string
  discount_type: 'PERCENT' | 'FIXED'
  value: number
  min_order_amount: number
  max_discount_amount?: number
  max_uses?: number
  used_count: number
  one_per_customer: boolean
  valid_from?: string
  valid_until?: string
  is_active: boolean
}

// Orders
interface ClientOrder {
  id: number
  order_number: string
  status: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  shipping_cost: number
  total_amount: number
  currency: string
  created_at: string
  updated_at: string
  lines: ClientOrderLine[]
}

// Statement of Account
interface CustomerBalance {
  contact: Contact
  current_balance: number
  credit_limit: number
  last_payment_date?: string
  last_invoice_date?: string
}
```

**File:** `src/types/supplier-portal.ts`
```typescript
// Supplier proforma
interface SupplierProforma {
  id: number
  proforma_number: string
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEGOTIATING' | 'CONVERTED'
  supplier: Contact
  expected_delivery_date?: string
  delivery_terms?: string
  currency: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  valid_until?: string
  supplier_notes?: string
  internal_notes?: string
  rejection_reason?: string
  lines: ProformaLine[]
  created_at: string
  updated_at: string
}

interface PriceChangeRequest {
  id: number
  supplier: Contact
  product: Product
  request_type: 'SELLING' | 'PURCHASE'
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COUNTER' | 'ACCEPTED'
  current_price: number
  proposed_price: number
  counter_price?: number
  reason?: string
  review_notes?: string
  effective_date?: string
  created_at: string
}

interface SupplierBalance {
  contact: Contact
  current_balance: number
  last_payment_date?: string
  last_invoice_date?: string
}
```

#### 1.2 API Client Functions
Create API wrapper functions:

**File:** `src/lib/api/crm.ts`
```typescript
import { erpFetch } from '@/lib/erp-fetch'
import type { Contact, ContactSummary, LoyaltyAnalytics, SupplierScorecard } from '@/types/crm'

export const crmAPI = {
  // Contacts
  getContacts: (params?: { type?: string; search?: string; limit?: number }) =>
    erpFetch<Contact[]>('/crm/contacts/', { params }),

  getContact: (id: number) =>
    erpFetch<Contact>(`/crm/contacts/${id}/`),

  createContact: (data: Partial<Contact>) =>
    erpFetch<Contact>('/crm/contacts/', { method: 'POST', body: data }),

  updateContact: (id: number, data: Partial<Contact>) =>
    erpFetch<Contact>(`/crm/contacts/${id}/`, { method: 'PATCH', body: data }),

  deleteContact: (id: number) =>
    erpFetch<void>(`/crm/contacts/${id}/`, { method: 'DELETE' }),

  // Analytics
  getContactSummary: (id: number) =>
    erpFetch<ContactSummary>(`/crm/contacts/${id}/summary/`),

  getLoyaltyAnalytics: (id: number) =>
    erpFetch<LoyaltyAnalytics>(`/crm/contacts/${id}/loyalty/`),

  earnLoyaltyPoints: (id: number, orderTotal: number) =>
    erpFetch(`/crm/contacts/${id}/earn-points/`, {
      method: 'POST',
      body: { order_total: orderTotal }
    }),

  burnLoyaltyPoints: (id: number, points: number) =>
    erpFetch(`/crm/contacts/${id}/burn-points/`, {
      method: 'POST',
      body: { points }
    }),

  // Supplier scorecard
  getSupplierScorecard: (id: number) =>
    erpFetch<SupplierScorecard>(`/crm/contacts/${id}/scorecard/`),

  rateSupplier: (id: number, ratings: {
    quality: number
    delivery: number
    pricing: number
    service: number
  }) =>
    erpFetch(`/crm/contacts/${id}/rate/`, {
      method: 'POST',
      body: ratings
    }),
}
```

**File:** `src/lib/api/client-portal.ts`
**File:** `src/lib/api/supplier-portal.ts`

Similar structure for all portal APIs.

---

### **Phase 2: CRM Module (Week 1-2)**

#### 2.1 CRM Contacts Page
**Route:** `src/app/(privileged)/crm/contacts/page.tsx`

**Features:**
- ✅ Responsive Tables → Cards transformation
- ✅ Theme/layout system integration
- ✅ Contact type filter (Customer, Supplier, Lead, Partner)
- ✅ Search by name, phone, email, company
- ✅ Quick actions: View, Edit, Delete, Portal Access
- ✅ Contact creation modal
- ✅ Bulk actions (export, merge, tag)

**Mobile (320-767px):**
- Card list with contact name, type badge, balance, phone
- Bottom action sheet for filters
- FAB for "New Contact"

**Desktop (1024px+):**
- Full table with all columns
- Sidebar filters (type, tier, status)
- Inline quick actions

#### 2.2 Contact Detail Page
**Route:** `src/app/(privileged)/crm/contacts/[id]/page.tsx`

**Tabs:**
1. **Overview** - Contact info + quick stats
2. **Orders** - Order history table/cards
3. **Payments** - Payment history
4. **Balance** - Statement of Account with journal entries
5. **Loyalty** - Points, tier, rewards (customers only)
6. **Scorecard** - Performance metrics (suppliers only)
7. **Pricing** - Custom pricing rules
8. **Activity** - Timeline of interactions

**Components:**
- `ContactHeader` - Name, type, balance, actions
- `ContactStatsCards` - Total orders, lifetime value, balance
- `OrderHistoryTable` - Responsive table/cards
- `LoyaltyWidget` - Points balance, tier progress bar
- `SupplierScorecardWidget` - Star ratings, delivery stats
- `StatementOfAccount` - Balance summary + transaction list

#### 2.3 Leads & Opportunities
**Route:** `src/app/(privileged)/crm/leads/page.tsx`
**Route:** `src/app/(privileged)/crm/opportunities/page.tsx`

Kanban board view + table view toggle.

---

### **Phase 3: Client Portal (Week 2-3)**

#### 3.1 Client Portal Dashboard
**Route:** `src/app/(public)/client-portal/dashboard/page.tsx`

**Features:**
- Welcome banner with client name + tier badge
- Quick stats: Balance, Points, Orders, Tickets
- Recent orders (last 5)
- Loyalty progress bar (points to next tier)
- Coupons available
- Action cards: "Browse Products", "View Invoices", "Request Quote"

**Mobile:** Stack all widgets vertically, large touch targets
**Desktop:** 3-column grid layout

#### 3.2 Statement of Account
**Route:** `src/app/(public)/client-portal/account/page.tsx`

**Features:**
- Current balance (large, prominent)
- Credit limit indicator (progress bar)
- Transaction history table/cards
  - Date, Description, Debit, Credit, Balance
- Filter by date range
- Export to PDF button
- Payment methods section

**Mobile:** Cards with expandable details
**Desktop:** Full table with pagination

#### 3.3 Wallet & Loyalty
**Route:** `src/app/(public)/client-portal/wallet/page.tsx`

**Features:**
- Wallet balance (large card)
- "Top Up" button → payment modal
- Transaction history (credits/debits)
- Loyalty points section
  - Current points (large)
  - Lifetime points
  - Tier badge + progress to next tier
  - "Redeem Points" button
- Rewards catalog (points → discounts)

**Mobile:** Stacked cards, swipeable transaction list
**Desktop:** 2-column layout (balance + transactions)

#### 3.4 Orders & Invoices
**Route:** `src/app/(public)/client-portal/orders/page.tsx`

**Features:**
- Order list (responsive table/cards)
  - Order number, date, status, total
- Status badges (pending, shipped, delivered)
- "View Details" → order detail page
- "Download Invoice" button (PDF)
- "Reorder" button
- "Track Shipment" link

**Mobile:** Cards with order summary + actions
**Desktop:** Table with inline actions

#### 3.5 Coupons & Promotions
**Route:** `src/app/(public)/client-portal/coupons/page.tsx`

**Features:**
- Active coupons grid
  - Code, description, discount, expiry
  - "Copy Code" button
- Used coupons history
- Available promotions
- "Apply Coupon" modal for checkout

**Mobile:** Card grid (1 column)
**Desktop:** Card grid (3 columns)

#### 3.6 Ecommerce Storefront
**Route:** `src/app/(public)/client-portal/shop/page.tsx`

**Features:**
- Product grid (responsive)
- Filters: Category, price range, brand
- Search bar
- Add to cart
- Wishlist button
- Product quick view modal
- Shopping cart (sticky on mobile)

**Mobile:** Single column product cards, bottom cart bar
**Desktop:** 4-column grid, sidebar filters, top cart

#### 3.7 Support & Quotes
**Route:** `src/app/(public)/client-portal/tickets/page.tsx`
**Route:** `src/app/(public)/client-portal/quotes/page.tsx`

Ticket list + "New Ticket" form
Quote request form + quote history

---

### **Phase 4: Supplier Portal (Week 3-4)**

#### 4.1 Supplier Portal Dashboard
**Route:** `src/app/(public)/supplier-portal/dashboard/page.tsx`

**Features:**
- Welcome banner with supplier name + rating
- Quick stats: Balance owed, Active POs, Pending Proformas
- Recent purchase orders (last 5)
- Notifications widget (unread count)
- Action cards: "Submit Proforma", "View Products", "Request Price Change"

**Mobile:** Stack vertically
**Desktop:** 3-column grid

#### 4.2 Statement of Account
**Route:** `src/app/(public)/supplier-portal/account/page.tsx`

**Features:**
- Current balance (amount owed to supplier)
- Transaction history (invoices, payments)
- Outstanding invoices list
- Payment history
- Export to PDF

**Mobile:** Cards
**Desktop:** Table

#### 4.3 Products & Catalog
**Route:** `src/app/(public)/supplier-portal/products/page.tsx`

**Features:**
- Product list (products supplied by this supplier)
- Current purchase price
- Stock levels (if visibility enabled)
- "Request Price Change" button per product
- Performance metrics per product:
  - Total quantity ordered
  - Total revenue
  - Last order date

**Mobile:** Product cards
**Desktop:** Table with metrics

#### 4.4 Proforma Management
**Route:** `src/app/(public)/supplier-portal/proformas/page.tsx`

**Features:**
- Proforma list (status badges)
- "New Proforma" button → creation form
- Proforma creation wizard:
  1. Select products (from supplier's catalog)
  2. Set quantities, prices, delivery terms
  3. Review & submit
- Proforma detail view:
  - Line items table
  - Status timeline
  - Admin notes (if rejected/negotiating)
  - "Resubmit" button (if rejected)

**Mobile:** Cards, multi-step form
**Desktop:** Table + modal form

#### 4.5 Purchase Orders
**Route:** `src/app/(public)/supplier-portal/orders/page.tsx`

**Features:**
- PO list (linked to this supplier)
- PO status badges
- PO detail view:
  - Line items
  - Delivery address
  - Expected delivery date
  - Actual delivery date (supplier can update)
  - "Mark as Shipped" button
  - "Upload Documents" (packing slip, invoice)

**Mobile:** Cards
**Desktop:** Table

#### 4.6 Price Change Requests
**Route:** `src/app/(public)/supplier-portal/price-requests/page.tsx`

**Features:**
- Price request list
- "New Price Request" form:
  - Select product
  - Current price (auto-filled)
  - Proposed price
  - Justification (textarea)
  - Effective date
- Request detail view:
  - Status badge
  - Admin response (if counter-proposal)
  - "Accept Counter" / "Decline" buttons

**Mobile:** Cards
**Desktop:** Table + modal

#### 4.7 Performance Metrics
**Route:** `src/app/(public)/supplier-portal/performance/page.tsx`

**Features:**
- Overall rating (5-star display)
- Individual ratings breakdown (quality, delivery, pricing, service)
- Delivery performance:
  - On-time delivery rate (%)
  - Average lead time (days)
  - Total deliveries
- Financial summary:
  - Total purchase amount
  - Average PO value
  - Payment terms compliance

**Mobile:** Stacked metric cards
**Desktop:** Grid layout with charts

---

## 🎨 Design Standards (Applied to ALL Pages)

### Responsive Breakpoints
- **Mobile:** 320-767px - Cards, bottom nav, single column
- **Tablet:** 768-1023px - 2-column, hybrid layout
- **Laptop:** 1024-1439px - 3-column, full tables, sidebars
- **Desktop:** 1440-1919px - Dense layout, multi-panel
- **Ultrawide:** 1920px+ - Max-width containers

### Theme Integration
- All pages use theme/layout CSS variables
- No hardcoded colors
- Responsive spacing (`layout-container-padding`)
- Card styling (`layout-card-radius`, `layout-card-padding`)

### Component Patterns
- **Tables → Cards:** Use `ResponsiveList` component
- **Forms:** Single column mobile, 2-col tablet, 3-col desktop
- **Navigation:** Bottom nav mobile, sidebar desktop
- **Filters:** Bottom sheet mobile, sidebar desktop
- **Modals:** Full-screen mobile, centered desktop
- **Touch Targets:** 44px mobile, 28px desktop

---

## 📦 Reusable Components to Build

### Core Components
1. **`ContactCard`** - Display contact with avatar, name, type, balance
2. **`ContactForm`** - Create/edit contact (multi-step on mobile)
3. **`ContactSelector`** - Searchable dropdown/modal
4. **`StatementTable`** - Statement of Account table/cards
5. **`LoyaltyProgressBar`** - Points + tier visual
6. **`SupplierRating`** - 5-star rating display + edit
7. **`WalletWidget`** - Balance display + actions
8. **`TransactionList`** - Wallet/payment transaction list
9. **`CouponCard`** - Coupon display with copy button
10. **`OrderCard`** - Order summary card
11. **`ProformaForm`** - Multi-step proforma creation
12. **`PriceRequestForm`** - Price change request form
13. **`NotificationBell`** - Unread notification indicator
14. **`BalanceSummary`** - AR/AP balance widget

### Layout Components
1. **`PortalLayout`** - Client/Supplier portal wrapper
2. **`DashboardGrid`** - Responsive stat cards grid
3. **`PortalNavigation`** - Bottom nav mobile, sidebar desktop
4. **`PortalHeader`** - User info + logout

---

## 🧪 Testing Strategy

### Unit Tests
- API client functions
- Component logic
- Form validation
- Responsive utilities

### Integration Tests
- Full user flows:
  - Customer views statement → makes payment
  - Customer earns points → redeems points
  - Supplier submits proforma → admin approves → converts to PO
  - Supplier requests price change → admin counters → supplier accepts

### E2E Tests
- Mobile navigation flows
- Desktop navigation flows
- Form submissions
- API error handling

---

## 🚀 Deployment Checklist

- [ ] All TypeScript types created
- [ ] All API clients implemented
- [ ] All CRM pages responsive
- [ ] All Client Portal pages responsive
- [ ] All Supplier Portal pages responsive
- [ ] All components theme-integrated
- [ ] Mobile navigation working
- [ ] Desktop navigation working
- [ ] All forms validated
- [ ] All tables responsive
- [ ] All modals responsive
- [ ] Touch targets 44px+ on mobile
- [ ] TypeScript compiles with no errors
- [ ] All tests passing
- [ ] Accessibility audit passed
- [ ] Performance audit passed

---

## 📈 Success Metrics

- **Responsive:** Works flawlessly on all screen sizes (320px - 2560px+)
- **Theme-Integrated:** Zero hardcoded colors, all theme variables
- **Fast:** <3s page load, <100ms interactions
- **Accessible:** WCAG AA compliant
- **Type-Safe:** 100% TypeScript coverage
- **Tested:** >80% code coverage

---

## 📝 Notes

- **Authentication:** Both portals use separate auth (ClientPortalAccess, SupplierPortalAccess)
- **Permissions:** Backend handles all permission checks
- **Real-Time:** Consider WebSocket for notifications (future enhancement)
- **Mobile App:** React Native version (future enhancement)
- **Internationalization:** i18n support (future enhancement)

---

**STATUS:** 🟢 Ready to implement!
**NEXT STEP:** Start with TypeScript type definitions + API clients (Phase 1)
