# Login JSON Parse Error Fix

## Goal
Fix the `Unexpected token '<'` error when users access `https://saas.tsf.ci/login`.

## Root Cause
Django's `auth/login/` endpoint returned an HTML `Server Error (500)` page (when `DEBUG=False`) instead of JSON. The frontend `erpFetch` function tried to `JSON.parse()` this HTML response, producing the `SyntaxError`.

## Changes Made

### 1. Frontend — `src/lib/erp-api.ts`
**What**: Added HTML detection in the `erpFetch` error handler.  
**How**: Before calling `JSON.parse(errorText)`, checks if the error text starts with `<` (HTML). If so, throws a clean JSON-parseable error message.  
**Why**: Prevents `SyntaxError` from propagating to the browser when Django returns HTML error pages.

### 2. Backend — `erp_backend/erp/views_auth.py`
**What**: Wrapped `login_view` in a try/except block.  
**How**: Catches non-DRF exceptions (DB issues, serializer crashes) and returns a JSON 500 response with a logged traceback. DRF exceptions (validation errors) are re-raised for DRF's normal JSON handling.  
**Why**: Ensures this endpoint always returns JSON, never HTML.

### 3. Backend — `erp_backend/core/settings.py`
**What**: Added Django `LOGGING` configuration.  
**How**: Configured `django.request` and `erp` loggers to output to console (PM2 logs).  
**Why**: With `DEBUG=False`, Django 500 errors previously produced no traceback in logs. Now all 500 errors have full tracebacks for debugging.

## Data Flow

### Login Request Flow
1. User submits form on `saas.tsf.ci/login`
2. `loginAction` (server action) calls `erpFetch('auth/login/', { method: 'POST', ... })`
3. `erpFetch` sends POST to `http://127.0.0.1:8000/api/auth/login/`
4. Django processes via `login_view` → `LoginSerializer.validate()`
5. Response returned as JSON (always, even on errors)
6. `erpFetch` parses JSON and returns to `loginAction`

### Error Handling Chain
- **Django 400** (validation): DRF returns JSON → `erpFetch` parses → `loginAction` shows error message
- **Django 500** (exception): `login_view` catches → returns JSON 500 → `erpFetch` parses → `loginAction` shows "Login failed"
- **Django 500 (uncaught)**: `erpFetch` detects HTML → throws clean JSON error → `loginAction` shows "Server error"

## Variables User Interacts With
- `username` — Commander ID / login username
- `password` — Access key / login password
- `slug` — (hidden field) set to "saas" for SaaS panel login

## Version
`v2.8.1-b001` — Commit `b8e332c`
