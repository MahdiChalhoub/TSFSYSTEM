# Encryption Page Documentation

## Goal
Manage AES-256 field-level encryption per organization from the SaaS admin panel.

## Page Location
`/encryption` — SaaS Control sidebar

## Data Sources

### READ
| Data | Source | API Endpoint |
|------|--------|-------------|
| Organization list | `organizations/` | `getOrganizations()` server action |
| Encryption status | `saas/modules/encryption/status/` | `getEncryptionStatus()` server action |

### WRITE
| Action | Endpoint | Server Action |
|--------|----------|---------------|
| Activate encryption | `saas/modules/encryption/activate/` | `activateEncryption(orgId)` |
| Deactivate encryption | `saas/modules/encryption/deactivate/` | `deactivateEncryption(orgId)` |
| Rotate key | `saas/modules/encryption/rotate-key/` | `rotateEncryptionKey(orgId)` |

## Variables User Interacts With
- **Target Organization** — dropdown to select which org to manage encryption for
- **Activate/Deactivate** — toggle encryption on/off for selected org
- **Rotate Key** — re-encrypt all data with a new key (with confirmation dialog)
- **Demo Toggle** — shows example of how encryption transforms data

## Workflow
1. Page loads → fetches org list + encryption status via server actions
2. User selects target organization from dropdown
3. User clicks Activate → server action calls backend → backend generates key + enables
4. User can Rotate Key → confirmation dialog → backend re-encrypts all fields
5. User can Deactivate → server action calls backend → backend disables

## Auth Fix (v1.12.3-b003)
- **Problem**: Page was a `'use client'` component calling `erpFetch` directly. `next/headers` cookies unavailable in client context → no auth token → Django 403
- **Fix**: Created `actions.ts` with `'use server'` directive. All API calls now go through server actions where `next/headers` cookies are available for auth token injection.
