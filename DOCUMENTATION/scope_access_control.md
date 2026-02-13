# Scope Access Control — Per-User Passwords for Dual View

## Goal
When dual view is enabled for an organization, control which users can access which scope using passwords/PINs.

## Access Model

### Two Access Levels
1. **Official Password (Viewer)** — User sees ONLY Official (declared/posted) data. The scope toggle is NOT visible. Internal data is completely hidden.
2. **Internal Password (Full Access)** — User sees BOTH scopes and can toggle between Official and Internal views.

### Key Rules
- No user bypasses passwords — including superusers
- Toggle visibility is determined by access level, not role alone
- Passwords are hashed (Django PBKDF2/bcrypt) — never stored in plaintext
- Session-based: once unlocked, stays unlocked until the user locks it or refreshes

## Data Flow

### Where Data is READ
- `User.scope_pin_official` — hashed password for Official scope
- `User.scope_pin_internal` — hashed password for Internal scope
- `AdminContext.scopeAccess` — current session access level (client-side state)

### Where Data is SAVED
- `POST /api/users/{id}/set-scope-pin/` — sets/clears a user's scope PIN (admin-only)
- `POST /api/users/verify-scope-pin/` — verifies a PIN (any authenticated user)
- `localStorage` — `tsf_view_scope` persists the last selected view scope
- `Cookie` — `tsf_view_scope` cookie for server-side awareness

## Variables User Interacts With

| Variable | Type | Description |
|---|---|---|
| `scope_pin_official` | CharField (128) | Hashed Official PIN on User model |
| `scope_pin_internal` | CharField (128) | Hashed Internal PIN on User model |
| `scopeAccess` | State | Current session access: `null`, `official`, `internal` |
| `canToggleScope` | Computed | `true` only when `scopeAccess === 'internal'` |
| `pendingScopeAuth` | State | Which scope the PIN modal is prompting for |
| `viewScope` | State | Active view: `OFFICIAL` or `INTERNAL` |

## Step-by-Step Workflow

### Admin Setting a User's Scope PIN
1. Admin calls `POST /api/users/{id}/set-scope-pin/` with `{ scope: "official", pin: "1234" }`
2. Backend hashes the PIN and stores it on the User record
3. User now requires that PIN to access the specified scope

### User Switching Scope
1. User sees "Enter Official View" and "Enter Full Access" buttons in sidebar
2. User clicks one of the buttons
3. `ScopePinModal` appears with password input
4. User enters their PIN → frontend calls `POST /api/users/verify-scope-pin/`
5. If PIN is correct:
   - **Official**: `scopeAccess = 'official'`, `viewScope` locked to `OFFICIAL`, toggle hidden
   - **Internal**: `scopeAccess = 'internal'`, toggle becomes visible
6. If PIN is wrong: error shown, stays on current state
7. "Lock Scope" button resets `scopeAccess` to `null`

## Files Modified

| File | Change |
|---|---|
| `erp/models.py` | Added `scope_pin_official`, `scope_pin_internal`, `set_scope_pin()`, `check_scope_pin()` |
| `erp/serializers/core.py` | Added `has_official_pin`, `has_internal_pin` to `UserSerializer` |
| `erp/views.py` | Added `set_scope_pin` and `verify_scope_pin` actions to `UserViewSet` |
| `erp/migrations/0040_add_scope_pins_to_user.py` | Database migration |
| `src/components/admin/ScopePinModal.tsx` | New PIN verification modal |
| `src/context/AdminContext.tsx` | Added `scopeAccess`, `canToggleScope`, `pendingScopeAuth` |
| `src/components/admin/Sidebar.tsx` | 3-state scope section with PIN modal integration |

## API Endpoints

### `POST /api/users/{id}/set-scope-pin/`
- **Access**: Admin only (staff/superuser)
- **Body**: `{ "scope": "official"|"internal", "pin": "1234" | null }`
- **Response**: `{ "message": "Official PIN set for username" }`

### `POST /api/users/verify-scope-pin/`
- **Access**: Any authenticated user (verifies own PIN)
- **Body**: `{ "scope": "official"|"internal", "pin": "1234" }`
- **Response**: `{ "verified": true|false, "has_pin": true|false }`
