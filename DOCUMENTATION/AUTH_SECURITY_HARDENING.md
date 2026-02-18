# Auth Security Hardening — v1.3.0-b020

## Goal
Close all critical, high, and medium security vulnerabilities identified during expert auth audit.

## Changes Made

### SECRET_KEY (CRITICAL)
- **File**: `erp_backend/core/settings.py`
- **Before**: Hardcoded in source control
- **After**: Loaded from `DJANGO_SECRET_KEY` env var with fallback + warning
- **Impact**: Prevents token forgery via leaked key

### CORS & ALLOWED_HOSTS (CRITICAL)
- **File**: `erp_backend/core/settings.py`
- **Before**: `CORS_ALLOW_ALL_ORIGINS = True`, `ALLOWED_HOSTS = ['*']`
- **After**: Restricted to `.tsf.ci` subdomains via regex. `CORS_ALLOW_CREDENTIALS = True` enabled.
- **Env overrides**: `CORS_ALLOW_ALL`, `CORS_ALLOWED_ORIGINS`, `DJANGO_ALLOWED_HOSTS`

### Password Reset Token Leakage (CRITICAL)
- **File**: `erp_backend/erp/views_auth.py`
- **Before**: `uid` + `token` returned in API response body
- **After**: Tokens only logged server-side. Response always returns generic message.
- **Rate limiting**: `LoginRateThrottle` (5/min) applied to endpoint.

### Scope PIN Tenant Isolation (HIGH)
- **File**: `erp_backend/erp/serializers/auth.py`
- **Before**: Scope PIN fallback searched ALL users across tenants
- **After**: Scope PIN lookup scoped to current tenant

### Read-Only Auth Whitelist (MEDIUM)
- **File**: `erp_backend/erp/middleware.py`
- **Before**: All POST requests blocked for expired tenants (including login)
- **After**: `/api/auth/login/`, `/api/auth/logout/`, `/api/auth/password-reset/` whitelisted

### Auth Backend Logging (MEDIUM)
- **File**: `erp_backend/erp/backends.py`
- **Before**: `MultipleObjectsReturned` silently returned `None`
- **After**: Logs warning for data integrity alerting

### Username Validation (MEDIUM)
- **File**: `erp_backend/erp/serializers/auth.py`
- **Before**: `validate_admin_username` was a no-op
- **After**: Checks uniqueness within the `saas` org scope

### Token Expiration (HIGH)
- **File**: `erp_backend/erp/auth_token.py` (NEW)
- **Before**: DRF default Token — never expires
- **After**: Custom `ExpiringTokenAuthentication` with configurable TTL (default 24h)
- **Behavior**: Expired tokens auto-deleted, returns 401 to trigger re-login
- **Token Rotation**: Old token deleted + new token created on each login

### Server-Side 2FA Challenge (HIGH)
- **Files**: `erp_backend/erp/views_auth.py`, `src/app/actions/auth.ts`, `src/app/(auth)/login/page.tsx`, `src/components/tenant/TenantQuickLogin.tsx`
- **Before**: Password returned to frontend in React state during 2FA step
- **After**: Credentials stored in Django cache (5-min TTL) with UUID challenge_id. Frontend only receives `challenge_id`, sends `challenge_id + otp_token` to resolve
- **Security**: Password never appears in DOM, React state, or client-side memory

## Environment Variables Required
| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | insecure fallback + warning | Cryptographic signing key |
| `DJANGO_DEBUG` | `False` | Debug mode toggle |
| `DJANGO_ALLOWED_HOSTS` | `.tsf.ci,localhost,127.0.0.1` | Allowed request hosts |
| `CORS_ALLOW_ALL` | `False` | Override CORS to allow all |
| `CORS_ALLOWED_ORIGINS` | `https://tsf.ci,...` | Explicit CORS origins |
| `TOKEN_TTL_HOURS` | `24` | Auth token lifetime in hours |

## Data Flow
- **Reads**: `User`, `Organization`, `Token` tables
- **Writes**: Token creation on login, password hash on reset
- **Variables**: `DJANGO_SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, `DJANGO_ALLOWED_HOSTS`

## Workflow
1. User submits login form → `loginAction()` → `POST /api/auth/login/`
2. `LoginRateThrottle` checks IP (5/min limit)
3. `LoginSerializer.validate()` scopes user lookup by tenant
4. `TenantAuthBackend.authenticate()` verifies password (tenant-scoped)
5. Token returned → cookie set → redirect
