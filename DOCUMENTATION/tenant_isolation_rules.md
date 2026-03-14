# Tenant Isolation Security Model (Dajingo)

## Goal
Ensure 100% data isolation between organizations in a multi-tenant environment, preventing unauthorized access, data leaks, and cross-tenant interaction.

## Core Rules (Ten Rules of Dajingo Isolation)
1. **Model Inheritance**: Every multi-tenant entity must inherit from `TenantModel`.
2. **Implicit Filtering**: Queries are automatically filtered by `organization_id` via `TenantManager`.
3. **Cross-Tenant Identity**: Users see all organizations where their email is registered, allowing a "Federated View" for users with accounts in multiple businesses.
4. **Staff Restriction**: Even Staff/Superusers are restricted to the current tenant if `X-Tenant-Id` is present, OR to their email-enlisted organizations if they are business owners.
5. **Context Derivation**: `organization_id` is derived from the authenticated user context or secure gateway headers.
6. **Creation Protection**: `organization_id` is injected at the API level (`perform_create`); manual override is blocked.
7. **Read-Only Ownership**: The `organization` FK is marked `read_only` in all serializers.
8. **URL Slug Resolution**: Tenants are resolved via a secure internal endpoint to prevent direct ID guesswork.
9. **DB Level Constraints**: Multi-field unique constraints (e.g., `unique_username_per_org`) include `organization_id`.
10. **Zero-Trust for Anonymous**: Public endpoints (Storefront) are strictly limited to active product fields.
11. **Aggregation Scoping**: Dashboard stats must explicitly filter by `organization_id` using service layers.

## Implementation Details

### ViewSet Integration
All standard ERP ViewSets now inherit from `TenantModelViewSet`.
- **READ**: `get_queryset` checks for user role and tenant context.
- **WRITE**: `perform_create` forces ownership assignment.
- **UPDATE**: Prevents moving items between organizations.

### Frontend Integration
- Services use `erpFetch` which automatically injects `X-Tenant-Id` and `Authorization` headers.
- Next.js Middleware verifies the tenant slug before allowing access to internal admin routes.

## Affected Components
- **HR Command**: Now correctly counts and displays employees for the active tenant only (Fixed "17 Staff" leak).
- **Inventory/Products**: Isolated stock and catalog.
- **Finance/Ledger**: Strictly scoped Chart of Accounts and Journal Entries.
- **Users**: Unique usernames per organization.
