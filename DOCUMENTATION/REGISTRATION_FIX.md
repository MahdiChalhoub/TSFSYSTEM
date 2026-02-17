# Business Registration Fix Documentation

## Goal
Fix the "Connection failed or invalid response" error when submitting business registration.

## Root Cause
Error handling mismatch between `erpFetch` and `registerBusinessAction`:

1. `erpFetch` (in `src/lib/erp-api.ts`) extracts error messages from backend responses and throws `new Error(message)` where `message` is a **plain string** (e.g. "This business slug is already taken.")
2. `registerBusinessAction` (in `src/app/actions/onboarding.ts`) catches errors and immediately tries `JSON.parse(error.message)` — which ALWAYS fails on plain strings
3. The fallback catch returns `"Connection failed or invalid response"` — hiding the real error

This means **every real backend validation error** (slug taken, missing fields, etc.) was being masked as a connection failure.

## What Was Fixed

### `registerBusinessAction` — Error handling
- **File**: `src/app/actions/onboarding.ts`
- **Change**: Updated catch block to handle both JSON-parseable and plain string errors
- **Data READ**: Backend `auth/register/business/` endpoint
- **Data SAVED**: Organization, User, SaaSClient, CRM Contact (via Django)

### `registerUserAction` — Same fix
- **File**: `src/app/actions/onboarding.ts`
- **Change**: Same error handling improvement applied to user registration

## Variables User Interacts With
- Registration form: admin_first_name, admin_last_name, admin_username, admin_email, admin_password
- Business: business_name, slug, business_type_id, currency_id
- Location: email, phone, website, address, city, state, zip_code, country, logo

## Step-by-Step Workflow
1. User fills registration form across 3 steps
2. Submits → `registerBusinessAction` server action fires
3. Builds FormData payload → calls `erpFetch('auth/register/business/', { method: 'POST', body: FormData })`
4. Django validates via `BusinessRegistrationSerializer`
5. If error: `erpFetch` throws plain string → catch block now surfaces it to UI
6. If success: returns `{ success: true, login_url }` → redirects to login

## Tables Affected
| Table | Read | Write | Pages |
|-------|------|-------|-------|
| organization | ✅ (slug check) | ✅ | Registration |
| user | — | ✅ | Registration |
| saas_client | — | ✅ | Registration |
| role | ✅ | ✅ (get_or_create) | Registration |
| business_type | ✅ | — | Registration |
| global_currency | ✅ | — | Registration |
