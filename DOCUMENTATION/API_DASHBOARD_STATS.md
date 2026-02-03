# Dashboard API Documentation

## Overview
The Dashboard API provides aggregated statistics for the admin dashboard. It supports both tenant-specific views and a global SaaS overview for superusers.

## Endpoint: `/api/dashboard/admin_stats/`

### Goal
Provide key performance indicators (KPIs) and recent activity data to the admin dashboard.

### Data Sources (READ)
- **Organization**: `erp.models.Organization` (Validates tenant context)
- **Product**: `erp.models.Product` (Counts active products)
- **Contact**: `erp.models.Contact` (Counts customers)
- **Transaction**: `erp.models.Transaction` (Fetches latest sales/inbound transactions)

### Data Targets (WRITE)
- None (Read-only endpoint)

### Interaction Variables
- `organization_id`: Derived from `TenantMiddleware` or request context.

### Logic & Workflow
1. **Context Resolution**: The system calls `get_current_tenant_id()`.
2. **Scope Determination**:
   - **If Tenant Context Exists**:
     - Fetches the specific `Organization`.
     - Filters `Product`, `Contact`, and `Transaction` by this organization.
     - Returns data specific to that tenant.
   - **If No Tenant Context (Root/Global)**:
     - Checks if user is `is_staff` or `is_superuser`.
     - If authorized, aggregates `Product`, `Contact`, and `Transaction` counts across **ALL** organizations.
     - Returns global system statistics.
3. **Response Construction**: Returns a JSON object with:
   - `totalSales`: (Placeholder)
   - `activeOrders`: (Placeholder)
   - `totalProducts`: count
   - `totalCustomers`: count
   - `latestSales`: List of 5 most recent transactions.

### Error Handling
- Returns `404` if a specific organization ID is explicitly requested but not found.
- Returns `403` if a non-staff user attempts to access the global (no-tenant) view.
