# User-Organization Enforcement

## Goal
Ensure **every user always has an organization linked**. Eliminate the fragile middleware fallback that guessed the first active org for superusers.

## Problem
- The `admin` superuser had `organization_id = NULL`
- `TenantMiddleware` used a dangerous fallback: "if superuser has no org, use first active org"
- This is a **multi-tenant risk** — in production with multiple orgs, the wrong org could be selected

## Solution

### Data Fix
All users with `organization_id = NULL` were assigned to the **SaaS Master Panel** org:
- `admin` (id=2): linked to SaaS org
- `admin_erp` (id=1): linked to SaaS org

### Model Change (`erp/models.py`)
```python
# BEFORE (nullable — users could exist without an org)
organization = models.ForeignKey(Organization, ..., null=True, blank=True)

# AFTER (required — DB enforces the constraint)
organization = models.ForeignKey(Organization, ...) 
```
Migration: `erp/migrations/0032_enforce_user_org_required.py` (hand-written to avoid auto-detected model deletions)

### Middleware Simplification (`erp/middleware.py`)
Removed the superuser fallback. Flow is now:
1. Check `X-Tenant-Id` header → use it
2. No header? → Resolve user from token → use `user.organization_id`
3. No user? → `tenant_id = None` (public endpoints only)

### Login Serializer (`erp/serializers/auth.py`)
- Removed legacy `organization__isnull=True` fallback from login validation
- Added `OrganizationMinimalSerializer` to return full org data `{id, name, slug}` in login/me responses

## Data Flow
```
Login → POST /api/auth/login/
  → Returns: { token, user: { ..., organization: { id, name, slug } } }

Any API call → token in cookie → middleware resolves user.organization_id → tenant context set
```

## Variables
- `User.organization` (non-nullable FK)
- `X-Tenant-Id` header (explicit, takes priority)
- `Authorization: Token xxx` → resolved to `user.organization_id`

## Tables Affected
- **Read**: `User`, `Organization`, `authtoken_token`
- **Write**: `User` (data fix: set organization_id for NULL records)
- **Schema**: `User` (organization_id NOT NULL constraint added)

## Files Modified
- `erp/models.py` — User.organization made non-nullable
- `erp/middleware.py` — Removed superuser fallback
- `erp/serializers/auth.py` — Added OrganizationMinimalSerializer, cleaned login
- `erp/migrations/0032_enforce_user_org_required.py` — Hand-written migration
- `fix_null_org_users.py` — One-time data fix script
