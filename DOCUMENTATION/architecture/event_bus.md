# ConnectorEngine Event Bus

## Goal
Enable asynchronous inter-module communication via the ConnectorEngine. Modules can fire events (e.g., `order:completed`) and other modules can react to them without direct coupling.

## Data Flow
1. **Source module** calls `connector_engine.dispatch_event('pos', 'order:completed', payload, org_id)`
2. **ConnectorEngine** finds subscribers via `ModuleContract.needs.events_from` JSON field
3. For each subscriber, checks `get_module_state()` — if AVAILABLE, calls `_deliver_event()`
4. **_deliver_event** tries two strategies:
   - **Strategy 1**: `importlib.import_module('apps.{module}.events')` → `handle_event()`
   - **Strategy 2**: Django signal `connector_event.send()` for loose coupling

## How to Subscribe to Events

### Option A: Module Event Handler (Recommended)
Create `apps/{module}/events.py`:
```python
def handle_event(event_name: str, payload: dict, organization_id: int):
    if event_name == 'order:completed':
        # React to order completion
        pass
```

### Option B: Django Signal Receiver
In any file loaded at startup:
```python
from erp.signals import connector_event
from django.dispatch import receiver

@receiver(connector_event)
def my_handler(sender, **kwargs):
    if kwargs['target_module'] == 'finance':
        # Process event
        pass
```

## How to Fire Events
```python
from erp.connector_engine import connector_engine

connector_engine.dispatch_event(
    source_module='pos',
    event_name='order:completed',
    payload={'order_id': 123, 'total': 500.00},
    organization_id=org.id
)
```

## Database Tables
- **ModuleContract**: `needs.events_from` JSON field defines which events a module subscribes to
- **ConnectorLog**: All event dispatches are logged for audit

## Files Modified
- `erp/connector_engine.py` — `_deliver_event()` implemented with 2-strategy dispatch
- `erp/signals.py` — [NEW] Django signal `connector_event`
- `apps/finance/events.py` — [NEW] Example event handler

## Variables
- `event_name`: String identifier (e.g., `'order:completed'`, `'inventory:adjusted'`)
- `payload`: Dict with event-specific data
- `organization_id`: Tenant context for multi-tenancy isolation
