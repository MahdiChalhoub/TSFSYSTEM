# Universal Module Connector Architecture

## Goal
Route ALL inter-module communication through the ConnectorEngine to achieve true module isolation. Modules never import from each other directly. The kernel boots and runs even if any business module is removed.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      KERNEL (erp/)                           │
│  All module re-exports gated with try/except                 │
│  ProvisioningService uses ConnectorEngine.dispatch_event()   │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
            ┌──────────────┼──────────────────┐
            │      ConnectorEngine            │
            │  📡 dispatch_event() — Events   │
            │  📖 route_read()    — Queries   │
            │  ✏️ route_write()   — Mutations  │
            │  📦 buffer_request — Resilience  │
            └──┬───────┬──────┬───────┬───────┘
               ↓       ↓      ↓       ↓
         ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
         │Finance ││  CRM   ││  POS   ││Invent. ││  HR    │
         │events  ││events  ││events  ││events  ││events  │
         └────────┘└────────┘└────────┘└────────┘└────────┘
```

## Isolation Strategy

### Self-imports (OK ✅)
```python
# Inside apps/pos/services.py — this is FINE
from apps.pos.models import Order, OrderLine
```

### Cross-module imports (Gated 🔒)
```python
# Inside apps/pos/services.py — GATED with safety
try:
    from apps.finance.services import LedgerService
except ImportError:
    LedgerService = None

if not LedgerService:
    raise ValidationError("Finance module required for this operation.")
```

### Kernel re-exports (Gated 🔒)
```python
# In erp/models.py, erp/views.py, erp/serializers/core.py
try:
    from apps.finance.models import ChartOfAccount, ...
except ImportError:
    pass  # Kernel boots without finance module
```

## Modules Isolated

| Module | Cross-Module Imports | Gating Strategy |
|--------|---------------------|-----------------|
| **POS** | Inventory (4×), Finance (4×), CRM (1×) | `_safe_import()` helper |
| **Finance** | Inventory (1×), CRM (2×), POS (1×) | `try/except` |
| **Inventory** | Finance (1×) | `try/except` |
| **HR** | Finance (2×) | `try/except` |
| **CRM** | ✅ Clean | — |
| **MCP** | ✅ Clean | — |
| **Packages** | ✅ Clean | — |

## Event Handlers

Every module has an `events.py` discovered by ConnectorEngine:

| Module | File | Events Handled |
|--------|------|---------------|
| Finance | `apps/finance/events.py` | `org:provisioned`, `contact:created` |
| CRM | `apps/crm/events.py` | `org:provisioned` |
| Inventory | `apps/inventory/events.py` | `order:completed`, `order:voided`, `org:provisioned` |
| POS | `apps/pos/events.py` | `payment:received`, `inventory:low_stock` |
| HR | `apps/hr/events.py` | `org:provisioned`, `payroll:processed` |

## ConnectorEngine Discovery (Dual Strategy)
1. **ModuleContract DB records** — modules declare subscriptions
2. **Filesystem scan** — scans `INSTALLED_APPS` for `apps.{module}.events.handle_event()`

## Resilience
- Module missing → events buffered in `BufferedRequest` (24h TTL)
- Module returns → buffered events replayed
- Kernel always boots regardless of module availability

## PWA/Offline Support
This architecture is server-side only. PWA offline mode (IndexedDB + Service Worker) works independently at the frontend layer. When offline transactions sync back, the ConnectorEngine processes them normally.

## Key Files

| File | What Changed |
|------|-------------|
| `erp/services.py` | ProvisioningService → event dispatch only |
| `erp/connector_engine.py` | Dual discovery + buffering + result chaining |
| `erp/models.py` | All re-exports gated |
| `erp/views.py` | All re-exports gated |
| `erp/serializers/core.py` | All re-exports gated |
| `apps/pos/services.py` | 9 imports gated via `_safe_import()` |
| `apps/finance/services.py` | 4 imports gated via try/except |
| `apps/inventory/services.py` | 1 import gated via try/except |
| `apps/hr/views.py` | 2 imports gated via try/except |
| `apps/*/events.py` | Event handlers for all 5 modules |
