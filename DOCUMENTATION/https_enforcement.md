# HTTPS Enforcement on Login

## Goal
Force HTTPS on login and registration pages to prevent credentials (passwords) from being transmitted in plaintext over HTTP.

## How It Works
- **Layer 1 (Cloudflare)**: SSL termination at the edge — most users already hit HTTPS
- **Layer 2 (Next.js Middleware)**: If someone somehow accesses `/login`, `/register`, or `/saas/login` via HTTP in production, the middleware detects this via the `x-forwarded-proto` header and issues a **301 redirect to HTTPS**

## From Where Data is READ
- `x-forwarded-proto` header (set by Cloudflare/nginx)
- `host` header (to exclude localhost)
- `url.pathname` (to match sensitive routes)

## Where Data is SAVED
- No data is saved; this is a redirect-only operation

## Variables User Interacts With
- None — this is transparent to the user

## Workflow
1. User navigates to `http://tsf.ci/login`
2. Request hits Cloudflare → nginx → Next.js middleware
3. Middleware checks `x-forwarded-proto` header
4. If `http` AND route is sensitive AND not localhost → redirect to `https://tsf.ci/login`
5. Password is now transmitted over encrypted HTTPS

## Files Modified
| File | Change |
|------|--------|
| `src/middleware.ts` | Added HTTPS enforcement block before route handling |
