# Organization Profile + Encryption Toggle — Documentation

## Goal
Add per-org encryption toggle to the org profile overview page, verify add-ons tab, resource overview, and all tabs work.

## Changes

### Server Actions — `actions.ts`
- `getOrgEncryptionStatus(orgId)` — GET `saas/modules/encryption/status/` with `X-Org-Id` header
- `toggleOrgEncryption(orgId, action)` — POST `saas/modules/encryption/{action}/` with `X-Org-Id` header

### Org Profile Overview Sidebar — `page.tsx`
Added Encryption Card to the right sidebar:
- ShieldCheck (green) / ShieldOff (gray) icon based on status
- "Active" / "Disabled" text
- Activation date display
- Activate / Deactivate button with loading state
- Green border accent when active

### Data Flow
```
Frontend toggle → toggleOrgEncryption(orgId, 'activate'|'deactivate')
  → POST /api/saas/modules/encryption/{action}/ (X-Org-Id: orgId)
  → Backend EncryptionService.activate(org) / deactivate(org)
  → Refresh status via getOrgEncryptionStatus(orgId)
```

### Variables
- `encryptionStatus` — Encryption status object from backend
- `togglingEncryption` — Loading state for encryption toggle

### Verification
- #9 (Add-ons tab): Code is correct, both backend and frontend handle empty states
- #10 (Resource overview): Already shows Users/Sites/Storage/Invoices with UsageMeter
- #11 (All tabs audit): All 7 tabs (overview/modules/usage/billing/users/sites/addons) render correctly
- #17 (Per-org encryption toggle): New card in overview sidebar with activate/deactivate functionality
