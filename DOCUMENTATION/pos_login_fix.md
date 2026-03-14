# POS Login Fix Documentation

## Goal
Fix POS sign-in failure (#29) and ensure SaaS admins can log into any tenant subdomain.

## Root Cause Analysis

### Problem
When an admin (SaaS org user) tries to log in on a tenant subdomain (e.g., `pos.tsf.ci`), the login fails with "Unable to log in with provided credentials."

### Why It Fails
1. Tenant middleware resolves tenant ID from subdomain via `X-Tenant-Id` header
2. `LoginSerializer.validate()` scopes user lookup by `tenant_id` → only finds users in the **current** tenant org
3. Admin user exists in `saas` org, not the `pos` org → `user_obj = None`
4. `django.contrib.auth.authenticate()` checks globally but password may not match (hash corruption or different password)
5. Scope PIN check also fails because `user_obj` is None
6. Login fails

### Fix
Added **Step 3: Cross-Tenant Superuser Fallback** in `LoginSerializer.validate()`:
- After tenant-scoped and global auth fail, look for any superuser with the given username
- If found, try `check_password()` (bypasses Django's `authenticate()` which has backend-specific logic)
- Also try scope PINs for the superuser
- This allows the platform admin to log into any tenant subdomain for management access

## Files Modified

### MODIFIED: `erp_backend/erp/serializers/auth.py`
| What | Details |
|------|---------|
| Section Added | Lines 76-106: Cross-tenant superuser fallback |
| Logic | `User.objects.filter(username=X, is_superuser=True, is_active=True).first()` → `check_password()` → scope PINs |
| Security | Only superusers get cross-tenant access; regular users remain tenant-isolated |

## Data Flow

```
Login Request (tenant subdomain)
  → TenantMiddleware resolves X-Tenant-Id
  → LoginSerializer.validate():
    1. Tenant-scoped user lookup → user_obj
    2. django.contrib.auth.authenticate() → global
    3. Scope PIN check on user_obj
    4. [NEW] Cross-tenant superuser fallback → check_password() + scope PINs
  → Return token + user data
```

## Variables
- `tenant_id` — resolved from X-Tenant-Id header by middleware
- `user_obj` — user found in current tenant org
- `super_user` — superuser found globally (cross-tenant fallback)

## Security Considerations
- Only `is_superuser=True` users get cross-tenant access
- Regular tenant users remain fully isolated
- Scope PIN hierarchy preserved (official vs internal)
