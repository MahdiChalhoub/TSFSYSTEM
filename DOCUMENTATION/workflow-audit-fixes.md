# Workflow Audit — Fixes Applied

## Goal
Address workflow completeness and security issues found during the Workflow Expert audit.

## Issues Fixed

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| 1 | Voucher VERIFIED state dead end | `vouchers.ts`, `vouchers/page.tsx` | Added `confirmVoucher` action + Confirm button |
| 2 | Login username leak in URL | `auth.ts`, `login/page.tsx` | Removed `btoa(username)` from redirect URL and `atob` from login page |
| 3 | Settings/Sites 404 for tenants | `Sidebar.tsx` | Added `visibility: 'saas'` to restrict link to SaaS admins |
| 4 | Fiscal year lock intent unclear | `fiscal-year.ts` | Added comment explaining one-way lock is intentional per standards |

## Data Flow

### Voucher Lifecycle (Complete)
```
OPEN → [Lock] → LOCKED → [Verify] → VERIFIED → [Confirm] → CONFIRMED → [Post] → POSTED
                    ↑                                                  
                 [Unlock + comment]                                      
```

### Login Redirect (Fixed)
- **Before**: `redirect(/login?u=btoa(username))` — username decodable in URL
- **After**: `redirect(/login)` — no credentials in URL

## Variables
- `confirmVoucher(id, comment?)`: New server action calling `vouchers/{id}/confirm/`
- `visibility: 'saas'`: Sidebar filter restricting links to SaaS admin context

## Step-by-Step Workflow
1. User creates voucher (OPEN state) → Can edit, lock, or delete
2. Lock action → LOCKED state → Can unlock (with reason) or verify
3. Verify action → VERIFIED state → Can now confirm (was previously dead end)
4. Confirm action → CONFIRMED state → Can post to ledger
5. Post action → POSTED state → Final, immutable
