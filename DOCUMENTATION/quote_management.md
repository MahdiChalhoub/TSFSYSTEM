# Quote Management System

## Goal
Allow catalogue storefront visitors (guests or registered clients) to submit quote requests for specific products. Admin users can manage these leads from a dedicated inbox.

---

## Data Flow

### READ
- **Admin Inbox** (`/workspace/quote-inbox`): Reads from `GET /api/client-portal/quote-requests/`
- **CatalogueHomePage**: Reads products from `/api/products/storefront/`

### WRITE
- **Catalogue Form** (storefront): Writes to `POST /api/client-portal/quote-requests/`
- **Admin Inbox** (status updates, notes): Writes to `PATCH /api/client-portal/quote-requests/:id/`
- **Admin Inbox** (delete): Writes to `DELETE /api/client-portal/quote-requests/:id/`

---

## Database Table: `client_quote_request`

| Column         | Type          | Notes                                 |
|----------------|---------------|---------------------------------------|
| id             | BigAutoField  | Primary key                          |
| quote_number   | CharField(50) | Auto-generated: QT-YYMMDD-XXXXXX    |
| contact        | FK → Contact  | Nullable. Linked if user is logged in |
| full_name      | CharField     | Required                             |
| email          | EmailField    | Required                             |
| phone          | CharField     | Optional                             |
| company_name   | CharField     | Optional                             |
| product        | FK → Product  | Nullable link to product             |
| product_name   | CharField     | Snapshot of product name             |
| quantity       | Decimal       | Default: 1                           |
| message        | TextField     | Customer requirements                |
| internal_notes | TextField     | Admin-only notes                     |
| status         | CharField     | PENDING / REPLIED / CONVERTED / DECLINED / EXPIRED |
| source_url     | URLField      | Page where quote was requested       |
| organization   | FK → Org      | Tenant isolation                     |
| created_at     | DateTime      | Auto                                 |
| updated_at     | DateTime      | Auto                                 |

### Read by: Admin Inbox (`/workspace/quote-inbox`)
### Written by: CatalogueHomePage storefront form, Admin Inbox (status/notes)

---

## User-Facing Variables

### Storefront Form (CatalogueHomePage)
- `full_name` — Customer's full name
- `email` — Customer's email address
- `phone` — Optional phone number
- `company_name` — Optional company name
- `quantity` — Desired quantity
- `message` — Requirements/questions

### Admin Inbox
- `status` — Dropdown: Pending → Replied → Converted (or Declined)
- `internal_notes` — Free-text admin notes

---

## Workflow

### Storefront Submission
1. Visitor browses catalogue at `tenant.tsf.ci/store`
2. Clicks "Request Quote" on a product card
3. Modal opens with quote form
4. Fills in contact details + message + quantity
5. Submits → `POST /api/client-portal/quote-requests/`
6. Backend auto-generates `quote_number`, resolves org from `X-Tenant-Id`
7. Success confirmation displayed in modal

### Admin Review
1. Admin opens Quote Inbox from Sidebar → CRM → Client Gate → Quote Inbox
2. Sees list of quotes filterable by status
3. Clicks a quote to see full details in right panel
4. Can: Mark Replied, Decline, Convert to Order, Add Notes, Delete

---

## Files Modified/Created

### Backend
- `erp_backend/apps/client_portal/models.py` — Added `QuoteRequest` model
- `erp_backend/apps/client_portal/serializers.py` — Added `QuoteRequestSerializer`
- `erp_backend/apps/client_portal/views.py` — Added `QuoteRequestViewSet`
- `erp_backend/apps/client_portal/urls.py` — Added `quote-requests` route
- `erp_backend/apps/client_portal/migrations/0006_*` — Migration

### Frontend
- `src/storefront/components/CatalogueHomePage.tsx` — Rewrote with modal form
- `src/app/tenant/[slug]/actions.ts` — Fixed `submitQuoteRequest` endpoint
- `src/app/actions/client-portal/index.ts` — Added admin CRUD actions
- `src/app/(privileged)/workspace/quote-inbox/page.tsx` — Admin inbox page
- `src/app/(privileged)/workspace/quote-inbox/client.tsx` — Interactive client component
- `src/components/admin/Sidebar.tsx` — Added Quote Inbox link
