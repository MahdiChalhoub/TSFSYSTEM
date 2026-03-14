# Database Table: Organization (Tenant)

## Table Purpose
The central entity for multi-tenancy. Represents an autonomous enterprise or the SaaS Federation itself. All business data (Inventory, Finance, Users) is isolated by this ID.

## Columns
- `id`: UUID (Primary Key)
- `name`: String (Operation Name)
- `slug`: String (Unique, used for subdomain routing)
- `logo`: Image/URL
- `business_email`: String
- `phone`: String
- `website`: String
- `address`: String
- `city`: String
- `state`: String
- `zip_code`: String
- `country`: String
- `timezone`: String
- `is_active`: Boolean
- `business_type_id`: Integer (FK to BusinessType)
- `base_currency_id`: Integer (FK to GlobalCurrency)

## Relationships
- **Children**: `Site`, `User`, `Role`, `Product`, `JournalEntry` (One-to-Many via `organization_id`)
- **Category**: `BusinessType` (Many-to-One)
- **Financial**: `GlobalCurrency` (Many-to-One)

## Which Pages Read From It
- `/(auth)/login/page.tsx`: Resolves slug to display branding.
- `src/lib/erp-api.ts`: `getTenantContext` resolves slug for every API call.
- `/admin/saas/organizations/page.tsx`: Global list of all enterprises.
- `/admin/settings/company/page.tsx`: Enterprise profile management.

## Which Pages Write To It
- `/(auth)/register/business/page.tsx`: Initial founding (provisioning).
- `/admin/saas/organizations/page.tsx`: Administrative overrides.
- `/admin/settings/company/page.tsx`: Profile updates by enterprise admins.
