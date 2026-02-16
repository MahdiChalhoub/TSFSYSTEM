# Fiscal Years Page Fix

## Goal
Fix the Server Components render error on `/finance/fiscal-years`.

## Root Cause
The `FiscalYearsPage` was an `async` Server Component calling `erpFetch('fiscal-years/')` during SSR. On `saas.tsf.ci`, `getTenantContext()` returns `null` because subdomain `saas` is excluded. Without `X-Tenant-Id` header, Django's `TenantMiddleware` rejects the request with "No organization context", crashing the render.

## Solution
Converted the page from Server Component to client-side rendering using `'use client'`, `useState`, and `useEffect`. Data loading now happens on the client where tenant context is properly injected.

## Files Modified
- `src/app/(privileged)/finance/fiscal-years/page.tsx` — Converted from async Server Component to `'use client'`

## Step-by-Step
1. Added `'use client'` directive
2. Replaced `async function FiscalYearsPage` with standard React component
3. Added `useEffect` to load fiscal years and gaps on mount
4. Added loading spinner state
5. Preserved existing child component integration (FiscalYearWizard, FiscalYearCard)
