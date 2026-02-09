# Business Registration Endpoint

## Endpoint
`POST /api/auth/register/business/`

**Authentication**: Public (AllowAny) — no token required  
**Content-Type**: `multipart/form-data` (supports logo upload)

## Goal
Self-service business workspace creation. Creates an organization, admin user, SaaSClient, and CRM contact in one atomic transaction.

## Required Fields
| Field | Type | Description |
|---|---|---|
| `business_name` | string | Organization display name |
| `slug` | string | URL-safe identifier (lowercase, letters, numbers, hyphens) |
| `admin_username` | string | Admin account username |
| `admin_email` | string | Admin account email |
| `admin_password` | string | Min 8 characters |

## Optional Fields
| Field | Type | Description |
|---|---|---|
| `business_type_id` | int | BusinessType ID |
| `currency_id` | int | Currency ID |
| `email` | string | Business contact email |
| `phone` | string | Business phone |
| `address` | string | Street address |
| `city` | string | City |
| `state` | string | State/Province |
| `zip_code` | string | ZIP/Postal code |
| `country` | string | Country |
| `website` | string | Business website URL |
| `timezone` | string | Timezone (default: UTC) |
| `admin_first_name` | string | Admin first name |
| `admin_last_name` | string | Admin last name |
| `logo` | file | Business logo image |

## Data Flow

### READ
- `BusinessType` — validates business_type_id
- `Organization` — checks slug uniqueness

### WRITE
1. `Organization` — creates via ProvisioningService (also creates Site, Warehouse, module grants)
2. `Role` — get_or_create "Admin" role for the new org
3. `User` — creates admin user with org + role
4. `SaaSClient` — get_or_create account owner
5. CRM `Contact` — syncs SaaSClient to CRM (best-effort)

## Validation Rules
- Slug: lowercase alphanumeric + hyphens only
- Reserved slugs blocked: `saas`, `admin`, `api`, `www`, `app`, `mail`, `smtp`, `ftp`
- Password: minimum 8 characters
- Slug uniqueness check against Organization table

## Response

### Success (201)
```json
{
    "message": "Workspace 'slug' created successfully!",
    "login_url": "/slug/login",
    "organization": {
        "id": "uuid",
        "name": "Business Name",
        "slug": "slug"
    }
}
```

### Validation Error (400)
```json
{
    "field_name": ["Error message"]
}
```

## Step-by-step Workflow
1. User fills registration form on `/register/business`
2. Frontend `onboarding.ts` sends FormData to `auth/register/business/`
3. Backend validates fields, slug format, uniqueness, password
4. `ProvisioningService.provision_organization()` creates org + site + warehouse
5. Admin user created with "Admin" role
6. SaaSClient created with org linked
7. CRM contact synced in SaaS org (best-effort)
8. Returns login URL for the new workspace
9. Frontend redirects user to login page

## Files
- **View**: `erp_backend/erp/views_auth.py` → `register_business_view()`
- **URL**: `erp_backend/erp/urls.py` → `path('auth/register/business/', ...)`
- **Frontend**: `src/app/actions/onboarding.ts` → `registerBusinessAction()`
- **Page**: `src/app/(auth)/register/business/page.tsx`
