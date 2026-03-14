# ADR-001: ConnectorEngine for Cross-Module Communication

**Status**: Accepted
**Date**: 2026-02-24
**Decision Makers**: Core Architecture Team

## Context

TSFSYSTEM has 8+ backend modules (Finance, POS, CRM, Inventory, HR, Sales, Delivery, eCommerce). Direct imports between modules create tight coupling, circular dependencies, and make it impossible to deploy modules independently.

## Decision

All cross-module communication must go through the **ConnectorEngine** — a centralized service registry that allows modules to request services from other modules without direct imports.

```python
# ❌ Forbidden
from apps.finance.services import LedgerService

# ✅ Required
connector = ConnectorEngine(organization)
LedgerService = connector.require('finance.services.get_ledger_service', org_id=org.id, source='pos')
```

## Rationale

1. **Module isolation** — each module can be developed, tested, and deployed independently
2. **Explicit dependencies** — cross-module calls are visible and traceable through `connector.require()`
3. **Testability** — modules can be tested with mock connectors
4. **Enforceability** — the architecture fitness script checks for direct imports (check #1, #12)

## Consequences

- **Positive**: 39+ connector references across the codebase; zero direct finance imports from POS/CRM/Inventory
- **Negative**: Slight indirection cost; requires `ConnectorEngine` boilerplate in services
- **Enforcement**: `check-architecture-fitness.sh` checks #1 (cross-module imports) and #12 (app isolation)
