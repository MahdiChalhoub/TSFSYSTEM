# Module Contracts Documentation

## Goal
Register `ModuleContract` records so the ConnectorEngine can discover event subscribers via database queries (Strategy 1) in addition to filesystem scanning (Strategy 2).

## Management Command

```bash
python manage.py register_contracts          # Create/update all contracts
python manage.py register_contracts --verbose  # Show event subscriptions
```

## How It Works

Each module has a `ModuleContract` linked 1:1 to its `SystemModule` record. The contract declares:

| Field | Purpose | Example |
|-------|---------|---------|
| `provides.events_emitted` | Events this module fires | `['order:completed']` |
| `provides.read_endpoints` | Data this module exposes | `['products/', 'stock-levels/']` |
| `needs.events_from` | Events this module subscribes to | `[{'module': 'pos', 'event': 'order:completed'}]` |
| `needs.data_from` | Data this module reads from others | `[{'module': 'inventory', 'endpoint': 'products/'}]` |
| `rules` | Graceful degradation behavior | `{'can_work_without': ['crm'], 'critical_dependencies': ['core']}` |

## Event Subscription Map

```
org:provisioned ──→ finance, crm, inventory, hr
contact:created ──→ finance
order:completed ──→ finance, inventory
order:voided ──→ inventory
inventory:adjusted ──→ finance
subscription:renewed ──→ finance
payroll:processed ──→ hr
payment:received ──→ pos
inventory:low_stock ──→ pos
```

## Data Flow

### From (READ)
- `SystemModule` table — identifies which modules are installed
- `ModuleContract` table — stores contract declarations

### To (WRITE)
- `ModuleContract` table — populated by management command

### Variables
- `module_name` — matches `SystemModule.name` (e.g., `'finance'`)
- `provides` — JSON with endpoints, events, functions
- `needs` — JSON with event subscriptions and data dependencies
- `rules` — JSON with degradation behavior

### Step-by-Step Workflow
1. Admin runs `python manage.py register_contracts`
2. Command iterates over the 5 business module definitions
3. For each, finds the `SystemModule` record by name
4. Creates or updates the `ModuleContract` with provides/needs/rules
5. ConnectorEngine's `dispatch_event()` can now use Strategy 1 (DB query) for discovery

### How This Achieves Its Goal
By storing contracts in the DB, the ConnectorEngine can query which modules subscribe to events without scanning the filesystem. This enables future features like admin UI for managing subscriptions, per-tenant module enablement, and contract versioning.
