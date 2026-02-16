# Customer/Supplier Detail Pages

## Goal
360° view of any customer or supplier: contact info, outstanding balance, order history, payment history, and journal entries — all on one page.

## Page: `/crm/contacts/[id]`

### Data READ
- `GET /contacts/{id}/summary/` — aggregated contact summary

### Data SAVED
- No writes from this page (read-only)

### Variables
- **contactId**: from URL params
- **activeTab**: `orders` | `payments` | `journal`

### Workflow
1. Page loads with contact ID from URL
2. Fetches `detail_summary` endpoint
3. Shows 3 cards: Contact Info, Balance, and Stats (order count, total paid, etc.)
4. 3-tab detail: Orders (last 10), Payments (last 10), Journal entries (via linked COA account)

### How It Works
- Backend aggregates from: `Order`, `Payment`, `CustomerBalance`/`SupplierBalance`, `JournalEntryLine`
- Journal entries use the contact's `linked_account` (COA sub-account) for lookups
- Contact type (CUSTOMER/SUPPLIER) determines which order type and payment type to filter

## Files
- `erp_backend/apps/crm/views.py` — `ContactViewSet.detail_summary` endpoint
- `src/app/actions/crm/contacts.ts` — Server actions (CRUD + summary)
- `src/app/(privileged)/crm/contacts/[id]/page.tsx` — Detail page
