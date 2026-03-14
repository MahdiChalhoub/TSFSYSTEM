# SaaS Routing and Backend View Restoration

## Goal of the Workflow
Restore the backend endpoints and frontend routing for the SaaS panel to resolve 404 errors and ensure correct subdomain mapping.

## Data Movement Matrix

| Component | Goal | Data Source | Data Destination |
|-----------|------|-------------|------------------|
| **DashboardViewSet** | Provide SaaS platform metrics | `Organization`, `OrganizationModule`, `SystemModule` | SaaS Dashboard Frontend |
| **TenantResolutionView** | Resolve domain to tenant ID | `Organization` | Next.js Middleware / Layout |
| **Middleware** | Handle subdomain routing | Request Hostname | URL Rewrites / Environment Config |

## User-Facing Variables
- `hostname`: The current URL (e.g., `saas.localhost`, `tenant1.localhost`).
- `NEXT_PUBLIC_ROOT_DOMAIN`: Environment variable for the root domain.
- `slug`: The tenant identifier in the URL or subdomain.

## Step-by-Step Workflow
1. **Tenant Identification**: The middleware detects the subdomain (e.g., `saas.`) and sets the context.
2. **Backend Resolution**: The frontend calls `api/resolution/resolve/?slug=...` to get the UUID of the organization.
3. **Data Retrieval**: The SaaS dashboard calls `api/dashboard/saas_stats/` to fetch platform-wide metrics.
4. **Dynamic Loading**: Business modules are loaded from `/src/modules/` based on enabled features in `OrganizationModule`.

## Achievement of Goals
- **404 Resolution**: Restoring missing views in `erp/views.py` and registering them in `erp/urls.py` eliminates API 404s.
- **Routing Robustness**: Enhanced middleware logic ensures subdomains work correctly on localhost and production.
- **Data Integrity**: Restored models ensure all metrics are accurately calculated from the database.
