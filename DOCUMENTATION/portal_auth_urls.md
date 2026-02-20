# Portal Auth URL Documentation

## Overview
Each portal module (client_portal, supplier_portal) has a dedicated authentication endpoint for portal-specific login. These are separate from the main admin/kernel login at `auth/login/`.

## Endpoints

### Main Admin Login
- **URL:** `POST /api/auth/login/`
- **Backend:** `erp.views_auth.login_view`
- **Accepts:** `username`, `password`, `otp_token` (optional), `site_id` (optional)
- **Used By:** Admin login page at `/(auth)/login/page.tsx` and `/saas/login/page.tsx`

### Client Portal Login
- **URL:** `POST /api/client-portal/portal-auth/login/`
- **Backend:** `apps.client_portal.views.ClientPortalLoginView`
- **Accepts:** `email`, `password`, `slug`
- **Used By:** `PortalContext.tsx`, `tenant/[slug]/actions.ts`

### Supplier Portal Login
- **URL:** `POST /api/supplier-portal/portal-auth/login/`
- **Backend:** `apps.supplier_portal.views.SupplierPortalLoginView`
- **Accepts:** `email`, `password`, `slug`
- **Used By:** `PortalContext.tsx`, `supplier-portal/[slug]/page.tsx`

## Important: URL Collision Prevention
Portal auth endpoints use the `portal-auth/` prefix instead of `auth/` to prevent collision with the kernel's `auth/login/` route. This is critical because Django's dynamic URL auto-registration flat-mounts module URLs (via `urlpatterns.insert(0, ...)` in `erp/urls.py`), which would otherwise cause portal `auth/login/` to shadow the kernel's `auth/login/`.

## Data Flow

### Admin Login
1. Frontend `loginAction` → `erpFetch('auth/login/')` → Django `login_view`
2. Returns `token`, `user`, `scope_access`
3. Token stored in `auth_token` httpOnly cookie

### Client Portal Login
1. Frontend `PortalContext.login()` → `fetch('.../client-portal/portal-auth/login/')` → Django `ClientPortalLoginView`
2. Returns `token`, `user`, `contact`, `organization`, `permissions`
3. Token stored in `localStorage` (client-side portal session)

### Supplier Portal Login
1. Frontend `handleLogin()` → `fetch('.../supplier-portal/portal-auth/login/')` → Django `SupplierPortalLoginView`
2. Returns `token`, `user`, `contact`, `organization`, `permissions`
3. Token stored in `localStorage` (supplier-side portal session)
