# ADR-0001: ConnectorEngine Module Communication

## Status

ACCEPTED

## Context

TSFSYSTEM is a multi-module ERP (Finance, POS, Inventory, CRM, HR, Sales, eCommerce, SaaS) running in a single Django process. Without structural enforcement, modules will inevitably import directly from each other, creating a tightly coupled monolith where changes in one domain cascade unpredictably into others.

Previous state: POS directly imported from `apps.finance`, Inventory imported from `apps.finance`, and CRM referenced finance models. This made it impossible to reason about change impact or test modules in isolation.

## Decision

**All cross-module communication must go through the ConnectorEngine** (`erp_backend/kernel/connector_engine.py`).

Rules:
1. **No module may directly import from another module's `models`, `services`, or `views`.**
2. Cross-module operations are dispatched via `ConnectorEngine.route(action, data)`.
3. Each module registers its own connector handlers in `kernel/connectors/`.
4. Event-driven: modules emit events; other modules subscribe via the event system.

```python
# ✅ CORRECT
from kernel.connector_engine import ConnectorEngine
ConnectorEngine.route("finance.post_journal_entry", {"lines": [...]})

# ❌ FORBIDDEN
from apps.finance.services import LedgerService
LedgerService.create_journal_entry(...)
```

## Consequences

### Positive
- Modules can be reasoned about independently
- Change impact is traceable through connector contracts
- Architecture fitness tests can enforce the boundary (`check-architecture-fitness.sh`)
- Future: modules can be extracted into separate services if needed

### Negative
- Slight indirection overhead for cross-module calls
- Connector handlers must be maintained alongside domain logic
- Developers must learn the routing pattern

### Neutral
- 39 ConnectorEngine references already exist across apps
- 4 known violations remain in `pos_service.py` and `purchase_service.py` (tracked for remediation)

## References

- ConnectorEngine: `erp_backend/kernel/connector_engine.py`
- Connector handlers: `erp_backend/kernel/connectors/`
- Workflow: `.agents/workflows/connector-governance.md`
- Fitness test: `scripts/ci/check-architecture-fitness.sh` (check #1)
