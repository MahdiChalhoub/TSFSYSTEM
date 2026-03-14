# CRM Contacts Module — Documentation

## Goal
Unified registry for all business relationships: Clients, Suppliers, Leads, Partners, Creditors, and Debtors. Each contact auto-links to a General Ledger sub-account for precision accounting.

## Database: `contact` Table

### Core Fields
| Column | Type | Description |
|--------|------|-------------|
| `type` | VARCHAR(20) | SUPPLIER, CUSTOMER, LEAD, PARTNER, CREDITOR, DEBTOR |
| `name` | VARCHAR(255) | Display name |
| `company_name` | VARCHAR(255) | Company / organization name (optional) |
| `email` | EMAIL | Primary email |
| `phone` | VARCHAR(50) | Primary phone |
| `address` | TEXT | Full address |
| `website` | URL | Company website |
| `vat_id` | VARCHAR(100) | Tax ID |

### Financial Fields
| Column | Type | Description |
|--------|------|-------------|
| `balance` | DECIMAL(15,2) | Current balance |
| `credit_limit` | DECIMAL(15,2) | Maximum credit allowed |
| `linked_account_id` | INT | FK to ChartOfAccount (decoupled) |
| `payment_terms_days` | INT | Default payment terms (0 = immediate) |
| `preferred_payment_method` | VARCHAR(50) | CASH, BANK, CHECK, MOBILE_MONEY |

### Supplier-Specific Fields
| Column | Type | Description |
|--------|------|-------------|
| `supplier_category` | VARCHAR(20) | REGULAR, DEPOT_VENTE (consignment), MIXED |

### Customer-Specific Fields
| Column | Type | Description |
|--------|------|-------------|
| `customer_type` | VARCHAR(50) | Legacy free-text field |
| `customer_tier` | VARCHAR(20) | STANDARD, VIP, WHOLESALE, RETAIL |
| `loyalty_points` | INT | Accumulated loyalty points |

### Tax Fields
| Column | Type | Description |
|--------|------|-------------|
| `airsi_tax_rate` | DECIMAL(5,2) | AIRSI tax rate |
| `is_airsi_subject` | BOOL | Whether subject to AIRSI |

### Metadata
| Column | Type | Description |
|--------|------|-------------|
| `notes` | TEXT | Internal notes |
| `is_active` | BOOL | Active flag (deactivate to hide) |
| `home_site` | FK→Site | Registration site |
| `created_at` | DATETIME | Auto-set on creation |
| `updated_at` | DATETIME | Auto-set on update |

## Data Flow

### READ
- **Contact List Page** (`/crm/contacts`) — reads all contacts via `GET /api/contacts/`
- **Contact Detail** (`/crm/contacts/{id}`) — reads single contact + summary via `GET /api/contacts/{id}/summary/`
- **Sales/Purchase forms** — read contacts for client/supplier selection

### WRITE
- **Create Contact** — `POST /api/contacts/` (auto-creates GL sub-account)
- **Server Action** `createContact()` in `src/app/actions/people.ts`

## User Interactions

### Contact Form Fields
- **Always visible**: Name, Company Name, Home Site, Email, Phone, Payment Terms, Notes
- **Supplier only**: Supplier Category dropdown (Regular / Depot Vente / Mixed)
- **Customer only**: Client Tier dropdown (Standard / VIP / Wholesale / Retail)

### Contact List Features
- Filter by type: ALL, CUSTOMER, SUPPLIER, LEAD
- Filter by Home Site
- Search by name or email
- Supplier category badge (Consignment / Mixed) shown on cards
- Customer tier badge (VIP / Wholesale / Retail) shown on cards
- Stats bar: Active Clients count, Suppliers count, Leads count

## Workflow

1. User clicks "New Supplier" or "Individual Client"
2. Modal opens with type-appropriate fields
3. On submit → `createContact()` server action → `POST /api/contacts/`
4. Backend auto-creates GL sub-account under Receivable (customer) or Payable (supplier)
5. Contact appears in list with type badge and category/tier badge

## Files Modified
- **Backend**: `erp_backend/apps/crm/models.py` (Contact model)
- **Backend**: `erp_backend/apps/crm/serializers.py` (ContactSerializer)
- **Backend**: `erp_backend/apps/crm/views.py` (ContactViewSet)
- **Frontend**: `src/app/(privileged)/crm/contacts/page.tsx` (data mapping)
- **Frontend**: `src/app/(privileged)/crm/contacts/manager.tsx` (filters + badges)
- **Frontend**: `src/app/(privileged)/crm/contacts/form.tsx` (new fields)
- **Frontend**: `src/app/actions/people.ts` (createContact action)
