---
description: How to add cross-module communication using the Connector Governance Layer
---

# Connector Governance Layer — Integration Workflow

## RULE
**No business module may directly import another business module's models/services for runtime business operations.**

All inter-module communication MUST go through the Connector Governance Layer.

## Architecture Overview

```
┌──────────┐     connector.require()     ┌──────────────────┐     handler()     ┌──────────┐
│  Caller  │ ──────────────────────────▶ │  ConnectorFacade  │ ───────────────▶ │  Target  │
│  Module  │ ◀────────────────────────── │  (Governance Hub) │ ◀─────────────── │  Module  │
└──────────┘     result / fallback       └──────────────────┘     result        └──────────┘
                                                │
                                    ┌───────────┼───────────┐
                                    ▼           ▼           ▼
                               ┌────────┐ ┌─────────┐ ┌─────────┐
                               │ State  │ │ Policy  │ │  Audit  │
                               │ Check  │ │ Engine  │ │   Log   │
                               └────────┘ └─────────┘ └─────────┘
```

## How to ADD a new cross-module capability

### Step 1: Define the capability in the TARGET module's `connector_service.py`

```python
# apps/crm/connector_service.py

def register_capabilities(registry):

    @_cap(registry, 'crm.contacts.get_detail',
          description='Get contact by ID',
          cacheable=True, cache_ttl=120)
    def get_contact_detail(org_id, contact_id=None, **kw):
        from apps.crm.models import Contact
        contact = Contact.objects.get(id=contact_id, organization_id=org_id)
        return {'id': contact.id, 'name': contact.name, ...}
```

### Step 2: CALL the capability from the SOURCE module

```python
# apps/pos/services/some_service.py
from erp.connector_registry import connector

# READ — returns data or fallback
contact = connector.require('crm.contacts.get_detail',
                             org_id=org.id,
                             contact_id=supplier_id,
                             fallback=None,
                             source='pos')

# WRITE — executes action or buffers
connector.execute('finance.journal.post_entry',
                   org_id=org.id,
                   data={'lines': [...], 'reference': 'INV-001'},
                   source='pos')

# CHECK — is capability available?
if connector.available('inventory.stock.reserve', org_id=org.id):
    connector.execute('inventory.stock.reserve', ...)
```

### Step 3: Define fallback policy (if default is not enough)

Create a `ConnectorPolicy` record via Django admin or seed:
- `target_module`: 'finance'
- `target_endpoint`: 'journal.post_entry'
- `when_missing_write`: 'buffer' (queue for later replay)
- `when_disabled_write`: 'error' (fail because org chose to disable)

## Fallback Policy Table

| Scenario                        | Fallback Type      | When to Use                            |
|---------------------------------|--------------------|-----------------------------------------|
| CRM contact lookup for display  | `empty` / `cached` | Soft fail — show "Unknown" or cached    |
| Stock reservation at checkout   | `error` (critical) | Hard fail — cannot sell without stock   |
| Journal posting after sale      | `buffer`           | Queue — must happen but can be delayed  |
| Dashboard analytics enrichment  | `cached`           | Stale data is acceptable briefly        |
| Tax context for PO              | `error` (critical) | Hard fail — wrong tax = legal violation |
| Notification dispatch           | `drop`             | Non-essential — can be lost             |

## Capability Naming Convention

```
{module}.{domain}.{action}

crm.contacts.get_detail
crm.contacts.list
crm.pricing.get_price_groups
inventory.products.get_detail
inventory.stock.reserve
inventory.stock.receive
finance.journal.post_entry
finance.sequences.next_value
finance.accounts.get_chart
pos.purchase_orders.get_detail
pos.orders.get_model
```

## DO NOT

1. ❌ `from apps.crm.models import Contact` — BANNED in runtime code
2. ❌ `from apps.finance.services import LedgerService` — BANNED
3. ❌ Inventing your own fallback in each module — use connector policies
4. ❌ Using `_safe_import()` — FULLY REMOVED from codebase (zero occurrences)

## DO

1. ✅ `connector.require('crm.contacts.get_detail', org_id=x, contact_id=y)`
2. ✅ `connector.execute('finance.journal.post_entry', org_id=x, data={...})`
3. ✅ Define capabilities in `connector_service.py` per module
4. ✅ Mark critical operations as `critical=True`
5. ✅ Let the connector manage caching, buffering, and fallback

## Migration Status — ✅ 100% COMPLETE (2026-03-12)

All cross-module violations eliminated. Zero remaining.
Architecture test enforces compliance at CI/CD: `erp/tests/test_architecture.py`

### Priority 1 (Business-Critical Flows) — ✅ DONE
- [x] POS → Inventory (stock, products, warehouses)
- [x] POS → Finance (ledger, sequences, tax)
- [x] POS → Workspace (auto-task triggers)
- [x] Purchases → Inventory (receiving, stock updates)
- [x] Purchases → Finance (accruals, posting)

### Priority 2 (Integration Flows) — ✅ DONE
- [x] CRM → Finance (account linking, balance lookups)
- [x] CRM → Workspace (event triggers)
- [x] HR → Finance (payroll posting)
- [x] Inventory → Workspace (event triggers)
- [x] Inventory → POS (backfill commands)
- [x] Workspace → Workforce (WISE scoring)
- [x] Workforce → Workspace (task creation)

### Priority 3 (Secondary Flows) — ✅ DONE
- [x] Client Portal → Integrations (domain events)
- [x] eCommerce → Client Portal (proxy models, config, orders)
- [x] Finance → Client Portal (payment gateways, webhooks)
- [x] Inventory → Workspace (goods receipt tasks, expiry alerts)
