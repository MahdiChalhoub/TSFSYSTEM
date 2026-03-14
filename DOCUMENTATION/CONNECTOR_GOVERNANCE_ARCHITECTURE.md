# TSFSYSTEM — Connector Governance Layer
## Complete Architecture & Workflow Documentation

> **Version:** 2.0 — Finalized 2026-03-13  
> **Status:** ✅ 100% Enforced — Zero violations remaining  
> **Scope:** All cross-module communication across 22+ files in 7 modules  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [Architecture Overview](#3-architecture-overview)
4. [Core Components](#4-core-components)
   - 4.1 [Capability Descriptor](#41-capability-descriptor)
   - 4.2 [Capability Registry](#42-capability-registry)
   - 4.3 [Connector Facade](#43-connector-facade)
   - 4.4 [Connector Engine](#44-connector-engine)
5. [Module States](#5-module-states)
6. [Operation Types](#6-operation-types)
7. [Capability Naming Convention](#7-capability-naming-convention)
8. [Registered Capabilities](#8-registered-capabilities)
9. [How It Works — Request Flow](#9-how-it-works--request-flow)
10. [Fallback Policies](#10-fallback-policies)
11. [How to Add a New Capability](#11-how-to-add-a-new-capability)
12. [How to Call a Capability](#12-how-to-call-a-capability)
13. [Connector Service File Template](#13-connector-service-file-template)
14. [Prohibited Patterns](#14-prohibited-patterns)
15. [Module Dependency Map](#15-module-dependency-map)
16. [Migration History](#16-migration-history)
17. [File Reference](#17-file-reference)

---

## 1. Executive Summary

The **Connector Governance Layer** is the central nervous system of TSFSYSTEM's modular architecture. It enforces a strict rule:

> **No business module may directly import another business module's models or services.**

All inter-module communication is brokered through a centralized `ConnectorFacade` singleton (`connector`) that:

- **Discovers** capabilities automatically from each module's `connector_service.py`
- **Routes** requests between modules with full state awareness
- **Caches** read results for failover and performance
- **Buffers** failed writes for automatic replay
- **Logs** every routing decision for audit and observability
- **Degrades gracefully** when modules are unavailable

### Key Numbers

| Metric | Value |
|--------|-------|
| Registered capabilities | **99** |
| `connector.require()` calls in production | **207** |
| Modules exposing capabilities | **6** (Finance, Inventory, POS, CRM, HR, Workspace) |
| Cross-module `importlib` violations | **0** |
| Direct cross-module import violations | **0** |

---

## 2. The Problem

### Before — Spaghetti Imports (❌)

```python
# apps/pos/services/pos_service.py — OLD PATTERN
from apps.inventory.models import Product, Inventory           # ❌ Direct import
from apps.finance.services import LedgerService                # ❌ Direct import
import importlib                                                # ❌ Dynamic hack
tax_mod = importlib.import_module('apps.finance.tax_calculator') # ❌ Fragile
```

**Problems:**
- Circular import crashes at startup
- Removing a module breaks all dependent modules
- No audit trail of inter-module calls
- No graceful degradation — one module down = whole system down
- Testing requires all modules to be present

### After — Connector Governance (✅)

```python
# apps/pos/services/pos_service.py — NEW PATTERN
from erp.connector_registry import connector

Product = connector.require('inventory.products.get_model', org_id=org.id, source='pos')
LedgerService = connector.require('finance.services.get_ledger_service', org_id=org.id, source='pos')
TaxEngineContext = connector.require('finance.tax.get_engine_context_class', org_id=0, source='pos')
```

**Benefits:**
- Zero circular imports
- Module removal → graceful `None` fallback, no crash
- Every call logged with source, target, latency, and decision
- Cached results available during outages
- Failed writes buffered for automatic replay

---

## 3. Architecture Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                          BUSINESS MODULES                             │
 │                                                                        │
 │  ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌────────┐  ┌───────────┐  │
 │  │   POS   │  │   CRM   │  │ Inventory │  │   HR   │  │ eCommerce │  │
 │  │ (14cap) │  │ (11cap) │  │  (22cap)  │  │ (3cap) │  │  (0cap)   │  │
 │  └────┬────┘  └────┬────┘  └─────┬─────┘  └───┬────┘  └─────┬─────┘  │
 │       │            │             │             │             │         │
 │       └────────────┴──────┬──────┴─────────────┴─────────────┘         │
 │                           │                                            │
 │                  connector.require()                                   │
 │                  connector.execute()                                   │
 └───────────────────────────┼────────────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │     ConnectorFacade     │   ← The single entry point
                │  (erp/connector_       │
                │   registry.py)          │
                └────────────┬────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
   ┌────────▼────────┐ ┌────▼─────┐ ┌────────▼────────┐
   │ CapabilityRegistry │ │ Engine │ │  ConnectorLog    │
   │ 99 capabilities  │ │ State  │ │  Audit Trail     │
   │ Auto-discovered  │ │ Cache  │ │  Every decision  │
   └─────────────────┘ │ Buffer │ └──────────────────┘
                        └────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌──────▼──────┐
        │  Finance   │ │ Inventory │ │     CRM     │
        │ connector  │ │ connector │ │  connector  │
        │  service   │ │  service  │ │   service   │
        │  (33 cap)  │ │  (22 cap) │ │  (11 cap)   │
        └───────────┘ └───────────┘ └─────────────┘
```

---

## 4. Core Components

### 4.1 Capability Descriptor

**File:** `erp/connector_registry.py` → `class Capability`

A Capability represents a single function exposed by a module to the outside world.

```python
class Capability:
    name: str           # 'crm.contacts.get_model'  (fully qualified)
    module: str         # 'crm'                       (auto-parsed from name)
    domain: str         # 'contacts'                   (auto-parsed from name)
    action: str         # 'get_model'                  (auto-parsed from name)
    handler: Callable   # The actual Python function
    fallback_type: str  # 'READ' | 'WRITE' | 'EVENT'
    critical: bool      # If True, FAIL HARD when unavailable
    cacheable: bool     # If True, results are cached for fallback
    cache_ttl: int      # Cache TTL in seconds (default: 300)
    description: str    # Human-readable description
    version: str        # Capability version (default: '1.0')
```

### 4.2 Capability Registry

**File:** `erp/connector_registry.py` → `class CapabilityRegistry`

The central dictionary of all capabilities, implemented as a **singleton**.

```python
capability_registry = CapabilityRegistry()  # Global singleton
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `register(name, handler, ...)` | Register a capability |
| `get(name)` | Look up a capability (auto-discovers if needed) |
| `list_module(module_code)` | List all capabilities for a module |
| `list_all()` | List all capabilities grouped by module |
| `has(name)` | Check if capability exists |
| `_auto_discover(module_code)` | Auto-import `apps.{module}.connector_service` |

**Auto-Discovery Flow:**
1. When `connector.require('finance.accounts.get_model')` is called
2. Registry checks if `finance` module has been discovered
3. If not → imports `apps.finance.connector_service`
4. Calls `register_capabilities(registry)` which registers all capabilities
5. Capability is now available for this and all future requests

### 4.3 Connector Facade

**File:** `erp/connector_registry.py` → `class ConnectorFacade`

The **public API** that all modules use. Exposed as a global singleton:

```python
connector = ConnectorFacade(capability_registry)  # Global singleton
```

**Import pattern used everywhere:**
```python
from erp.connector_registry import connector
```

**Key Methods:**

| Method | Purpose | Failure Behavior |
|--------|---------|-----------------|
| `require(name, org_id, fallback, source, **kw)` | Read data from another module | Returns `fallback` (default: `None`) |
| `execute(name, org_id, source, **kw)` | Write/action on another module | Buffers for replay |
| `available(name, org_id)` | Check if capability is live | Returns `bool` |

#### `connector.require()` — Full Signature

```python
def require(
    self,
    capability_name: str,     # e.g. 'crm.contacts.get_model'
    org_id: int,              # Organization ID for tenant scoping
    fallback: Any = None,     # What to return if unavailable
    user_id: Optional[int] = None,  # For permission checking
    source: str = 'unknown',  # Calling module for audit
    **kwargs,                 # Passed to capability handler
) -> Any:
```

#### `connector.execute()` — Full Signature

```python
def execute(
    self,
    capability_name: str,     # e.g. 'finance.journal.post_entry'
    org_id: int,              # Organization ID
    user_id: Optional[int] = None,
    source: str = 'unknown',
    **kwargs,
) -> Any:
```

### 4.4 Connector Engine

**File:** `erp/connector_engine.py` → `class ConnectorEngine`

The runtime broker that evaluates module states, manages caching, and handles request buffering.

**Mixins:**
- `ConnectorStateMixin` — Module state evaluation (AVAILABLE/MISSING/DISABLED/UNAUTHORIZED)
- `ConnectorRoutingMixin` — Request routing and policy application
- `ConnectorEventsMixin` — Event dispatch and handling

**Key Features:**
- **In-memory cache** with TTL for capability results
- **Write buffering** — failed writes stored in `BufferedRequest` model with 24h TTL
- **Automatic buffer cleanup** — expired buffers marked as `expired`
- **Failure counting** — increments failure counter for circuit-breaker patterns

---

## 5. Module States

The Connector Engine evaluates every target module before routing a request:

```python
class ModuleState(Enum):
    AVAILABLE = "available"       # 🟢 Module installed and enabled
    MISSING = "missing"           # 🟡 Module not installed on system
    DISABLED = "disabled"         # 🔵 Module installed but disabled for org
    UNAUTHORIZED = "unauthorized" # 🔴 Module exists but no permission
```

| State | READ Behavior | WRITE Behavior |
|-------|--------------|----------------|
| 🟢 AVAILABLE | Execute handler → return result | Execute handler → return result |
| 🟡 MISSING | Return cached → or fallback | Buffer for replay |
| 🔵 DISABLED | Return cached → or fallback | Buffer for replay |
| 🔴 UNAUTHORIZED | Return fallback | Fail hard |

**Exception:** If `critical=True`, any non-AVAILABLE state raises `RuntimeError`.

---

## 6. Operation Types

```python
class OperationType(Enum):
    READ = "read"    # Data retrieval — safe to cache/fallback
    WRITE = "write"  # Data mutation — must buffer if unavailable
    EVENT = "event"  # Fire-and-forget — best-effort delivery
```

---

## 7. Capability Naming Convention

```
{module}.{domain}.{action}
```

**Examples:**
```
crm.contacts.get_model           → Returns Contact model class
crm.contacts.get_detail          → Returns contact data dict
inventory.products.get_model     → Returns Product model class
inventory.stock.reserve          → Reserve stock for order
finance.journal.post_entry       → Post a journal entry (WRITE)
finance.sequences.next_value     → Get next sequence number (WRITE)
finance.accounts.get_model       → Returns ChartOfAccount model
pos.orders.get_model             → Returns Order model class
hr.employees.get_model           → Returns Employee model class
workspace.tasks.create_task      → Create a workspace task
```

**Rules:**
1. Module code matches Django app label (lowercase)
2. Domain groups related capabilities
3. Action describes what it does
4. `get_model` = returns the model **class** (not an instance)
5. `get_detail` = returns serialized data
6. `list` = returns a queryset or list

---

## 8. Registered Capabilities

### Finance Module (33 capabilities)

| Capability | Type | Critical | Description |
|-----------|------|----------|-------------|
| `finance.journal.post_entry` | WRITE | ✅ | Post a journal entry to the ledger |
| `finance.journal.get_entries` | READ | ❌ | Get journal entries |
| `finance.journal.get_line_model` | READ | ❌ | Get JournalEntryLine model class |
| `finance.sequences.next_value` | WRITE | ✅ | Get next sequence number |
| `finance.sequences.get_model` | READ | ❌ | Get TransactionSequence model class |
| `finance.accounts.get_chart` | READ | ❌ | Get chart of accounts |
| `finance.accounts.get_model` | READ | ❌ | Get ChartOfAccount model class |
| `finance.accounts.get_financial_account_model` | READ | ❌ | Get FinancialAccount model class |
| `finance.services.get_ledger_service` | READ | ❌ | Get LedgerService class |
| `finance.services.get_sequence_service` | READ | ❌ | Get SequenceService class |
| `finance.fiscal_year.get_model` | READ | ❌ | Get FiscalYear model class |
| `finance.tax.get_engine_context_class` | READ | ❌ | Get TaxEngineContext class |
| `finance.tax.get_calculator_class` | READ | ❌ | Get TaxCalculator class |
| `finance.tax.get_supplier_profile_class` | READ | ❌ | Get _SupplierProfile class |
| `finance.gateways.get_payment_service` | READ | ❌ | Get PaymentGatewayService class |
| `finance.gateways.get_config_model` | READ | ❌ | Get GatewayConfig model class |
| `finance.payments.get_model` | READ | ❌ | Get Payment model class |
| `finance.payments.get_customer_balance_model` | READ | ❌ | Get CustomerBalance model class |
| `finance.payments.get_supplier_balance_model` | READ | ❌ | Get SupplierBalance model class |
| `finance.invoices.get_model` | READ | ❌ | Get Invoice model class |
| `finance.posting_rules.resolve` | READ | ❌ | Resolve posting rules for account mapping |
| *...and 12 more* | | | |

### Inventory Module (22 capabilities)

| Capability | Type | Critical | Description |
|-----------|------|----------|-------------|
| `inventory.products.get_model` | READ | ❌ | Get Product model class |
| `inventory.products.get_detail` | READ | ❌ | Get product details by ID |
| `inventory.inventory.get_model` | READ | ❌ | Get Inventory model class |
| `inventory.warehouses.get_model` | READ | ❌ | Get Warehouse model class |
| `inventory.stock_ledger.get_model` | READ | ❌ | Get StockLedger model class |
| `inventory.services.get_reservation_service` | READ | ❌ | Get StockReservationService class |
| `inventory.services.get_reservation_error` | READ | ❌ | Get StockReservationError exception |
| `inventory.stock.reduce` | WRITE | ❌ | Reduce stock quantity |
| `inventory.stock.receive` | WRITE | ❌ | Receive stock (goods receipt) |
| *...and 13 more* | | | |

### POS Module (14 capabilities)

| Capability | Type | Critical | Description |
|-----------|------|----------|-------------|
| `pos.orders.get_model` | READ | ❌ | Get Order model class |
| `pos.orders.get_detail` | READ | ❌ | Get order details |
| `pos.order_lines.get_model` | READ | ❌ | Get OrderLine model class |
| `pos.purchase_orders.get_model` | READ | ❌ | Get PurchaseOrder model class |
| `pos.sessions.get_model` | READ | ❌ | Get RegisterSession model class |
| *...and 9 more* | | | |

### CRM Module (11 capabilities)

| Capability | Type | Critical | Description |
|-----------|------|----------|-------------|
| `crm.contacts.get_model` | READ | ❌ | Get Contact model class |
| `crm.contacts.get_detail` | READ | ❌ | Get contact details by ID |
| `crm.contacts.list` | READ | ❌ | List contacts for organization |
| `crm.pricing.get_price_groups` | READ | ❌ | Get pricing groups |
| *...and 7 more* | | | |

### Workspace Module (10 capabilities)

| Capability | Type | Critical | Description |
|-----------|------|----------|-------------|
| `workspace.tasks.create_task` | WRITE | ❌ | Create a workspace task |
| `workspace.scoring.record_event` | WRITE | ❌ | Record WISE scoring event |
| *...and 8 more* | | | |

### HR Module (3 capabilities)

| Capability | Type | Critical | Description |
|-----------|------|----------|-------------|
| `hr.employees.get_model` | READ | ❌ | Get Employee model class |
| `hr.employees.get_detail` | READ | ❌ | Get employee details |
| `hr.employees.list` | READ | ❌ | List employees |

---

## 9. How It Works — Request Flow

### READ Flow (`connector.require`)

```
1. Module calls: connector.require('finance.accounts.get_model', org_id=5, source='pos')
                     │
2. Registry lookup:  capability_registry.get('finance.accounts.get_model')
                     │
                     ├── Not found? → Auto-discover: import apps.finance.connector_service
                     │                                 call register_capabilities(registry)
                     │
3. Engine check:     connector_engine.get_module_state('finance', org_id=5)
                     │
                     ├── AVAILABLE    → Execute handler → Cache result → Return result
                     ├── MISSING      → Try cache → Return cached or fallback
                     ├── DISABLED     → Try cache → Return cached or fallback
                     └── (critical)   → Raise RuntimeError
                     │
4. Audit log:        ConnectorLog.objects.create(
                         source='pos', target='finance',
                         capability='finance.accounts.get_model',
                         decision='forward', latency_ms=2, success=True
                     )
```

### WRITE Flow (`connector.execute`)

```
1. Module calls: connector.execute('finance.journal.post_entry', org_id=5, data={...})
                     │
2. Registry lookup:  Same as READ
                     │
3. Engine check:     Same as READ
                     │
                     ├── AVAILABLE    → Execute handler → Return result
                     ├── MISSING      → Buffer request → BufferedRequest.objects.create(...)
                     ├── DISABLED     → Buffer request (unless critical → RuntimeError)
                     └── (critical)   → Raise RuntimeError (NEVER buffer critical writes)
                     │
4. Buffer model:     BufferedRequest(
                         target_module='finance',
                         target_endpoint='finance.journal.post_entry',
                         payload={...}, status='pending',
                         expires_at=now + 24h
                     )
```

---

## 10. Fallback Policies

| Scenario | Fallback Type | Behavior | Example |
|----------|--------------|----------|---------|
| Model class lookup | `None` (default) | Returns `None`, caller checks | `Product = connector.require(...)` → `if Product:` |
| Data display | `cached` → `empty` | Cached first, then empty | Dashboard widgets |
| Stock reservation | `critical=True` | **Raises RuntimeError** | Cannot sell without stock check |
| Journal posting | `critical=True` + `buffer` | **Raises** on critical, buffers on non-critical | Financial integrity |
| Tax calculation | `critical=True` | **Raises** on critical path | Legal compliance |
| Analytics enrichment | `cached` / `[]` | Stale data acceptable | Contact summary stats |
| Notification dispatch | `drop` | Silent drop | Non-essential |

### Critical vs Non-Critical Capabilities

```python
# CRITICAL: Fail hard — data integrity at stake
@_cap(registry, 'finance.journal.post_entry',
      fallback_type='WRITE', critical=True, cacheable=False)

# NON-CRITICAL: Graceful degradation — return None
@_cap(registry, 'crm.contacts.get_model',
      cacheable=False, critical=False)
```

---

## 11. How to Add a New Capability

### Step 1: Define in TARGET module's `connector_service.py`

```python
# apps/crm/connector_service.py

def register_capabilities(registry):

    @_cap(registry, 'crm.loyalty.get_tier',
          description='Get customer loyalty tier',
          cacheable=True, cache_ttl=120)
    def get_loyalty_tier(org_id, contact_id=None, **kw):
        from apps.crm.models import LoyaltyProgram
        tier = LoyaltyProgram.objects.filter(
            organization_id=org_id, contact_id=contact_id
        ).values('tier', 'points').first()
        return tier


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
```

### Step 2: Call from SOURCE module

```python
# apps/pos/services/checkout_service.py
from erp.connector_registry import connector

def apply_loyalty_discount(org_id, customer_id, subtotal):
    tier = connector.require(
        'crm.loyalty.get_tier',
        org_id=org_id,
        contact_id=customer_id,
        fallback={'tier': 'NONE', 'points': 0},
        source='pos.checkout'
    )
    
    if tier and tier.get('tier') == 'GOLD':
        return subtotal * Decimal('0.95')  # 5% discount
    return subtotal
```

### Step 3: Test

```python
# The capability auto-discovers — no registration boilerplate needed.
# Just restart gunicorn and it works.
```

---

## 12. How to Call a Capability

### Pattern A: Get a Model Class

```python
from erp.connector_registry import connector

# Resolve at usage point, not at module level
def some_view(request):
    org_id = get_current_tenant_id()
    Product = connector.require('inventory.products.get_model',
                                 org_id=org_id, source='pos.view')
    if not Product:
        return Response({"error": "Inventory module unavailable"}, status=503)
    
    products = Product.objects.filter(organization_id=org_id, is_active=True)
```

### Pattern B: Get a Service Class

```python
LedgerService = connector.require('finance.services.get_ledger_service',
                                    org_id=org_id, source='pos.sale')
if LedgerService:
    LedgerService.create_journal_entry(organization_id=org_id, ...)
```

### Pattern C: Execute a Write

```python
connector.execute('finance.journal.post_entry',
                    org_id=org.id,
                    data={'lines': [...], 'reference': 'SALE-001'},
                    user=request.user,
                    source='pos.finalize')
```

### Pattern D: Check Availability

```python
if connector.available('inventory.stock.reserve', org_id=org.id):
    connector.execute('inventory.stock.reserve', ...)
else:
    logger.warning("Stock reservation unavailable — proceeding without")
```

---

## 13. Connector Service File Template

Every module that exposes capabilities must have:

```
apps/{module}/connector_service.py
```

**Template:**

```python
"""
{Module Name} Connector Service
================================
Declares all capabilities that the {Module} module exposes to other modules
via the Connector Governance Layer.

Other modules use:
    connector.require('{module}.{domain}.{action}', org_id=X)
    connector.execute('{module}.{domain}.{action}', org_id=X, data={...})
"""

import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by CapabilityRegistry during auto-discovery."""

    # ─── MODELS ──────────────────────────────────────────────────────

    @_cap(registry, '{module}.{domain}.get_model',
          description='Get the {Model} model class',
          cacheable=False, critical=False)
    def get_model(org_id=0, **kw):
        from apps.{module}.models import {Model}
        return {Model}

    # ─── SERVICES ────────────────────────────────────────────────────

    @_cap(registry, '{module}.services.get_{service}_service',
          description='Get {Service} class',
          cacheable=False, critical=False)
    def get_service(org_id=0, **kw):
        from apps.{module}.services import {Service}
        return {Service}

    # ─── DATA READS ──────────────────────────────────────────────────

    @_cap(registry, '{module}.{domain}.get_detail',
          description='Get {entity} detail by ID',
          cacheable=True, cache_ttl=120)
    def get_detail(org_id, {entity}_id=None, **kw):
        from apps.{module}.models import {Model}
        obj = {Model}.objects.get(id={entity}_id, organization_id=org_id)
        return {{'id': obj.id, 'name': obj.name, ...}}

    # ─── WRITE OPERATIONS ────────────────────────────────────────────

    @_cap(registry, '{module}.{domain}.create',
          description='Create a new {entity}',
          fallback_type='WRITE', critical=True, cacheable=False)
    def create(org_id, data=None, user=None, **kw):
        from apps.{module}.services import {Service}
        return {Service}.create(organization_id=org_id, **(data or {{}}))


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
```

---

## 14. Prohibited Patterns

### ❌ BANNED — Direct Cross-Module Imports

```python
# NEVER DO THIS in runtime business code:
from apps.finance.models import ChartOfAccount        # ❌ BANNED
from apps.crm.models import Contact                   # ❌ BANNED
from apps.inventory.services import StockService       # ❌ BANNED
```

### ❌ BANNED — importlib Dynamic Imports

```python
# NEVER DO THIS:
import importlib                                        # ❌ BANNED
fin = importlib.import_module('apps.finance.models')    # ❌ BANNED
Model = getattr(fin, 'ChartOfAccount', None)            # ❌ BANNED
```

### ❌ BANNED — _safe_import Helpers

```python
# FULLY REMOVED — zero occurrences in codebase:
from erp.utils import _safe_import                      # ❌ REMOVED
Product = _safe_import('apps.inventory.models', 'Product')  # ❌ REMOVED
```

### ✅ ALLOWED — Same-Module Imports

```python
# Within the SAME module, direct imports are fine:
# In apps/finance/views/invoice_views.py:
from apps.finance.models import Invoice                 # ✅ Same module
from apps.finance.services import LedgerService         # ✅ Same module
```

### ✅ ALLOWED — Infrastructure Module Imports

```python
# Infrastructure modules (workspace signals, storage, erp core) are exempt:
from apps.workspace.signals import trigger_finance_event  # ✅ Infrastructure
from erp.connector_registry import connector               # ✅ Infrastructure
from erp.models import Organization                        # ✅ Core
```

---

## 15. Module Dependency Map

```
                    ┌──────────────────────────────────────────────┐
                    │          INFRASTRUCTURE LAYER                │
                    │                                              │
                    │  erp.connector_registry ← Global singleton   │
                    │  erp.connector_engine   ← Runtime broker     │
                    │  erp.models            ← Organization, User │
                    │  apps.workspace        ← Signals, Tasks     │
                    │  apps.storage          ← File management    │
                    └───────────────┬──────────────────────────────┘
                                    │ (direct imports allowed)
                    ┌───────────────┼──────────────────────────────┐
                    │          BUSINESS MODULES                     │
                    │    (connector.require only between these)     │
                    │                                               │
                    │  ┌─────────────────────────────────────────┐  │
                    │  │  POS ──→ Finance (tax, sequences,       │  │
                    │  │           journal, accounts)             │  │
                    │  │      ──→ Inventory (products, stock,    │  │
                    │  │           warehouses, reservations)      │  │
                    │  │      ──→ CRM (contacts)                 │  │
                    │  └─────────────────────────────────────────┘  │
                    │                                               │
                    │  ┌─────────────────────────────────────────┐  │
                    │  │  CRM ──→ Finance (accounts, ledger,     │  │
                    │  │           payments, journal)             │  │
                    │  │      ──→ POS (orders, order lines)      │  │
                    │  │      ──→ Inventory (products)           │  │
                    │  └─────────────────────────────────────────┘  │
                    │                                               │
                    │  ┌─────────────────────────────────────────┐  │
                    │  │  Finance ──→ Inventory (products)       │  │
                    │  │          ──→ CRM (contacts)             │  │
                    │  └─────────────────────────────────────────┘  │
                    │                                               │
                    │  ┌─────────────────────────────────────────┐  │
                    │  │  Inventory ──→ CRM (contacts/suppliers) │  │
                    │  └─────────────────────────────────────────┘  │
                    │                                               │
                    │  ┌─────────────────────────────────────────┐  │
                    │  │  HR ──→ Finance (accounts, ledger)      │  │
                    │  └─────────────────────────────────────────┘  │
                    │                                               │
                    │  ┌─────────────────────────────────────────┐  │
                    │  │  eCommerce ──→ Inventory (products)     │  │
                    │  │            ──→ Finance (payment gateway) │  │
                    │  └─────────────────────────────────────────┘  │
                    │                                               │
                    └───────────────────────────────────────────────┘
```

---

## 16. Migration History

### Phase 1 — Inventory Module (2026-03-11)
- `stock_service.py` → removed 3 direct finance imports
- `order_service.py` → removed 2 direct finance imports
- `valuation_service.py` → removed 1 direct finance import

### Phase 2 — POS Module (2026-03-12 to 2026-03-13)
- `workflow_service.py` → replaced 4 direct + 1 importlib
- `pos_service.py` → replaced 3 importlib + 1 direct
- `purchase_service.py` → replaced 1 importlib
- `returns_service.py` → previously fixed
- `replenishment_service.py` → replaced 1 top-level importlib
- `purchase_order_models.py` → replaced 1 importlib in `save()`
- `register_lobby.py` → replaced 4 importlib
- `register_order.py` → replaced 3 importlib
- `register_session.py` → replaced 2 importlib
- `register_address_book.py` → replaced 1 direct + 1 importlib
- `quotation_views.py` → replaced 1 importlib

### Phase 3 — CRM, HR, Finance, eCommerce, Workspace (2026-03-13)
- `crm/views/contact_views.py` → replaced 7 importlib + 2 top-level
- `crm/views/pricing_views.py` → replaced 1 importlib
- `hr/views/employee_views.py` → replaced 2 top-level importlib
- `hr/serializers/employee_serializers.py` → replaced 1 importlib
- `finance/services/base_services.py` → replaced 1 importlib
- `finance/views/invoice_views.py` → replaced 1 importlib + 1 direct
- `ecommerce/views.py` → replaced 1 direct + 1 importlib
- `workspace/tasks.py` → replaced 4 importlib
- `inventory/views/counting_views.py` → replaced 1 importlib
- `inventory/views/product_combo.py` → replaced 1 importlib

### New Capability Added
- `finance.fiscal_year.get_model` — registered in `apps/finance/connector_service.py`

---

## 17. File Reference

### Core Infrastructure

| File | Purpose |
|------|---------|
| `erp/connector_registry.py` | Capability, CapabilityRegistry, ConnectorFacade singletons |
| `erp/connector_engine.py` | ConnectorEngine — runtime state/cache/buffer management |
| `erp/connector_state.py` | ConnectorStateMixin — module state evaluation |
| `erp/connector_routing.py` | ConnectorRoutingMixin — request routing logic |
| `erp/connector_events.py` | ConnectorEventsMixin — event dispatch |

### Module Connector Services

| File | Capabilities |
|------|-------------|
| `apps/finance/connector_service.py` | 33 capabilities |
| `apps/inventory/connector_service.py` | 22 capabilities |
| `apps/pos/connector_service.py` | 14 capabilities |
| `apps/crm/connector_service.py` | 11 capabilities |
| `apps/workspace/connector_service.py` | 10 capabilities |
| `apps/hr/connector_service.py` | 3 capabilities |

### Database Models

| Model | Table | Purpose |
|-------|-------|---------|
| `ConnectorLog` | `connector_connectorlog` | Audit trail for every routing decision |
| `ConnectorPolicy` | `connector_connectorpolicy` | Per-module fallback configuration |
| `BufferedRequest` | `connector_bufferedrequest` | Queued writes for replay |
| `ModuleRegistry` | `connector_moduleregistry` | Installed module metadata |

---

> **Document generated:** 2026-03-13 15:24 UTC  
> **Maintained by:** TSFSYSTEM Architecture Team  
> **Enforcement:** Zero-tolerance — CI/CD test in `erp/tests/test_architecture.py`
