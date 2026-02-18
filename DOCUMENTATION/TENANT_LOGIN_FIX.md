# Tenant Welcome Page — Login & Routing Fix

## Date
2026-02-18

## Goal
Fix tenant login and routing issues on `pos.tsf.ci/`:
1. Non-functional login form → wire to `loginAction`
2. Confusing "Advanced Authentication" link → remove
3. "Master Panel" security risk → remove
4. Hardcoded Django URL in storefront fetch → use env variable
5. Backend crash on duplicate admin users → scope `get_or_create` query
6. Post-login redirect to wrong domain → pass tenant slug in form
7. All app pages showing "Under Construction" → fix middleware routing

## Changes Made

### `src/components/tenant/TenantQuickLogin.tsx` [NEW]
- **Purpose**: Client component for tenant login form
- **Data READ**: None
- **Data SAVED**: Auth token cookie (via `loginAction`)
- **Variables**: `username`, `password` (form), `slug` (hidden prop)
- **Workflow**: Submit → loginAction → redirect to tenant dashboard

### `src/app/tenant/[slug]/page.tsx` [MODIFIED]
- Replaced static login card with `TenantQuickLogin`
- Removed "Advanced Authentication" and "Master Panel" links

### `src/app/tenant/[slug]/actions.ts` [MODIFIED]
- `getPublicProducts`: replaced `http://127.0.0.1:8000` with `DJANGO_URL` env variable

### `erp_backend/erp/management/commands/ensure_platform.py` [MODIFIED]
- Scoped `User.objects.get_or_create` by both `username` AND `organization` to prevent `MultipleObjectsReturned`

### `src/middleware.ts` [MODIFIED]
- Tenant subdomains: only rewrite root `/` to `/tenant/[slug]`
- All other app routes (`/sales`, `/dashboard`, etc.) pass through normally

## Versions
- v1.3.0-b013: Login form + remove links
- v1.3.0-b014: Fix hardcoded Django URL
- v1.3.0-b015: Fix backend startup crash
- v1.3.0-b016: Fix empty slug in post-login redirect
- v1.3.0-b017: Fix middleware tenant routing
