# Security Audit — Fixes Applied

## Goal
Address authentication, cookie, middleware, and input validation security issues found during the Security Expert audit.

## Issues Fixed

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| 1 | `scope_access` cookie not httpOnly | `auth.ts`, `AdminContext.tsx`, `layout.tsx` | Set httpOnly, pass scope via server-side prop |
| 2 | Password reset no input validation | `auth.ts` | Added `PasswordResetSchema` with Zod |
| 3 | Middleware no auth redirect | `middleware.ts` | Redirect to `/login` if no `auth_token` cookie |
| 4 | HTTPS only for login/register | `middleware.ts` | HTTPS for all non-local routes |
| 5 | `getUser` string matching errors | `auth.ts`, `erp-api.ts` | Use `ErpApiError.status` (401/403), exported class |

## Data Flow

### Token Lifecycle
```
Login → Django API returns token → Set auth_token (httpOnly, secure, sameSite:lax)
                                 → Set scope_access (httpOnly, secure, sameSite:lax)
Page load → Layout reads scope_access server-side → Passes as prop to AdminProvider
erpFetch → Reads auth_token from cookies → Injects Authorization header
Logout → Invalidates token server-side → Deletes both cookies
```

### Middleware Auth Flow
```
Request → HTTPS check (redirect if http on prod)
        → Auth check (redirect to /login if no auth_token && not public route)
        → Subdomain routing
```

## Variables
- `auth_token`: httpOnly cookie, 7-day expiry, cross-subdomain via `.tsf.ci` domain
- `scope_access`: httpOnly cookie, `official` | `internal`, read server-side only
- `initialScopeAccess`: prop passed from layout to AdminProvider
- `PasswordResetSchema`: Zod schema requiring `token`, `new_password` (min 8), `confirm_password` (must match)

## Step-by-Step
1. User hits any route → middleware checks HTTPS, then checks `auth_token` cookie
2. Unauthenticated → redirect to `/login?error=session_expired`
3. Authenticated → route proceeds → layout reads `scope_access` server-side
4. `AdminProvider` receives scope as prop → configures dual-view toggle accordingly
5. Password reset validates token + passwords with Zod before API call
