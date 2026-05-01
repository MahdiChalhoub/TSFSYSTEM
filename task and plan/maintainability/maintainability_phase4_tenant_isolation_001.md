# Maintainability Phase 4 — Models Without Tenant Isolation

**Status**: DONE 2026-04-30 (migration generated, not yet applied)
**Priority**: HIGH
**Created**: 2026-04-30
**Estimated effort**: ~3 hours
**Risk**: MEDIUM (model migrations on production schemas; tests for any tenant-leak relationships)

---

## MANDATORY — Read First

Before starting, the executing agent MUST read:
1. `.agent/BOOTSTRAP.md`
2. `.agent/rules/isolation.md` (tenant isolation policy)
3. `.agent/rules/data-integrity.md` (no destructive migrations)
4. The two tenant base classes:
   - `erp_backend/erp/models.py:248-263` — `TenantManager` + `TenantModel` (legacy; uses thread-local `get_current_tenant_id`)
   - `erp_backend/kernel/tenancy/models.py:14-80` — `TenantOwnedModel` (new; uses `get_current_tenant`, has `all_objects` and validation on save/delete)

---

## Goal

Audit the 9 models the Phase 4 WORKMAP entry flagged plus the duplicate `MigrationMapping` (10th = `apps.migration_v2.MigrationMapping`), classify each as **KEEP / MIGRATE / INVESTIGATE**, design the migration for the safe ones, and execute those that don't risk breaking call sites.

**Hard rule**: never delete data. Migrations must backfill `organization_id` on existing rows or make the FK nullable when the data semantics demand it.

---

## Background — TenantModel vs TenantOwnedModel

There are two abstract bases in this codebase:

| | `erp.models.TenantModel` | `kernel.tenancy.models.TenantOwnedModel` |
|---|---|---|
| FK column | `tenant_id` | `tenant_id` |
| FK nullable | No | **Yes** (`null=True, blank=True`) |
| Default manager | `TenantManager` (filters by thread-local org id) | `TenantManager` (same) |
| Escape hatch manager | `original_objects` | `all_objects` + `original_objects` |
| Auto-assign on save | No | Yes (uses `get_current_tenant()`) |
| Validates cross-tenant deletes | No | Yes |

Both are valid. **Use `TenantModel`** for parity with most existing models in `apps/`. Switch to `TenantOwnedModel` only where the auto-save behavior is desired and the call sites won't be surprised by it.

---

## Per-Model Audit

### 1. `Currency` — `apps/reference/models.py:22`
```python
class Currency(models.Model):
    code = models.CharField(max_length=3, unique=True, ...)  # ISO 4217
    ...
```
**Decision**: **KEEP**.
**Rationale**: Global ISO 4217 catalog, explicitly designed as SaaS-level reference data. The docstring states `"Tenant Isolation: N/A (global reference data)"`. Sibling models `Country`, `CountryCurrencyMap`, `City`, `PaymentGateway` are all global by design. Tenant-scoped activation is handled by `OrgCurrency` (already inherits `AuditLogMixin, TenantOwnedModel`). Converting `Currency` itself would break the SaaS catalog model (every org would have to maintain its own ISO 4217 list — wrong design).

---

### 2. `PackageUpload` — `apps/packages/models.py:9`
```python
class PackageUpload(models.Model):
    """Tracks uploaded packages (kernel, frontend, module) for deployment."""
    id = models.UUIDField(primary_key=True, ...)
    package_type = models.CharField(...)
    name = models.CharField(...)
    version = models.CharField(...)
    file = models.FileField(...)
    ...
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, ...)
    backup_path = models.CharField(...)
```
**Decision**: **KEEP** (system-level).
**Rationale**: Packages are platform deployment artifacts (kernel, frontend, modules) — they are not per-organization data. They affect the entire SaaS deployment. A "kernel update package" is uploaded once and applied to the whole platform. `views_packages.py:223-231` aggregates counts by `package_type` and `status` with no tenant filter — that's correct: there is no tenant. Keep as-is.

**Recommended action**: add a docstring note `Tenant Isolation: N/A (platform-level deployment artifact)` to make intent explicit (out of scope for migration; doc-only).

---

### 3. `GeneratedDocument` — `apps/pos/models/generated_document.py:11`
```python
class GeneratedDocument(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='generated_documents')
    order_id = models.IntegerField(null=True, blank=True, db_index=True)
    purchase_id = models.IntegerField(null=True, blank=True, db_index=True)
    doc_type = models.CharField(...)
    status = models.CharField(...)
    ...
```
**Decision**: **MIGRATE** (low-risk).
**Rationale**: Already has `organization = ForeignKey(Organization)` with the right relationship — just doesn't inherit `TenantModel`, so the auto-filter manager isn't applied. Cross-tenant leak risk: any code calling `GeneratedDocument.objects.filter(...)` without an explicit `organization` filter could see other orgs' documents. A grep for usage shows `register_order.py:283` does `GeneratedDocument.objects.create(organization=...)` and `register_order.py:314` does `.filter(order_id=..., status='READY')` — the latter is missing the org filter and would benefit from auto-tenant-filtering.

**Migration design**:
1. Change `class GeneratedDocument(models.Model)` → `class GeneratedDocument(TenantModel)`.
2. Drop the explicit `organization = ForeignKey(...)` line; `TenantModel` provides it (same column name, same FK target).
3. Need `db_column='tenant_id'` adjustment? Check existing migration. Existing schema has `organization_id` column — `TenantModel` declares it with `db_column='tenant_id'`, which would rename the column. **Compatibility risk**: must either keep the old column name OR generate a `RenameField` migration. Decision: keep the column as `organization_id` by overriding the inherited field at the model level OR add a no-op migration `state_operations` to align state/db.

   *Actual approach used*: re-declare the FK with explicit `db_column='organization_id'` to match the existing DB column. (Note: `tenant_id` is the naming convention but legacy `apps/pos` migrations used `organization_id`. Check via the existing 0044 migration.)
4. Run `makemigrations pos` — should produce a `AlterModelOptions` / managers change but no schema diff if column name stays.
5. Backfill: not required (org FK was already required).
6. Update `register_order.py:314` to drop `organization_id=org_id` since the manager now scopes automatically — *but leave it for explicitness* (defense in depth; doesn't hurt).

---

### 4. `POSAuditRule` — `apps/pos/models/audit_models.py:5`
```python
class POSAuditRule(models.Model):
    organization = models.ForeignKey(Organization, ..., related_name='pos_audit_rules')
    event_type = models.CharField(max_length=50)
    send_notification = models.BooleanField(default=False)
    ...
    class Meta:
        unique_together = ('organization', 'event_type')
```
**Decision**: **MIGRATE** (low-risk).
**Rationale**: Same shape as `GeneratedDocument` — explicit `organization` FK, but no auto-filter manager. View `audit_views.py:9-22` already filters manually — converting to `TenantModel` makes that filter automatic and lets the manual `.filter(organization_id=...)` become redundant (still safe to leave).

**Migration design**: identical to `GeneratedDocument`. Re-declare FK with `db_column='organization_id'` to avoid a column rename. Inheriting `TenantModel` only changes the manager + makes the FK abstract.

---

### 5. `POSAuditEvent` — `apps/pos/models/audit_models.py:27`
```python
class POSAuditEvent(models.Model):
    organization = models.ForeignKey(Organization, ..., related_name='pos_audit_events')
    register = models.ForeignKey(POSRegister, ...)
    ...
```
**Decision**: **MIGRATE** (low-risk).
**Rationale**: Same as `POSAuditRule`. View at `audit_views.py:24-49` filters by org manually.

---

### 6. `SalesAuditLog` — `apps/pos/models/audit_models.py:60`
```python
class SalesAuditLog(models.Model):
    organization = models.ForeignKey(Organization, ..., related_name='sales_audit_logs', db_index=True)
    order = models.ForeignKey('pos.Order', ...)
    actor = models.ForeignKey(User, ...)
    action_type = models.CharField(...)
    ...
    class Meta:
        indexes = [
            models.Index(fields=['organization', 'order', 'created_at']),
            models.Index(fields=['organization', 'action_type', 'created_at']),
        ]
```
**Decision**: **MIGRATE** (low-risk).
**Rationale**: Already has `organization` FK + composite indexes that include it. The `log()` classmethod (`audit_models.py:156-189`) explicitly passes `organization=order.organization` — no breakage from converting. Index references to `'organization'` keep working since the column name is unchanged.

---

### 7. `StorageProvider` — `apps/storage/models/storage_models.py:50`
```python
class StorageProvider(models.Model):
    """Cloud storage configuration — one per organization. Null = platform default."""
    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE,
        null=True, blank=True,  # ← INTENTIONALLY NULLABLE
        related_name='storage_provider',
        help_text='Null = platform default provider'
    )
    ...
    @classmethod
    def get_for_organization(cls, organization):
        provider = cls.objects.filter(organization=organization, is_active=True).first()
        if provider:
            return provider
        return cls.objects.filter(organization__isnull=True, is_active=True).first()
```
**Decision**: **KEEP** (system-level with optional tenancy).
**Rationale**: This model intentionally supports NULL `organization` — that's the **platform default provider**. Converting to `TenantModel` would either:
  - Make the FK non-nullable (breaking the platform default), or
  - Force the auto-filtering manager to hide the platform default from every org query (the `get_for_organization` fallback breaks because `cls.objects.filter(organization__isnull=True)` would return zero rows under `TenantManager`).

The `get_for_organization` classmethod handles tenant scoping by hand and is the canonical access pattern. Keep as-is. Add a docstring note clarifying intent.

> Note: there is a **shadow `apps/storage/models.py`** file alongside the active `apps/storage/models/` package. Python packages take precedence over same-name modules; the `models/` package is what Django registers (verified by `Model.__module__`). The shadow `models.py` is dead code. Out of scope for this phase, but should be archived in a cleanup pass.

---

### 8. `UploadSession` — `apps/storage/models/upload_models.py:14`
```python
class UploadSession(models.Model):
    id = models.UUIDField(primary_key=True, ...)
    filename = models.CharField(...)
    total_size = models.BigIntegerField(...)
    bytes_received = models.BigIntegerField(default=0)
    ...
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        null=True, blank=True,  # ← INTENTIONALLY NULLABLE
        related_name='upload_sessions'
    )
    upload_type = models.CharField(
        max_length=20, default='file',
        choices=(('file', 'Organization File'), ('package', 'System Package')),
    )
```
**Decision**: **INVESTIGATE** (mixed semantics).
**Rationale**: This model serves TWO distinct upload flows:
- `upload_type='file'` → tenant-scoped file uploads (organization is required).
- `upload_type='package'` → platform-level package uploads (no organization; uploaded by SaaS admin).

The current schema has `organization` as nullable to accommodate the package case. Converting to `TenantModel` (non-nullable FK) would break package uploads. Converting to `TenantOwnedModel` (nullable FK with auto-filter) would still hide the package rows from the package admin UI under tenant context.

**Recommendation**: split into two models (`OrganizationUploadSession(TenantModel)` + `PackageUploadSession(models.Model)`) OR enforce a strict policy at the view layer with a partial-index check. This is a **larger refactor** that warrants its own ticket, not a drive-by conversion. **Skip** for this phase.

---

### 9. `MigrationMapping` — `apps/migration/models.py:87`
```python
class MigrationMapping(models.Model):
    job = models.ForeignKey(MigrationJob, on_delete=models.CASCADE, related_name='mappings')
    entity_type = models.CharField(max_length=20, choices=ENTITY_TYPES)
    source_id = models.IntegerField(...)
    target_id = models.IntegerField(...)
    ...
```
**Decision**: **KEEP** (transitively tenant-scoped via parent).
**Rationale**: `MigrationJob` already inherits `TenantModel` (has its own `organization` FK). `MigrationMapping` is a child detail table where `job` is non-nullable — every row's tenancy is fully determined by `mapping.job.organization`. Adding a redundant `organization` FK would denormalize without adding safety. Cross-tenant leak risk is zero **provided** all queries either filter by `job` or use `MigrationMapping.objects.filter(job__organization=...)`.

Audit confirms all current call sites pass through `job` (e.g. `views_review.py:51 .filter(job=job, ...)`, `services_rollback.py:74 .filter(job=...)`). **Keep as-is**, but document the transitivity in the model docstring.

---

### 10. `MigrationMapping` — `apps/migration_v2/models.py:140` (the 10th model)
Same shape as #9: child detail of `MigrationJob` (which inherits `TenantModel`), tied via `job = ForeignKey(MigrationJob, on_delete=CASCADE)`. **Decision**: **KEEP** for the same reason.

---

## Summary

| # | Model | Path | Decision |
|---|---|---|---|
| 1 | Currency | apps.reference.models | **KEEP** (SaaS-level catalog) |
| 2 | PackageUpload | apps.packages.models | **KEEP** (platform deployment artifact) |
| 3 | GeneratedDocument | apps.pos.models.generated_document | **MIGRATE** |
| 4 | POSAuditRule | apps.pos.models.audit_models | **MIGRATE** |
| 5 | POSAuditEvent | apps.pos.models.audit_models | **MIGRATE** |
| 6 | SalesAuditLog | apps.pos.models.audit_models | **MIGRATE** |
| 7 | StorageProvider | apps.storage.models.storage_models | **KEEP** (nullable org for platform default) |
| 8 | UploadSession | apps.storage.models.upload_models | **INVESTIGATE** (split-by-type) |
| 9 | MigrationMapping (v1) | apps.migration.models | **KEEP** (transitive via job) |
| 10 | MigrationMapping (v2) | apps.migration_v2.models | **KEEP** (transitive via job) |

**MIGRATE count**: 4 models, all in `apps.pos`.

---

## Migration Plan — POS Audit + Generated Documents

### Step 1: Re-parent the four models

For each model, change `class X(models.Model)` → `class X(TenantModel)` and **remove** the explicit `organization = models.ForeignKey(...)` declaration *if and only if* the inherited field has the same `db_column`. Since `TenantModel` declares `db_column='tenant_id'` but the existing DB columns are `organization_id`, **we re-declare** the FK locally with `db_column='organization_id'` and the original `related_name`.

Edited files:
- `erp_backend/apps/pos/models/generated_document.py`
- `erp_backend/apps/pos/models/audit_models.py`

### Step 2: Generate Django migrations

Per app: `python3 manage.py makemigrations pos --name tenant_isolation_audit_models`

Expected diff: `AlterField` on the `organization` FK to align state with the redeclared field, plus possibly a `AlterModelManagers` change (different default manager). **No data migration needed** — every existing row has a non-null `organization_id`.

### Step 3: Verify with `migrate --plan`

`python3 manage.py migrate --plan` → confirm only forward operations, no destructive `RemoveField` / `DeleteModel`.

### Step 4: `manage.py check`

Must pass. Pre-existing baseline = 1 warning (`auth.W004` on `User.username`) + 0 errors.

### Step 5: Verify call sites

- `audit_views.py` (queryset already filters by org_id) — keep manual filter; redundant but defensive.
- `register_order.py:283` and `:314` — keep manual `organization=...` in filter/create; auto-filter just adds belt-and-suspenders.
- `forensic_audit_service.py:51` and `:62` — explicit org passed; no change needed.
- Serializers / admin — no change required.

### Step 6: Documentation

Mark Phase 4 as DONE in `WORKMAP.md` after verification.

---

## Out of scope (deferred)

- **`UploadSession` split** — needs design work (separate models for file vs. package uploads) and dedicated ticket.
- **Shadow `apps/storage/models.py`** — dead-code archive in a cleanup pass.
- **Documenting `MigrationMapping` transitivity** — minor doc-only edit, not migration-worthy on its own.
- **Currency / PackageUpload doc clarifications** — same; minor doc edits, no model changes.

---

## Risk

LOW-MEDIUM. The only schema change is converting the manager (no column rename when `db_column='organization_id'` is preserved). No data migration required because every existing row already has a non-null `organization_id`. Worst case: the new auto-filtering manager hides a row that some unscoped admin query expected to see — mitigation: those admin paths can use `Model.original_objects.all()`.

---

## Execution Log — 2026-04-30

### Files modified
- `erp_backend/apps/pos/models/audit_models.py` — three classes converted to `TenantModel`; `organization` FK re-declared with `db_column='organization_id'` to keep historical column name.
- `erp_backend/apps/pos/models/generated_document.py` — `GeneratedDocument` converted to `TenantModel`; same column-preservation pattern.

### Generated migration
- `erp_backend/apps/pos/migrations/0080_tenant_isolation_audit_models.py` — 4 `AlterField` operations adding the explicit `db_column='organization_id'`. **No data migration required** (all existing rows have non-null `organization_id`); **no actual schema change** (the column was already named `organization_id` in the DB; this aligns Django's state with the DB).

### Verification
- `python3 manage.py check` → **PASSES** (1 pre-existing `auth.W004` warning, unchanged baseline).
- `python3 manage.py migrate --plan` → blocked by an **unrelated pre-existing finance migration conflict** (`0076_backfill_monetary_classification` vs `0078_payment_gateway_catalog`); these files are untouched by Phase 4. The new `0080_tenant_isolation_audit_models` migration itself is parseable and shown as pending in `manage.py showmigrations pos`.
- Call-site review: existing manual `.filter(organization_id=...)` and `.create(organization=...)` calls in `audit_views.py`, `register_order.py`, `forensic_audit_service.py`, and `workflow_service.py` continue to work — they're now redundant (the manager auto-filters) but harmless.

### NOT executed (per task spec — "do NOT apply migrations")
- `manage.py migrate` was not run. The user applies migrations on their own clock.

### Blockers / follow-ups
1. **Pre-existing finance migration conflict** (`0076_backfill_monetary_classification` vs `0078_payment_gateway_catalog`) — needs `makemigrations --merge` from whoever owns that area; unrelated to Phase 4.
2. **`UploadSession` split** — flagged INVESTIGATE; requires design ticket separating per-org file uploads from platform package uploads.
3. **Doc clarifications** for `Currency`, `PackageUpload`, `StorageProvider`, `MigrationMapping (×2)` — explicitly mark `Tenant Isolation: N/A (rationale)` in their docstrings. Trivial edits, deferred to a doc-only PR.
4. **Shadow `apps/storage/models.py`** — dead code (Python prefers the `models/` package); archive in cleanup pass.
