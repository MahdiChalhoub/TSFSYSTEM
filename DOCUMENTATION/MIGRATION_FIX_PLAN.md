# 🚨 Migration Module Rectification Plan

This document outlines the systematic, prioritized plan to fix the critical security, architecture, and performance flaws identified in the Migration module.

## Phase 1: Critical Security & Integrity (Immediate Priority)
These issues pose an immediate risk to data safety and tenant isolation. They must be fixed before the module is used in production.

### 1. Enforce Tenant Isolation & Authentication (`apps/migration/views.py`)
**Problem:** The API endpoints (`upload`, `connect`, `link`, etc.) implicitly trust the `X-Tenant-Id` header and allow fallback to unauthenticated uploads (`request.user if request.user.is_authenticated else None`).
**Solution:**
- Enforce strict authentication (`IsAuthenticated` permission class).
- Strip trust from `X-Tenant-Id` for determining organization. Inherit the organization strictly from `request.user.organization` or validate that the user has `is_org_admin` rights for the requested tenant.
- Apply `TenantModelViewSet` constraints if not already doing so.

### 2. Encrypt Database Passwords (`apps/migration/models.py` & `views.py`)
**Problem:** Direct DB connection passwords (`db_password`) are stored in plaintext on the `MigrationJob` model.
**Solution:**
- Introduce a new `EncryptedCharField` or use Django's cryptography packages (like `django-cryptography` or the project's existing encryption utilities, e.g., the KMS integration).
- Migrate the `db_password` field to use this encrypted storage mechanism.
- Ensure the decryption payload only happens purely in-memory when the background task executes.

### 3. Wrap Bulk Operations in Database Transactions (`apps/migration/views.py`)
**Problem:** `_bulk_approve` and `_bulk_edit` execute massive database updates without atomic locks or rollback guarantees.
**Solution:**
- Wrap `_bulk_approve` logic inside `with transaction.atomic():`.
- Wrap `_bulk_edit` logic inside `with transaction.atomic():`.
- Add proper try/except blocks around these transactions to catch `IntegrityError` or timeouts, returning a standardized 400/500 response without corrupting partial rows.

## Phase 2: System Stability & Error Handling (High Priority)
These issues affect the reliability of the system under heavy load and make debugging nearly impossible.

### 4. Eradicate Naked `except:` Clauses (`serializers.py`, `parsers.py`, `tasks.py`)
**Problem:** Multiple areas use `except: pass` or `except: return 0`, swallowing critical stack traces.
**Solution:**
- Audit `parsers.py` and `tasks.py`.
- Replace all instances of `except:` with `except Exception as e:`.
- Log the exception robustly using `logger.exception(f"Detailed error context: {e}")`.

### 5. Disable Ephemeral Threads for Long-Running Tasks (`apps/migration/tasks.py`)
**Problem:** 12-hour migration tasks fallback to daemon threads inside the WSGI worker when Celery is unavailable. If the worker reloads, the migration dies instantly.
**Solution:**
- Remove the threading fallback completely. It is a dangerous illusion of async processing.
- If Celery is not available (`CELERY_AVAILABLE = False`), the system MUST synchronously fail or refuse to queue the job with a message: "Background worker not found. Migration cannot start."

### 6. Optimize the O(N²) String Parser (`apps/migration/parsers.py`)
**Problem:** Parsing huge SQL dumps uses character-by-character string concatenation (`current_value += ch`) which destroys memory and CPU.
**Solution:**
- Refactor `_parse_values_stream` to use a list buffer (`chars = []`) and join it at the end (`"".join(chars)`), OR
- Better yet, utilize `re.finditer` with optimized regular expressions for comma-separated, parenthesis-enclosed SQL values.
- Ensure memory chunking strictly adheres to generator limits.

## Phase 3: Frontend Architecture (Medium Priority)
This fixes the unmaintainable codebase to allow future agents/engineers to work effectively.

### 7. Dismantle the 146KB Frontend Monolith (`src/modules/migration/page.tsx`)
**Problem:** The main view is 2,400+ lines long and handles every sub-view (upload, pipeline, mapping, review, logs) in one file.
**Solution:**
Create a modular directory structure under `src/modules/migration/components/`:
- Extract `COAMappingModal.tsx`.
- Extract `MigrationReviewDashboard.tsx`.
- Extract `MigrationPipeline.tsx`.
- Extract `MigrationWizard.tsx`.
- `page.tsx` should serve only as the top-level state controller traversing between the sub-components.

---
**Execution Instructions:**
I am ready to tackle these phases one by one. I recommend starting with **Phase 1 (Security & Integrity)** to plug the vulnerabilities immediately. Please confirm if you'd like me to start rewriting `views.py` and `models.py`.
