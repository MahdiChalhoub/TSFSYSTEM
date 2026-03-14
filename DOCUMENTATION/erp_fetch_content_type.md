# erpFetch Content-Type Fix

## Goal
Ensure POST/PUT/PATCH requests from Next.js server actions to Django REST Framework include the correct `Content-Type: application/json` header.

## Problem
`fetch()` defaults to `text/plain;charset=UTF-8` when `body` is a string (e.g., `JSON.stringify(data)`). Django REST Framework rejects this with HTTP 415 `Unsupported media type`.

## Data Flow
- **Read from**: Next.js server actions send JSON POST/PUT/PATCH requests via `erpFetch()`
- **Saved to**: Django REST Framework API endpoints

## Variables
- `options.body` — the request body (string for JSON, FormData for file uploads)
- `headersRaw` — the `Headers` object built by `erpFetch()`
- `Content-Type` — header that tells Django how to parse the request body

## Fix Applied
In `src/lib/erp-api.ts`, before sending the request, check if:
1. Body exists and is a string (i.e., `JSON.stringify()` output)
2. No `Content-Type` is already set
If both conditions are met, set `Content-Type: application/json`.

FormData uploads skip this — the `Content-Type` is automatically set with multipart boundary by `fetch()`.

## File
- `src/lib/erp-api.ts` — lines 99-104
