# Tenant Storefront Portal

## Goal of the page
Transform the tenant landing page into a premium storefront that displays public products, branding, and telemetry, while maintaining a secure entry point to the management portal.

## From where data is READ
- **Organization Details**: Resolved via `getOrganizationBySlug` (Django `tenant/resolve/`).
- **Product Catalog**: Fetched via `getPublicProducts` (Django `products/storefront/?organization_slug=...`).
- **Instance Telemetry**: Calculated from organization `_count` metadata (sites, users).

## Where data is SAVED
- **Login Credentials**: Submitted via the "Initialize Session" form to the authentication endpoint.

## Variables user interacts with
- **slug**: The subdomain/tenant slug from the URL.
- **credentials**: Username/Email and Access Key (Password) for login.
- **Product Selection**: Interactive product cards (UI only for now).

## Step-by-step workflow
1. User navigates to `[slug].localhost:3000`.
2. Middleware/Server Component resolves the tenant slug to an `Organization` ID.
3. Page fetches public products associated with that Organization.
4. Rendered UI displays the Storefront with products and a login gateway.
5. User can either browse products or log in to access the full ERP functionality.

## How the page achieves its goal
By utilizing a public-facing API endpoint (`storefront`) that is strictly scoped by organization slug, the page provides a useful "Store" experience while adhering to Dajingo isolation rules.

---

# Multi-Tenancy Isolation (Dajingo Rules)

## Implementation Details
Every API endpoint in the `erp_backend` now follows the "Three-Tier Defense":
1. **Model Level**: `TenantModel` provides an `organization` FK and a `TenantManager` that filters by `get_current_tenant_id()`.
2. **Middleware Level**: `TenantMiddleware` captures `X-Tenant-Id` and sets the thread-local context.
3. **Viewset Level**: `TenantModelViewSet` enforces Rule 5 (User Context) and Rule 6 (Auto-Injection).

## Secured ViewSets:
- `OrganizationViewSet` (Base Isolation)
- `SiteViewSet`
- `FinancialAccountViewSet`
- `ChartOfAccountViewSet`
- `FiscalYearViewSet`
- `JournalEntryViewSet`
- `ProductViewSet`
- `InventoryViewSet`
- `ContactViewSet`
- `EmployeeViewSet`
- `RoleViewSet`
- `LoanViewSet`
- `TransactionSequenceViewSet`
- `DashboardViewSet` (Custom aggregation logic)
