# Scope Access Control — Dual View & Scope Passwords

## Goal
Access control through scope passwords. Users can have different access levels depending on which password they use to log in.

## How It Works

| Login Method | Scope Access | Toggle Visible |
|---|---|---|
| Main password | `internal` (full) | ✅ Yes |
| Internal scope password | `internal` (full) | ✅ Yes |
| Official scope password | `official` (restricted) | ❌ No |

## Data Flow

### READ
- `scope_access` cookie → set at login, read by `AdminContext` to determine `canToggleScope`
- `financialSettings.dualView` → org-level setting for non-superusers
- `User.scope_pin_official` / `User.scope_pin_internal` → hashed PINs

### SAVED
- `POST /api/users/{id}/set-scope-pin/` → sets/clears scope password
- Login response includes `scope_access: 'official' | 'internal'`
- `scope_access` stored as browser cookie

## Variables
- **Official Password** field in ScopePasswordModal
- **Internal Password** field in ScopePasswordModal
- **Official/Internal toggle** in sidebar (only when `dualViewEnabled && canToggleScope`)

## Visibility Rules
- **Superusers**: Always see scope toggle (regardless of `financialSettings.dualView`)
- **Non-superusers**: See toggle only when `financialSettings.dualView` is enabled AND they logged in with main/internal password
- **Official-only users**: No toggle, forced to OFFICIAL view

## Files

| File | Purpose |
|---|---|
| `erp/models.py` | `scope_pin_official`, `scope_pin_internal`, `set_scope_pin()`, `check_scope_pin()` |
| `erp/views.py` | `set_scope_pin`, `verify_scope_pin` endpoints on UserViewSet |
| `erp/serializers/auth.py` | LoginSerializer checks scope PINs as auth fallback |
| `src/context/AdminContext.tsx` | Reads `scope_access` cookie, provides `canToggleScope` |
| `src/components/admin/Sidebar.tsx` | Renders scope toggle when `dualViewEnabled && canToggleScope` |
| `src/app/(privileged)/layout.tsx` | Passes `dualViewEnabled` (superusers always true) |
| `src/components/admin/ScopePasswordModal.tsx` | UI for setting/clearing scope passwords |
