# Scope Access Control — Per-User Passwords for Dual View

## Goal
When dual view is enabled for an organization, the user's **login password** determines which scope they can access.

## Access Model

### Three Password Types (at login)
1. **Main password** (Django auth) → Full Access: can toggle between Official and Internal
2. **Official scope password** → Official-only: locked to Official view, no toggle
3. **Internal scope password** → Full Access: can toggle between both scopes

### Key Rules
- Scope is determined **at login**, not in-app
- No superuser bypass — everyone authenticates with a password
- Admin sets scope passwords per user via API
- The same login page is used — no changes to the login form

## Data Flow

### Where Data is READ
- `User.scope_pin_official` — hashed Official scope password
- `User.scope_pin_internal` — hashed Internal scope password
- `scope_access` cookie — stores granted access level after login

### Where Data is SAVED
- `POST /api/auth/login/` — returns `scope_access` ('official' or 'internal')
- `scope_access` cookie — set by frontend login action (7 day expiry)
- `POST /api/users/{id}/set-scope-pin/` — admin sets/clears scope passwords

## Step-by-Step Workflow

### Admin Setting Scope Passwords
1. Admin calls `POST /api/users/{id}/set-scope-pin/` with `{ scope: "official", pin: "viewonly123" }`
2. Backend hashes password and stores on User record
3. User now has an Official scope password

### User Logging In
1. User goes to login page, enters username + password
2. Backend tries main password (Django `authenticate()`)
3. If main password matches → `scope_access = 'internal'` (full access)
4. If not, tries Official scope password → `scope_access = 'official'`
5. If not, tries Internal scope password → `scope_access = 'internal'`
6. If none match → login fails
7. Frontend stores `scope_access` cookie
8. Sidebar renders:
   - **Full access**: Official/Internal toggle switch
   - **Official-only**: Locked "Official View" indicator

## Files Modified

| File | Change |
|---|---|
| `erp/models.py` | `scope_pin_official`, `scope_pin_internal`, `set_scope_pin()`, `check_scope_pin()` |
| `erp/serializers/auth.py` | Login checks 3 password types, returns `scope_access` |
| `erp/views_auth.py` | `login_view` includes `scope_access` in response |
| `erp/serializers/core.py` | `has_official_pin`, `has_internal_pin` on `UserSerializer` |
| `erp/views.py` | `set_scope_pin` and `verify_scope_pin` admin actions |
| `src/app/actions/auth.ts` | Stores/clears `scope_access` cookie |
| `src/context/AdminContext.tsx` | Reads `scope_access` from cookie, computes `canToggleScope` |
| `src/components/admin/Sidebar.tsx` | Toggle for full access, locked indicator for official-only |

## API Endpoints

### `POST /api/auth/login/`
- **Response**: `{ "token": "...", "user": {...}, "scope_access": "official"|"internal" }`

### `POST /api/users/{id}/set-scope-pin/`
- **Access**: Admin only
- **Body**: `{ "scope": "official"|"internal", "pin": "1234" | null }`
