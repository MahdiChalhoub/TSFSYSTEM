---
trigger: always_on
description: Multi-tenancy isolation and module import isolation rules
---

# Isolation Rules

## Part 1: Tenant Isolation (Multi-Tenancy)

1. Every record in the system MUST belong to exactly ONE organization
2. All queries MUST be scoped to `organization_id`
3. `organization_id` must be derived from the authenticated user context, NOT from client request body
4. No table may exist without an `organization` ForeignKey (except system-level tables like SystemModule)
5. Composite unique keys should include `organization_id`
6. `get_queryset()` must always filter by organization
7. Admin views that aggregate across orgs must be explicitly marked as SaaS-only
8. Cross-organization joins are FORBIDDEN — use ConnectorEngine instead
9. All tenant isolation rules must be tested

## Part 2: Module Import Isolation

Modules must NEVER import from each other directly.

1. Only **self-imports** are ungated (e.g., `from apps.finance.models import Invoice` within finance module)
2. If it's a DIFFERENT module, use:
   - **ConnectorEngine** for cross-module data
   - **Gated import** wrapped in `try/except ImportError`
   - **Django signals** for event-based communication
   - **ModelRegistry** for module model discovery
3. Every new module MUST have an `events.py` file for signal-based communication
4. If a module import fails, the system must remain functional — graceful degradation

### Example: Gated Import
```python
# CORRECT — gated import
try:
    from apps.finance.models import Invoice
    HAS_FINANCE = True
except ImportError:
    HAS_FINANCE = False

if HAS_FINANCE:
    # Use finance features
    pass
```

```python
# WRONG — hard import
from apps.finance.models import Invoice  # Breaks if finance not installed
```
