---
trigger: always_on
description: Kernel OS v2.0 primitives — TenantOwnedModel, emit_event, get_config, @require_permission, AuditableModel
---

# Kernel OS v2.0 — Primitives and When to Use Them

The kernel at [`erp_backend/kernel/`](../../erp_backend/kernel/) provides stricter, centralized implementations of the cross-cutting concerns described in [`architecture.md`](architecture.md) and [`isolation.md`](isolation.md). This file documents those primitives and how they coexist with the legacy Django-signals / manual-org-FK approach.

**Principle**: same rules, newer implementation. OS v2.0 does not replace the architecture rules — it enforces them in code.

---

## 1. Tenant isolation — `TenantOwnedModel`

Source: [`kernel/tenancy/models.py:14`](../../erp_backend/kernel/tenancy/models.py#L14)

```python
from kernel.tenancy.models import TenantOwnedModel

class DecisionRule(AuditLogMixin, TenantOwnedModel):
    name = models.CharField(max_length=200)
```

What it gives you automatically:
- `organization` FK (stored as `tenant_id`) — satisfies isolation rule #1 in [`isolation.md`](isolation.md).
- `.objects` is `TenantManager` — all queries auto-filter by current tenant (satisfies isolation rule #6).
- `save()` auto-assigns `organization` from request context; raises if no tenant context.
- `delete()` blocks cross-tenant deletion.
- `all_objects` / `original_objects` escape hatches for explicitly cross-tenant queries (SaaS admin views only).

**Use `TenantOwnedModel` for all NEW tenant-scoped models.** Legacy models with a manual `organization = ForeignKey(...)` remain valid — migrate only when touching the model for other reasons.

Note: `TenantOwnedModel.organization` is nullable at the DB level but `save()` enforces it. Do not rely on the DB constraint for enforcement.

---

## 2. Audit trail — `AuditableModel` / `AuditLogMixin`

Source: [`kernel/audit/mixins.py`](../../erp_backend/kernel/audit/mixins.py) — `AuditLogMixin` is an alias for `AuditableModel` (line 147).

```python
from kernel.audit.mixins import AuditLogMixin

class Invoice(AuditLogMixin, TenantOwnedModel):
    total = models.DecimalField(max_digits=12, decimal_places=2)
```

Records create / update / delete events with actor, timestamp, and field-level diffs. Excludes `id`, `created_at`, `updated_at`, `modified_at` by default.

**Order matters**: audit mixin first, `TenantOwnedModel` second. This is consistent across every real model in [`erp_backend/apps/`](../../erp_backend/apps/) and [`erp_backend/kernel/`](../../erp_backend/kernel/).

**Use on all new models that represent business data.** Reference tables and read-only caches may skip it — justify in the plan.

---

## 3. Cross-module communication — `emit_event` / `subscribe_to_event`

Source: [`kernel/events/`](../../erp_backend/kernel/events/)

```python
from kernel.events import emit_event, subscribe_to_event

emit_event(
    event_type='invoice.posted',
    payload={'invoice_id': invoice.id},
    aggregate_type='invoice',
    aggregate_id=invoice.id,
)

@subscribe_to_event('invoice.*')
def on_invoice_event(event):
    ...
```

How this relates to existing rules (module communication in [`architecture.md`](architecture.md) rule 3, [`isolation.md`](isolation.md) part 2):

| Legacy option | OS v2.0 equivalent |
|---|---|
| Django signals | `emit_event` / `subscribe_to_event` |
| ConnectorEngine | `emit_event` with typed contract |
| Gated `try/except` import | Still valid for synchronous read access across optional modules |

The event bus stores events in an outbox table, so delivery survives crashes and can be replayed. Prefer `emit_event` over raw Django signals for new inter-module flows.

REST APIs across modules are still fine for synchronous read queries. Never import another module's services directly.

---

## 4. Configuration — `get_config`

Source: [`kernel/config/config_manager.py:186`](../../erp_backend/kernel/config/config_manager.py#L186)

```python
from kernel.config import get_config, is_feature_enabled

tax_rate = get_config('default_tax_rate', default=0.15)

if is_feature_enabled('new_invoice_ui', user=request.user):
    ...
```

Rule: **no hardcoded configurable values** (tax rates, thresholds, tenant-tunable limits, feature toggles). Protocol constants (HTTP status codes, π) are fine.

Config is tenant-scoped by default. Pass `organization=` explicitly for cross-tenant reads (SaaS admin).

---

## 5. Authorization — `@require_permission`

Source: [`kernel/rbac/decorators.py`](../../erp_backend/kernel/rbac/decorators.py)

```python
from kernel.rbac.decorators import require_permission

@require_permission('invoicing.create')
def create_invoice(request):
    ...
```

Complements the existing security rule "authorization checks MUST happen on server" ([`security.md`](security.md) rule 10).

- **Write / delete / state-change endpoints**: `@require_permission`, always.
- **Read endpoints**: require permission unless the data is public by design.
- **Background jobs acting for a user**: check that user's permissions, not the worker's.

---

## 6. When to use OS v2.0 vs. legacy

| Scenario | Use |
|---|---|
| New model in a new/active module | `AuditLogMixin + TenantOwnedModel` |
| Existing legacy model you're only querying | Leave alone |
| Existing legacy model you're adding fields to | Add fields; consider migrating to `TenantOwnedModel` only if the change is substantial |
| New cross-module flow | `emit_event` / `subscribe_to_event` |
| Cross-module flow already wired via Django signals | Leave alone; extend with signals or migrate deliberately |
| New configurable value | `get_config` |
| Hardcoded value you notice in legacy code | Propose migration to `get_config` in a dedicated plan, not a drive-by |
| New endpoint | `@require_permission` + org/permission context |

**Do not migrate legacy modules to OS v2.0 as a side effect of other work.** Each migration is its own plan.

---

## 7. Validation

Before declaring a change done, check:

1. Models inherit `AuditLogMixin, TenantOwnedModel` (order matters) — or have a documented exception.
2. No hardcoded tax rates, currencies, limits, thresholds — all via `get_config`.
3. Cross-module calls use `emit_event` (preferred) or signals (legacy) — never direct imports.
4. Mutating endpoints have `@require_permission`.
5. File-size limit from [`code-quality.md`](code-quality.md) still holds (≤300 lines).

See also: [`kernel/README.md`](../../erp_backend/kernel/README.md), [`kernel/KERNEL_IMPLEMENTATION_GUIDE.md`](../../erp_backend/kernel/KERNEL_IMPLEMENTATION_GUIDE.md).
