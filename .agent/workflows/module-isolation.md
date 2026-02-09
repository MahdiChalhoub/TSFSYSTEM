---
description: Module isolation rule - modules must NEVER import from each other directly
---

# Module Isolation Rule

## The Rule
**A module must NEVER import from another module directly.** This is a hard rule with zero exceptions.

### What is allowed ✅
- **Self-imports**: `from apps.pos.models import Order` inside `apps/pos/services.py` — a module can always import its own code.
- **Kernel imports**: Any module can import from `erp.*` (kernel) — e.g., `from erp.models import Organization`.
- **Django/third-party imports**: Standard library, Django, and pip packages are fine.

### What is forbidden ❌
- **Cross-module imports**: `from apps.finance.services import LedgerService` inside `apps/pos/services.py` — one business module importing another.
- **Even in kernel files**: `erp/models.py`, `erp/views.py`, `erp/serializers/core.py` re-exports must be wrapped in `try/except ImportError`.

### How to communicate between modules
1. **Events (fire-and-forget)**: `ConnectorEngine().dispatch_event('event_name', payload, org_id)` — for side effects
2. **Reads (query data)**: `ConnectorEngine().route_read('target_module', 'endpoint', org_id)` — for fetching data
3. **Writes (mutate data)**: `ConnectorEngine().route_write('target_module', 'endpoint', data, org_id)` — for mutations
4. **Gated imports (when connector not practical)**: Wrap in `try/except ImportError` with clear error message

### Gated import pattern
```python
# In apps/pos/services.py — needs finance but handles absence gracefully
try:
    from apps.finance.services import LedgerService
except ImportError:
    LedgerService = None

if not LedgerService:
    raise ValidationError("Finance module is required for this operation.")
```

### Event handler pattern
Every module should have `apps/{module}/events.py` with:
```python
def handle_event(event_name: str, payload: dict, organization_id: int):
    handlers = {
        'some:event': _on_some_event,
    }
    handler = handlers.get(event_name)
    if handler:
        return handler(payload, organization_id)
    return None
```

### Kernel re-export pattern
```python
# In erp/models.py, erp/views.py, erp/serializers/core.py
try:
    from apps.finance.models import ChartOfAccount, ...
except ImportError:
    pass  # Kernel boots without this module
```

## When creating new code
1. Before writing any `from apps.X` import, check if X is the SAME module you're in.
2. If it's a DIFFERENT module, use the ConnectorEngine or a gated import.
3. Every new module MUST have an `events.py` file.
4. All kernel re-exports of new modules MUST be wrapped in `try/except`.

## Verification
Run `grep -r "from apps\." apps/*/services.py apps/*/views.py` — only self-imports should remain ungated.
