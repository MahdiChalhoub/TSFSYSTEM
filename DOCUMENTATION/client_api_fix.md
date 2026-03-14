# Client-Side API Fix Documentation

## Goal
Fix the "No network" error on the Health page at `https://saas.tsf.ci/health`.

## Problem
`erpFetch()` in client components (`'use client'`) was trying to reach `http://127.0.0.1:8000` from the browser. Since `DJANGO_URL` is a server-only env var (not `NEXT_PUBLIC_`), the browser falls back to `localhost`, which doesn't exist on the user's machine.

## Root Cause
In `src/lib/erp-api.ts`, the URL was hardcoded as:
```
const DJANGO_URL = process.env.DJANGO_URL || 'http://127.0.0.1:8000';
```
This works server-side (Next.js SSR) but fails client-side (browser).

## Solution
Added client/server detection:
```typescript
const isClient = typeof window !== 'undefined';
const DJANGO_URL = isClient ? '' : (process.env.DJANGO_URL || 'http://127.0.0.1:8000');
```

- **Client-side (browser)**: Uses relative URL (`/api/health/`) → Nginx on the server proxies `/api/*` to Django at `127.0.0.1:8000`
- **Server-side (Next.js SSR)**: Calls Django directly at `http://127.0.0.1:8000/api/health/`

## Files Modified
### `src/lib/erp-api.ts`
- **Reads from**: Django API endpoints
- **Saves to**: N/A (read-only helper)
- **Variables**: `DJANGO_URL`, `isClient`, `isDev`
- **Workflow**: Detects runtime environment → constructs appropriate URL → adds auth token → fetches data

## Architecture Note
The Nginx config on the production server (`/etc/nginx/sites-enabled/`) already routes:
- `/api/*` → `http://127.0.0.1:8000` (Django)
- All other paths → `http://127.0.0.1:3000` (Next.js)

This means client-side calls simply need a relative URL — Nginx handles the forwarding. The `src/app/api/erp/proxy/[...path]/route.ts` Next.js proxy route is only needed for local development without Nginx.
