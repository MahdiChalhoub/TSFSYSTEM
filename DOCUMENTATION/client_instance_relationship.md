# Client-Instance Relationship

## Goal
Link every Organization (instance) to a **SaaSClient** (account owner / billing contact). One client can own multiple organizations.

## Data Model

### SaaSClient (`SaaSClient` table)
| Column        | Type          | Notes                                  |
|---------------|---------------|----------------------------------------|
| id            | UUID (PK)     | Auto-generated                         |
| first_name    | CharField     | Required                               |
| last_name     | CharField     | Required                               |
| email         | EmailField    | Unique — used as client identifier     |
| phone         | CharField     | Optional                               |
| company_name  | CharField     | Optional — legal company name          |
| address       | TextField     | Optional                               |
| city          | CharField     | Optional                               |
| country       | CharField     | Optional                               |
| is_active     | BooleanField  | Default True                           |
| notes         | TextField     | Internal notes                         |
| created_at    | DateTimeField | Auto                                   |
| updated_at    | DateTimeField | Auto                                   |

### Relationship
- `Organization.client` → ForeignKey to `SaaSClient` (nullable)
- One `SaaSClient` → many `Organization` instances
- Replaces old `billing_contact_id` IntegerField

## API Endpoints

### SaaSClient CRUD (`/api/saas/clients/`)
| Method | URL                         | Purpose                             |
|--------|-----------------------------|-------------------------------------|
| GET    | `/saas/clients/`            | List all clients (?search=)         |
| GET    | `/saas/clients/{id}/`       | Client detail + linked orgs         |
| POST   | `/saas/clients/`            | Create new client                   |
| PATCH  | `/saas/clients/{id}/`       | Update client                       |
| GET    | `/saas/clients/{id}/statement/` | Consolidated billing across all orgs |

### Org-Client Assignment (`/api/saas/org-modules/{org_id}/`)
| Method | URL                           | Purpose                     |
|--------|-------------------------------|-----------------------------|
| POST   | `.../set-client/`             | Assign or unassign client   |

### Data Returned in Existing Endpoints
- **`usage/`** now includes `client: { id, full_name, email, phone, company_name }` or `null`
- **`OrganizationSerializer`** now includes `client_name` field

## Frontend Integration

### Organization Detail Page — Overview Tab
- **Account Owner card**: Shows client name, company, email, phone
- **"Assign Client" button**: Opens dialog to search/select or create client
- **"Change Client" button**: Same dialog with current client highlighted
- Dialog supports:
  - Search by name/email
  - Select existing client → assigns immediately
  - "Create New Client" form → creates and assigns
  - "Unassign" option for clients already assigned

### Organizations List Page
- Each org card shows `client_name` (if assigned) under the email

## Files Modified

### Backend
- `erp/models.py` — Added `SaaSClient` model, replaced `billing_contact_id` with `client` FK
- `erp/migrations/0037_saasclient.py` — Hand-written migration
- `erp/views_saas_modules.py` — Added `SaaSClientViewSet`, `set_client` action, client in `usage` response
- `erp/serializers/core.py` — Added `client_name` to `OrganizationSerializer`
- `erp/urls.py` — Registered `saas/clients` route

### Frontend
- `organizations/[id]/actions.ts` — Added `listClients`, `createClient`, `setOrgClient` actions
- `organizations/[id]/page.tsx` — Account Owner card + client assignment dialog
- `organizations/page.tsx` — Client name on org cards

## Where Data is READ
- Client data: `SaaSClient` table
- Client-org linkage: `Organization.client` FK
- Billing statement: `SubscriptionPayment` table filtered by client's org IDs

## Where Data is SAVED
- `SaaSClient` table (CRUD)
- `Organization.client` field (set-client action)

## Workflow
1. SaaS admin navigates to org detail → Overview tab
2. Sees "Account Owner" card (empty or populated)
3. Clicks "Assign Client" / "Change Client"
4. Dialog opens with searchable client list
5. Admin selects existing client OR creates new one inline
6. Client is assigned to organization
7. Client name appears on org list cards and detail page
