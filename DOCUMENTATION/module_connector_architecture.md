# Module Connector Architecture

## Goal
Route ALL inter-module communication through the ConnectorEngine to achieve true module isolation. Modules never import from each other directly.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KERNEL (erp/)                            │
│  ProvisioningService creates: Organization, Site, Warehouse │
│                      ↓                                      │
│  ConnectorEngine.dispatch_event('org:provisioned', payload) │
└────────────────────────┬────────────────────────────────────┘
                         ↓
        ┌────────────────┼──────────────────┐
        ↓                ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Finance    │  │     CRM      │  │  Inventory   │
│  events.py   │  │  events.py   │  │  (future)    │
│              │  │              │  │              │
│ • FiscalYear │  │ • Billing    │  │ • Default    │
│ • CoA (17)   │  │   Contact    │  │   warehouse  │
│ • Cash Drawer│  │   in SaaS    │  │   categories │
│ • PostRules  │  │   org CRM    │  │              │
│ • Settings   │  └──────────────┘  └──────────────┘
└──────────────┘
```

## Event Flow

### `org:provisioned` (emitted by Kernel after creating Organization)

| Step | Module   | Action |
|------|----------|--------|
| 1    | Finance  | Creates FiscalYear + 12 periods, 17-account CoA, Cash Drawer, posts rules, settings |
| 2    | CRM      | Creates billing Contact in SaaS master org, links `billing_contact_id` |
| 3    | Finance  | (future) Receives `contact:created`, creates ledger sub-account |

### ConnectorEngine Discovery (Dual Strategy)

1. **ModuleContract DB records** — modules declare event subscriptions in `needs.events_from` JSON
2. **Filesystem scan** — scans `INSTALLED_APPS` for `apps.{module}.events.handle_event()`

Strategy 2 ensures events are delivered even before contracts are registered.

### Resilience

- If a module is **missing/disabled** → events are **buffered** in `BufferedRequest` table
- When module becomes available → buffered events are **replayed** automatically
- Kernel objects (Org, Site, Warehouse) are always created regardless of module status

## Data Sources

### READ from
- `erp.Organization` — kernel model
- `erp.Site` — kernel model
- `erp.Warehouse` — kernel model
- `erp.SystemModule` — connector state check
- `erp.OrganizationModule` — tenant module state
- `erp.connector_models.ModuleContract` — event subscriptions
- `erp.connector_models.BufferedRequest` — event queue

### WRITE to
- `erp.Organization` — kernel provisioning
- `erp.Site` — kernel provisioning
- `erp.Warehouse` — kernel provisioning
- `finance.ChartOfAccount` — via finance event handler
- `finance.FiscalYear` — via finance event handler
- `finance.FiscalPeriod` — via finance event handler
- `finance.FinancialAccount` — via finance event handler
- `crm.Contact` — via CRM event handler
- `erp.SystemSettings` — posting rules + global settings
- `erp.connector_models.BufferedRequest` — event buffering
- `erp.connector_models.ConnectorLog` — audit trail

## Variables Users Interact With
- Organization name, slug (provisioning input)
- Module enable/disable toggles (affects event routing)

## Key Files

| File | Purpose |
|------|---------|
| `erp/services.py` | ProvisioningService (kernel objects + event dispatch) |
| `erp/connector_engine.py` | ConnectorEngine (event routing, buffering, circuit breaker) |
| `erp/connector_models.py` | ModuleContract, BufferedRequest, ConnectorLog |
| `apps/finance/events.py` | Finance event handler (CoA, fiscal, accounts, settings) |
| `apps/crm/events.py` | CRM event handler (billing contact) |

## How It Achieves Its Goal
The kernel NEVER imports from business modules. Instead, it emits events through the ConnectorEngine, which discovers event handlers via importlib and delivers payloads. Each module creates its own data in its own transaction. If a module crashes or is missing, the event is buffered and retried later.
