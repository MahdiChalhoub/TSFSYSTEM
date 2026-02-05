# SaaS Multi-Tenant Routing Documentation

## Goal
Implement a subdomain-based multi-tenant architecture where:
- `localhost` -> Public Landing Page & Registration.
- `saas.localhost` -> Master SaaS Administration Panel.
- `xxx.localhost` -> Specific business instance for organization `xxx`.

## Architecture Details

### 1. Middleware (`src/middleware.ts`)
The middleware intercepts all requests and redirects/rewrites based on the `host` header.
- **Master Root**: Rewrites to internal route `/landing`, unless the path starts with `/admin`, `/api`, or `/tenant`.
- **SaaS Subdomain**: Rewrites to `/admin/saas`.
- **Tenant Subdomain**: Rewrites to `/tenant/[slug]`.

### 2. Tenant Context & Branding
Each tenant now has a dedicated, high-fidelity landing page at `/tenant/[slug]`.
- **Logic**: The page fetches organization data (sites, user counts) via the `getOrganizationBySlug` server action.
- **Branding**: The UI automatically reflects the organization's identity (Logo initial, Name, Uptime stats).
- **Security**: The page verifies if the instance is `isActive`. If suspended, it shows a "Shield Check" security warning.

### 2. Tenant Isolation
Data isolation is handled at the database level using the `organizationId` column. The middleware ensures that users are locked into their specific subdomain.

### 3. Business Provisioning
- **Action**: `registerBusiness` in `src/app/actions/saas/registration.ts`.
- **Flow**:
  1. User enters business name and slug on the landing page.
  2. The system creates a new `Organization` record.
  3. A default `Site` (Main Branch) is created.
  4. A core `Chart of Accounts` skeleton is provisioned.
  5. The user is redirected to `slug.localhost`.

## Data Movement
- **Registration**: Landing Page -> `registerBusiness` Action -> Django Backend -> Database.
- **Login**: Tenant Login Page -> Authentication Service -> Organization Context.

## Relevant Tables
- `Organization`: Root of all data.
- `Site`: Every organization starts with at least one site.
- `ChartOfAccount`: Every organization is provisioned with a financial skeleton.
