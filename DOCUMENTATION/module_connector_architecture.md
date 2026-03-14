# Universal Module Connector Architecture

> **Last Updated:** 2026-03-12
> **Status:** ✅ 100% Architecture Compliance — ZERO cross-module import violations

## Goal
Route ALL inter-module communication through the **Connector Governance Layer** to achieve true module isolation. Modules never import from each other directly. The kernel boots and runs even if any business module is removed.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     KERNEL (erp/)                             │
│  connector_registry.py   — Capability Registry               │
│  connector_engine.py     — Runtime Router (read/write/event) │
│  connector_routing.py    — Request Routing Layer              │
│  connector_state.py      — Module State Machine              │
│  connector_events.py     — Event Dispatch                    │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
       ┌───────────────────┼────────────────────────────┐
       │          ConnectorRegistry                     │
       │  🧠 connector.require()  — Resolve capability  │
       │  📡 connector.execute()  — Fire capability     │
       │  📦 Auto-discovery of connector_service.py     │
       └──┬──────┬──────┬──────┬──────┬──────┬──────┬──┘
          ↓      ↓      ↓      ↓      ↓      ↓      ↓
    ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
    │Finance ││  CRM   ││  POS   ││Invent. ││  HR    ││Worksp. ││Workf.  │
    │ 26cap  ││ 10cap  ││ 12cap  ││ 20cap  ││ 3cap   ││ 10cap  ││ 1cap   │
    └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘└────────┘
       ┌────────┐┌────────┐
       │Client  ││Integr. │
       │Portal  ││ 2cap   │
       │ 3cap   ││        │
       └────────┘└────────┘
```

## Isolation Strategy

### Self-imports (OK ✅)
```python
# Inside apps/pos/services.py — this is FINE
from apps.pos.models import Order, OrderLine
```

### Cross-module access (Connector ✅)
```python
# Inside apps/inventory/signals.py — uses Connector Governance Layer
from erp.connector_registry import connector

trigger_inv = connector.require('workspace.events.trigger_inventory', org_id=0, source='inventory')
if trigger_inv:
    trigger_inv(org_id=organization.id, organization=organization, event='STOCK_ADJUSTED', ...)
```

### Model access (Connector ✅)
```python
# Inside apps/workforce/events.py — resolves model from another module
Task = connector.require('workspace.tasks.get_model', org_id=0, source='workforce')
if Task:
    Task.objects.create(organization_id=org_id, title='...', ...)
```

### ❌ DEPRECATED — No longer used
```python
# _safe_import() — FULLY REMOVED, zero occurrences
# try/except ImportError gating — FULLY REMOVED for cross-module imports
```

## Connector Service Files

Every module that exposes capabilities to others has a `connector_service.py`:

| Module | File | Capabilities | Description |
|--------|------|:---:|-------------|
| **Finance** | `apps/finance/connector_service.py` | 26 | Accounts, invoices, journal, payments, tax, services |
| **Inventory** | `apps/inventory/connector_service.py` | 20 | Products, stock, warehouses, services, movements |
| **POS** | `apps/pos/connector_service.py` | 12 | Orders, purchase orders, delivery zones, procurement |
| **CRM** | `apps/crm/connector_service.py` | 10 | Contacts, pricing groups, loyalty services |
| **Workspace** | `apps/workspace/connector_service.py` | 10 | Tasks, event triggers, auto-task engine |
| **HR** | `apps/hr/connector_service.py` | 3 | Employee model and listings |
| **Client Portal** | `apps/client_portal/connector_service.py` | 3 | ClientOrder, ClientOrderLine, ClientPortalConfig |
| **Integrations** | `apps/integrations/connector_service.py` | 2 | DomainEventService |
| **Workforce** | `apps/workforce/connector_service.py` | 1 | WorkforceScoreEngine |

**Totals:** 96 registered capabilities, 63 actively used across the codebase.

## Module Compliance Status

| Module | Cross-Module Violations | Status |
|--------|:---:|--------|
| **Finance** | 0 | ✅ Clean |
| **Inventory** | 0 | ✅ Clean |
| **POS** | 0 | ✅ Clean |
| **CRM** | 0 | ✅ Clean |
| **HR** | 0 | ✅ Clean |
| **Workspace** | 0 | ✅ Clean |
| **Workforce** | 0 | ✅ Clean (structural exception: HR FK) |
| **eCommerce** | 0 | ✅ Clean (structural exception: client_portal proxy) |
| **Client Portal** | 0 | ✅ Clean |
| **Integrations** | 0 | ✅ Clean |
| **Sales** | 0 | ✅ Clean |
| **Packages** | 0 | ✅ Clean |

## Structural Exceptions

These are *not* violations — they are structural dependencies that cannot be decoupled:

| Source | Target | Reason | Scope |
|--------|--------|--------|-------|
| `workforce` | `hr` | ForeignKey to `Employee` model | `models.py` only |
| `ecommerce` | `client_portal` | Proxy model inheritance | `models.py` only |

## Architecture Compliance Test

```bash
python manage.py test erp.tests.test_architecture --verbosity=2
```

The test suite scans all 12 business modules for:
1. **Direct cross-module imports** — `from apps.X.Y import Z` where X ≠ current module
2. **Connector service existence** — Core modules must have `connector_service.py`
3. **Clean connector layer** — `connector_registry.py` must not import business modules

## Event Infrastructure

### Kernel Event Bus (`kernel/events.py`)
Domain events for decoupled pub/sub:
```python
from kernel.events import emit_event, subscribe_to_event

emit_event('order.completed', payload, aggregate_type='order', aggregate_id=order.id)
```

### Workspace Auto-Task Engine
Business events trigger automated task creation:
```python
trigger_inv = connector.require('workspace.events.trigger_inventory', ...)
trigger_inv(org_id=org.id, organization=org, event='STOCK_ADJUSTED', ...)
```

### WISE (Workforce Intelligence & Scoring Engine)
Cross-module events feed employee performance scoring:
```python
WorkforceScoreEngine = connector.require('workforce.services.get_score_engine', ...)
WorkforceScoreEngine.record_event(employee=emp, event_code='task_completed_early', ...)
```

## Key Files

| File | Purpose |
|------|---------|
| `erp/connector_registry.py` | Capability registry + auto-discovery |
| `erp/connector_engine.py` | Runtime broker (read/write/event routing) |
| `erp/connector_routing.py` | Request routing layer |
| `erp/connector_state.py` | Module state machine (4 states) |
| `erp/connector_events.py` | Event dispatch infrastructure |
| `erp/tests/test_architecture.py` | Compliance enforcement (CI/CD gate) |
| `apps/*/connector_service.py` | Per-module capability declarations |
| `kernel/events.py` | Domain event bus |

## Resilience

- **Module missing** → `connector.require()` returns `None`, caller handles gracefully
- **Module disabled** → Connector policies determine fallback (EMPTY, CACHED, ERROR)
- **Kernel always boots** regardless of which business modules are installed
- **Write buffering** → `BufferedRequest` model with configurable TTL for replay
