# Manager Override System — Documentation

## Goal
Provide a secure mechanism for managers to authorize sensitive POS operations (voiding orders, manual discounts, etc.) via a PIN-based override modal, with full audit logging.

## Data Sources

### READ
- `GET /api/users/override-log/` — list recent manager overrides

### WRITE
- `POST /api/users/verify-override/` — verify manager PIN and log override
- `POST /api/users/{id}/set-override-pin/` — set/clear manager PIN (Admin only)

## Workflow
1. A sensitive operation is triggered at POS (e.g. clicking "Void Order").
2. The frontend displays the `ManagerOverrideModal`.
3. A manager enters their PIN.
4. The system validates the PIN and creates a `ManagerOverrideLog` entry if successful.
5. If authorized, the operation proceeds; otherwise it is blocked.

## Override Actions
| Action Code | Description |
|-------------|-------------|
| VOID_ORDER | Voiding a completed or partial order |
| APPLY_DISCOUNT | Applying a manual discount higher than allowed |
| PRICE_OVERRIDE | Changing the unit price of an item |
| REFUND | Processing a return/refund |
| DELETE_LINE | Removing an item from an active order |
| REOPEN_ORDER | Accessing a closed/finalized order |

## User Variables
- `override_pin`: Hashed PIN on the `User` model.
- `action`: The code representing the overridden event.
- `manager`: The user who provided the PIN.

## Files
| Layer | File |
|-------|------|
| Models | `erp_backend/erp/models.py` (`User` addition, `ManagerOverrideLog`) |
| Views | `erp_backend/erp/views.py` (`UserViewSet` actions) |
| Migration | `erp_backend/erp/migrations/0044_user_override_pin_manageroverridelog.py` |
| Server Actions | `src/app/actions/overrides.ts` |
| Component | `src/components/admin/ManagerOverrideModal.tsx` |

## Tables
| Table | Purpose |
|-------|---------|
| `user` | Stores `override_pin` per manager |
| `manager_override_log` | Audit trail of all overrides |
