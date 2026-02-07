# SaaS Organization Context Fix

## Goal
Eliminate the recurring **"No organization context"** error when accessing business pages from `saas.localhost:3000`.

## Problem
The SaaS admin platform (`saas.localhost`) was treated as having no tenant context. When `getTenantContext()` detected the `saas` subdomain, it returned `null`, so `erpFetch()` never sent the `X-Tenant-Id` header. The Django backend middleware then had no tenant ID → all ViewSets returned `"No organization context"`.

## Solution

### Backend Middleware (`erp/middleware.py`)
When no `X-Tenant-Id` header is present, the TenantMiddleware now:
1. Resolves the user from the `Authorization: Token xxx` header (manually, since DRF token auth runs after middleware)
2. Falls back to the user's organization (via `user.organization`)
3. For superusers with no organization: falls back to the first active organization

### Model/DB Alignment
Fixed 5 models where Django model fields didn't match actual PostgreSQL columns:

| Model | Issue | Fix |
|-------|-------|-----|
| **Employee** | `name`, `position`, `department` fields don't exist in DB | Replaced with `job_title`, `address_line`, `date_of_birth`, `nationality` |
| **Product** | `size` field doesn't exist in DB | Removed |
| **Contact** | Missing `vat_id`, `credit_limit`, `customer_type`, `airsi_tax_rate`, `home_site`, `updated_at` | Added all DB columns |
| **FinancialAccount** | `linked_coa_id` vs `ledger_account_id` | Added `db_column='ledger_account_id'` |
| **Loan** | `frequency` vs `payment_frequency`, missing columns | Aligned to actual DB schema |

## Data Flow
- **User on `saas.localhost`** → getTenantContext() returns null → erpFetch sends no X-Tenant-Id → Middleware resolves user from auth token → uses user's org or first org → API works

## Variables
- `X-Tenant-Id` header (request)
- `Authorization: Token xxx` header (request)
- `_thread_locals.tenant_id` (thread-local storage)

## Steps
1. Frontend request arrives without X-Tenant-Id
2. TenantMiddleware reads Authorization header
3. Resolves token → user → organization
4. Sets thread-local tenant_id
5. ViewSet reads tenant_id successfully

## Tables Affected
- **Read**: `authtoken_token`, `Organization`, `User`
- **Affects**: All tenant-scoped tables via `get_current_tenant_id()`
