# Transaction Lifecycle System

## Goal
Provide a universal, configurable multi-level verification pipeline for all transactional models in the ERP.

## Status Flow
```
OPEN → LOCKED → VERIFIED (multi-level) → CONFIRMED
         ↑         ↓                         ↓
       UNLOCK    UNVERIFY                  (post)
```

## Models

### TransactionVerificationConfig (`erp/models.py`)
- **Purpose**: Per-organization verification rules
- **Table**: `transaction_verification_config`
- **Key Fields**:
  - `organization` (FK) — tenant scope
  - `transaction_type` — e.g. VOUCHER, STOCK_ADJUSTMENT
  - `required_levels` — default verification levels needed
  - `amount_threshold` — if amount exceeds this, use `threshold_levels`
  - `threshold_levels` — levels for high-value transactions
- **Read by**: `TransactionLifecycleService.verify()`
- **Written by**: Admin settings, `TransactionLifecycleService.seed_defaults()`

### TransactionStatusLog (`erp/models.py`)
- **Purpose**: Immutable audit trail for every lifecycle action
- **Table**: `transaction_status_log`
- **Key Fields**:
  - `transaction_type`, `transaction_id` — polymorphic reference
  - `action` — LOCK, UNLOCK, VERIFY, UNVERIFY, CONFIRM
  - `level` — verification level (1, 2, 3...)
  - `performed_by`, `performed_at`, `comment`, `ip_address`
- **Read by**: `lifecycle_history` endpoint
- **Written by**: `TransactionLifecycleService._log()`

### VerifiableModel (`erp/models.py`)
- **Purpose**: Abstract mixin inherited by transactional models
- **Fields added to inheriting models**:
  - `lifecycle_status` (OPEN/LOCKED/VERIFIED/CONFIRMED)
  - `locked_by`, `locked_at`
  - `current_verification_level`
- **Properties**: `is_editable`, `is_locked`

## Service: TransactionLifecycleService (`erp/lifecycle_service.py`)
- `lock(instance, type, user)` — OPEN → LOCKED
- `unlock(instance, type, user, comment)` — LOCKED → OPEN (comment required)
- `verify(instance, type, user)` — advances verification level, auto-confirms at final
- `unverify(instance, type, user, comment)` — VERIFIED/CONFIRMED → LOCKED (comment required)
- `seed_defaults(organization)` — creates default config for all transaction types
- `get_history(type, id)` — returns all audit logs

## ViewSet Mixin: LifecycleViewSetMixin (`erp/lifecycle_mixin.py`)
Adds these endpoints to any ViewSet:
- `POST /{id}/lock/`
- `POST /{id}/unlock/` (requires comment)
- `POST /{id}/verify/`
- `POST /{id}/unverify/` (requires comment)
- `GET /{id}/lifecycle_history/`

## Workflow
1. User creates order → status = OPEN (editable)
2. User locks order → status = LOCKED (frozen for review)
3. Verifier(s) verify → status = VERIFIED → CONFIRMED
4. Confirmed orders can be posted (execute inventory operations)
5. All actions logged to `TransactionStatusLog`
