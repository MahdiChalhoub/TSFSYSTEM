# SaaS Organization Context

## Goal
Ensure every authenticated API call resolves to a valid tenant context — even on the root SaaS domain where no `X-Tenant-Id` header is sent.

## Data Flow
```
Request → TenantMiddleware
  1. Header  X-Tenant-Id present? → Use it
  2. No header? → Resolve user from Authorization token → Use user.organization_id
  3. No user?   → tenant_id stays None (public endpoints only)
```

## Architecture

### User-Organization Enforcement
Every user is **required** to have an organization (`User.organization` is non-nullable).
This eliminates the need for any fallback logic in the middleware.

### Backend Middleware (`erp/middleware.py`)
- Reads `X-Tenant-Id` header first (explicit tenant context from frontend)
- Falls back to user's `organization_id` from auth token (when no header)
- Sets `_thread_locals.tenant_id` for all downstream ViewSets

### Frontend (`src/lib/erp-api.ts`)
- `erpFetch()` calls `getTenantContext()` to check for subdomain context
- If on tenant subdomain → sends `X-Tenant-Id` header
- If on root/saas domain → no header sent, middleware uses token-based resolution

### Login Response (`erp/serializers/auth.py`)
Returns full org data so the frontend always knows the user's context:
```json
{
  "token": "...",
  "user": {
    "organization": {
      "id": "uuid",
      "name": "SaaS Master Panel",
      "slug": "saas"
    }
  }
}
```

## Variables
- `X-Tenant-Id` header (explicit, takes priority)
- `Authorization: Token xxx` header (for fallback resolution)
- `_thread_locals.tenant_id` (thread-local storage for downstream use)

## Tables
- **Read**: `authtoken_token`, `Organization`, `User`
- **Write**: None (middleware is read-only)
- **Constraint**: `User.organization_id NOT NULL`
