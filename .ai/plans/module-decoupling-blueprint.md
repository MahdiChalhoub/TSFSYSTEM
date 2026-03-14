# 🏗️ Module Decoupling Migration Blueprint
# TSFSYSTEM — Hybrid Architecture (ConnectorEngine + Event Bus)

**Version**: 1.0.0
**Date**: 2026-03-11
**Status**: ✅ APPROVED — Ready for phased execution
**Owner**: Architecture Team

---

## 📊 Current State (Audit Snapshot)

| Metric | Value |
|--------|-------|
| **Total cross-module direct imports** | **~300** |
| **ConnectorEngine / emit_event usage** | **~36** |
| **Violation rate** | **89%** |
| **ConnectorEngine infrastructure** | ✅ Exists, functional, underused |
| **Kernel Event Bus** | ✅ 19 contracts, 20 handlers, 6 modules wired |

### Top Violation Map (by coupling pair)

| # | Source → Target | Count | Risk | Phase |
|---|-----------------|-------|------|-------|
| 1 | `pos` → `finance` | **51** | 🔴 Critical | Phase 3A |
| 2 | `inventory` → `finance` | **18** | 🔴 Critical | Phase 3B |
| 3 | `pos` → `inventory` | **16** | 🟠 High | Phase 3C |
| 4 | `client_portal` → `inventory` | **10** | 🟠 High | Phase 3D |
| 5 | `finance` → `crm` | **8** | 🟡 Later | — |
| 6 | `pos` → `workspace` | **8** | 🟡 Later | — |
| 7 | `supplier_portal` → `pos` | **7** | 🟡 Later | — |
| 8 | `finance` → `pos` | **7** | 🟡 Later | — |

---

## 🎯 Architecture Decision

### Strategy: **(C) Hybrid**

| Layer | Mechanism | When to Use |
|-------|-----------|-------------|
| **Synchronous reads** | `ConnectorEngine.route_read()` | Caller needs data now to continue |
| **Command writes** | `ConnectorEngine.route_write()` | Caller needs immediate result |
| **After-effects** | `emit_event()` / `@subscribe_to_event` | Reactions, notifications, projections, audit |

### Decision Rules

```
IF caller needs an immediate response         → ConnectorEngine
IF validation depends on another module NOW    → ConnectorEngine
IF user action is synchronous                  → ConnectorEngine
IF action already succeeded in source module   → Event Bus
IF other modules react afterward               → Event Bus
IF notification/analytics/CRM touchpoint       → Event Bus
```

### ForeignKey Policy

```
DO NOT decouple ForeignKeys now.
REVIEW LATER if:
  - FK forces business logic across modules
  - save/delete cascades cause hidden side effects
  - circular dependencies appear in serializers/services/signals
```

---

## 📋 PHASE 1 — Freeze the Architecture (Immediate)

### Goal: Stop the bleeding. No new cross-module imports allowed.

### Deliverable 1.1: Forbidden Import Matrix

```
┌────────────────────┬──────────────────────────────────────────────────────┐
│ SOURCE MODULE      │ FORBIDDEN TARGETS (direct import)                   │
├────────────────────┼──────────────────────────────────────────────────────┤
│ pos                │ finance.*, inventory.* (except approved FK refs)     │
│ inventory          │ finance.*, pos.*                                     │
│ client_portal      │ inventory.*, finance.*, crm.*, pos.*                │
│ finance            │ pos.*, inventory.* (except approved FK refs)         │
│ supplier_portal    │ pos.*, inventory.*                                   │
│ crm                │ finance.*, inventory.*                               │
│ hr                 │ finance.*                                            │
│ ecommerce          │ client_portal.* (should use events)                 │
└────────────────────┴──────────────────────────────────────────────────────┘
```

**Allowed exceptions** (until Phase 3 migrates them):
- Same-module imports (`from apps.pos.models import X` inside `apps/pos/`)
- Kernel imports (`from kernel.*`)
- ConnectorEngine imports (`from erp.connector_engine import`)
- Event bus imports (`from kernel.events import`)

### Deliverable 1.2: CI Enforcement Script

**File**: `erp_backend/scripts/check_forbidden_imports.py`

```python
#!/usr/bin/env python3
"""
CI Gate: Detect forbidden cross-module imports.
Usage: python scripts/check_forbidden_imports.py [--strict]

Exit 0 = clean (or only legacy violations)
Exit 1 = new violations found (in --strict mode, any violation)
"""
import os
import re
import sys
import json
from pathlib import Path
from datetime import datetime

# ── Configuration ────────────────────────────────────────────────────────────
APPS_DIR = Path(__file__).parent.parent / 'apps'

# Modules whose internals are protected
PROTECTED_MODULES = {
    'finance', 'inventory', 'pos', 'crm', 'hr',
    'client_portal', 'supplier_portal', 'ecommerce',
    'workspace', 'storage',
}

# Allowed cross-module patterns (approved contracts, not yet migrated)
ALLOWLIST = [
    # Same-module imports
    (r'apps/(\w+)/', r'from apps\.\1\.'),
    # Tests may import anything
    (r'tests/', r'from apps\.'),
    # Migration files
    (r'migrations/', r'from apps\.'),
]

IMPORT_PATTERN = re.compile(
    r'^\s*from\s+apps\.(\w+)\.'
    r'|^\s*import\s+apps\.(\w+)\.',
    re.MULTILINE
)

# ── Baseline: known legacy violations (frozen count per pair) ────────────────
# Update this after each migration phase to ratchet down
BASELINE_PATH = Path(__file__).parent / 'forbidden_import_baseline.json'


def get_module_from_path(filepath: str) -> str:
    """Extract module name from file path."""
    parts = str(filepath).split('/apps/')
    if len(parts) < 2:
        return ''
    return parts[1].split('/')[0]


def is_allowlisted(filepath: str, import_line: str) -> bool:
    """Check if this import is in the allowlist."""
    for path_pattern, import_pattern in ALLOWLIST:
        if re.search(path_pattern, filepath) and re.search(import_pattern, import_line):
            return True
    return False


def scan_violations():
    """Scan all Python files for forbidden cross-module imports."""
    violations = {}  # {(source, target): [file:line, ...]}

    for py_file in APPS_DIR.rglob('*.py'):
        if '__pycache__' in str(py_file):
            continue

        source_module = get_module_from_path(str(py_file))
        if not source_module or source_module not in PROTECTED_MODULES:
            continue

        try:
            content = py_file.read_text(encoding='utf-8')
        except Exception:
            continue

        for i, line in enumerate(content.split('\n'), 1):
            match = IMPORT_PATTERN.match(line)
            if not match:
                continue

            target_module = match.group(1) or match.group(2)
            if target_module == source_module:
                continue
            if target_module not in PROTECTED_MODULES:
                continue
            if is_allowlisted(str(py_file), line):
                continue

            key = (source_module, target_module)
            violations.setdefault(key, []).append(
                f"{py_file.relative_to(APPS_DIR.parent)}:{i}"
            )

    return violations


def load_baseline():
    """Load frozen baseline counts."""
    if BASELINE_PATH.exists():
        return json.loads(BASELINE_PATH.read_text())
    return {}


def save_baseline(violations):
    """Save current counts as new baseline."""
    baseline = {
        f"{src}->{tgt}": len(locs)
        for (src, tgt), locs in violations.items()
    }
    baseline['_updated'] = datetime.now().isoformat()
    BASELINE_PATH.write_text(json.dumps(baseline, indent=2))
    print(f"Baseline saved to {BASELINE_PATH}")


def main():
    strict = '--strict' in sys.argv
    save = '--save-baseline' in sys.argv

    violations = scan_violations()

    if save:
        save_baseline(violations)
        return

    baseline = load_baseline()

    print("=" * 70)
    print("🔍 FORBIDDEN CROSS-MODULE IMPORT SCAN")
    print("=" * 70)

    total = sum(len(v) for v in violations.values())
    new_violations = 0

    for (src, tgt), locations in sorted(violations.items()):
        key = f"{src}->{tgt}"
        baseline_count = baseline.get(key, 0)
        current_count = len(locations)
        delta = current_count - baseline_count

        if delta > 0:
            icon = "🔴 NEW"
            new_violations += delta
        elif delta < 0:
            icon = "🟢 REDUCED"
        else:
            icon = "🟡 LEGACY"

        print(f"\n{icon} {src} → {tgt}: {current_count} imports (baseline: {baseline_count}, delta: {delta:+d})")
        if delta > 0:
            # Show only the new ones (last N)
            for loc in locations[-delta:]:
                print(f"    ❌ {loc}")

    print(f"\n{'=' * 70}")
    print(f"Total violations: {total}")
    print(f"New violations:   {new_violations}")
    print(f"{'=' * 70}")

    if strict and total > 0:
        print("❌ STRICT MODE: All violations are failures")
        sys.exit(1)
    elif new_violations > 0:
        print("❌ FAIL: New cross-module imports detected!")
        sys.exit(1)
    else:
        print("✅ PASS: No new violations (legacy violations frozen)")
        sys.exit(0)


if __name__ == '__main__':
    main()
```

### Deliverable 1.3: Save Current Baseline

```bash
# Run once to freeze current violation counts
python scripts/check_forbidden_imports.py --save-baseline

# Then add to CI pipeline:
python scripts/check_forbidden_imports.py  # Fails only on NEW violations
```

---

## 📋 PHASE 2 — Formalize Public Contracts

### Goal: Define what each module exposes to others through the ConnectorEngine.

Each contract is a **business-intent boundary**, not a low-level API mirror.

### Deliverable 2.1: Finance Public Contract

**File**: `erp_backend/apps/finance/public_contract.py`

```python
"""
Finance Module — Public Contract
==================================
These are the ONLY operations other modules may request from Finance.
All access goes through ConnectorEngine.route_read() / route_write().

Other modules MUST NOT import finance models, services, or internals directly.
"""

FINANCE_CONTRACT = {
    # ── READS ────────────────────────────────────────────────────────────
    'reads': {
        'get_account_by_code': {
            'description': 'Resolve a ChartOfAccount ID by account code for an org',
            'input': {'organization_id': 'int', 'code': 'str'},
            'output': {'account_id': 'int|None', 'account_name': 'str|None'},
            'idempotent': True,
        },
        'get_customer_balance': {
            'description': 'Get outstanding A/R balance for a contact',
            'input': {'organization_id': 'int', 'contact_id': 'int'},
            'output': {'balance': 'Decimal', 'currency': 'str'},
            'idempotent': True,
        },
        'get_payment_method_account': {
            'description': 'Resolve COA account for a payment method code',
            'input': {'organization_id': 'int', 'payment_method': 'str'},
            'output': {'account_id': 'int|None'},
            'idempotent': True,
        },
        'preview_tax_breakdown': {
            'description': 'Calculate tax for a set of lines without posting',
            'input': {
                'organization_id': 'int',
                'lines': [{'amount_ht': 'Decimal', 'tax_rate': 'Decimal'}],
                'scope': 'str',
            },
            'output': {
                'total_ht': 'Decimal',
                'total_tax': 'Decimal',
                'total_ttc': 'Decimal',
                'lines': [{'tax_amount': 'Decimal'}],
            },
            'idempotent': True,
        },
        'get_fiscal_year': {
            'description': 'Get active fiscal year for an org',
            'input': {'organization_id': 'int'},
            'output': {'fiscal_year_id': 'int|None', 'start_date': 'date', 'end_date': 'date'},
            'idempotent': True,
        },
        'generate_sequence': {
            'description': 'Get next sequence number for a document type',
            'input': {'organization_id': 'int', 'sequence_type': 'str'},
            'output': {'sequence_number': 'str'},
            'idempotent': False,  # Consumes a sequence
        },
    },

    # ── WRITES (command-style, immediate result) ─────────────────────────
    'writes': {
        'post_sale_transaction': {
            'description': 'Post a complete sale journal entry (Dr A/R, Cr Revenue, Cr VAT)',
            'input': {
                'organization_id': 'int',
                'order_id': 'int',
                'total_ttc': 'Decimal',
                'subtotal_ht': 'Decimal',
                'tax_amount': 'Decimal',
                'airsi_amount': 'Decimal',
                'invoice_number': 'str',
                'contact_id': 'int|None',
                'scope': 'str',
                'site_id': 'int|None',
                'confirmed_at': 'datetime|None',
                'user_id': 'int|None',
            },
            'output': {'success': 'bool', 'journal_ref': 'str|None', 'error': 'str|None'},
            'idempotent': False,
            'transaction_owner': 'finance',
        },
        'post_cogs_entry': {
            'description': 'Post COGS journal entry (Dr COGS, Cr Inventory)',
            'input': {
                'organization_id': 'int',
                'order_id': 'int',
                'cogs_total': 'Decimal',
                'invoice_number': 'str',
                'scope': 'str',
                'site_id': 'int|None',
                'delivered_at': 'datetime|None',
                'user_id': 'int|None',
            },
            'output': {'success': 'bool', 'journal_ref': 'str|None'},
            'idempotent': False,
            'transaction_owner': 'finance',
        },
        'post_payment_receipt': {
            'description': 'Post payment journal entry (Dr Cash/Bank, Cr A/R)',
            'input': {
                'organization_id': 'int',
                'order_id': 'int',
                'amount': 'Decimal',
                'payment_method': 'str',
                'invoice_number': 'str',
                'scope': 'str',
                'site_id': 'int|None',
                'user_id': 'int|None',
            },
            'output': {'success': 'bool', 'journal_ref': 'str|None'},
            'idempotent': False,
            'transaction_owner': 'finance',
        },
        'post_refund': {
            'description': 'Reverse a previously posted journal entry by reference',
            'input': {
                'organization_id': 'int',
                'journal_ref': 'str',
                'user_id': 'int|None',
            },
            'output': {'success': 'bool', 'reversal_ref': 'str|None'},
            'idempotent': True,  # Double-reversal is safe (no-op if already reversed)
            'transaction_owner': 'finance',
        },
        'post_stock_adjustment': {
            'description': 'Post journal entry for inventory adjustment',
            'input': {
                'organization_id': 'int',
                'adjustment_amount': 'Decimal',
                'reason': 'str',
                'reference': 'str',
                'scope': 'str',
                'user_id': 'int|None',
            },
            'output': {'success': 'bool', 'journal_ref': 'str|None'},
            'idempotent': False,
            'transaction_owner': 'finance',
        },
    },

    # ── EVENTS (emitted by finance, consumed by others) ──────────────────
    'events_produced': [
        'invoice.created',
        'invoice.paid',
        'invoice.voided',
        'payment.received',
    ],

    # ── EVENTS (consumed by finance from others) ─────────────────────────
    'events_consumed': [
        'order.completed',
        'subscription.created',
        'subscription.renewed',
        'subscription.cancelled',
    ],
}
```

### Deliverable 2.2: Inventory Public Contract

**File**: `erp_backend/apps/inventory/public_contract.py`

```python
"""
Inventory Module — Public Contract
====================================
All access from other modules goes through ConnectorEngine only.
"""

INVENTORY_CONTRACT = {
    'reads': {
        'get_stock_snapshot': {
            'description': 'Get current stock for a product at a warehouse',
            'input': {'organization_id': 'int', 'product_id': 'int', 'warehouse_id': 'int|None'},
            'output': {'quantity': 'Decimal', 'reserved': 'Decimal', 'available': 'Decimal'},
        },
        'get_available_qty': {
            'description': 'Get available (unreserved) quantity for a product',
            'input': {'organization_id': 'int', 'product_id': 'int', 'warehouse_id': 'int'},
            'output': {'available': 'Decimal'},
        },
        'get_product_cost': {
            'description': 'Get current weighted average cost for a product',
            'input': {'organization_id': 'int', 'product_id': 'int'},
            'output': {'unit_cost': 'Decimal', 'valuation_method': 'str'},
        },
        'get_batch_candidates': {
            'description': 'Get prioritized batch list for a product (FEFO/FIFO)',
            'input': {'organization_id': 'int', 'product_id': 'int', 'quantity': 'Decimal'},
            'output': {'batches': [{'batch_id': 'int', 'qty': 'Decimal', 'expiry': 'date|None'}]},
        },
        'get_warehouse_info': {
            'description': 'Get warehouse details by ID',
            'input': {'organization_id': 'int', 'warehouse_id': 'int'},
            'output': {'name': 'str', 'code': 'str', 'site_id': 'int'},
        },
    },
    'writes': {
        'reserve_stock': {
            'description': 'Reserve stock for an order (soft lock)',
            'input': {
                'organization_id': 'int',
                'product_id': 'int',
                'warehouse_id': 'int',
                'quantity': 'Decimal',
                'reference': 'str',
            },
            'output': {'success': 'bool', 'reservation_id': 'int|None', 'error': 'str|None'},
        },
        'consume_stock': {
            'description': 'Deduct stock on delivery (converts reservation to deduction)',
            'input': {
                'organization_id': 'int',
                'product_id': 'int',
                'warehouse_id': 'int',
                'quantity': 'Decimal',
                'reference': 'str',
                'scope': 'str',
            },
            'output': {'success': 'bool', 'effective_cost': 'Decimal'},
        },
        'release_reservation': {
            'description': 'Release a stock reservation (on order cancel)',
            'input': {'organization_id': 'int', 'reference': 'str'},
            'output': {'success': 'bool', 'released_qty': 'Decimal'},
        },
        'receive_stock': {
            'description': 'Receive stock from a purchase order',
            'input': {
                'organization_id': 'int',
                'product_id': 'int',
                'warehouse_id': 'int',
                'quantity': 'Decimal',
                'cost_price_ht': 'Decimal',
                'reference': 'str',
                'scope': 'str',
            },
            'output': {'success': 'bool', 'movement_id': 'int|None'},
        },
    },
    'events_produced': [
        'inventory.stock_changed',
        'inventory.low_stock',
        'inventory.adjusted',
    ],
    'events_consumed': [
        'order.completed',
        'order.voided',
        'purchase_order.received',
    ],
}
```

### Deliverable 2.3: CRM Public Contract

**File**: `erp_backend/apps/crm/public_contract.py`

```python
"""
CRM Module — Public Contract
===============================
"""

CRM_CONTRACT = {
    'reads': {
        'get_contact': {
            'description': 'Get contact details by ID',
            'input': {'organization_id': 'int', 'contact_id': 'int'},
            'output': {'id': 'int', 'name': 'str', 'type': 'str', 'email': 'str|None'},
        },
        'get_contact_by_user': {
            'description': 'Get contact linked to a user account',
            'input': {'organization_id': 'int', 'user_id': 'int'},
            'output': {'contact_id': 'int|None'},
        },
    },
    'writes': {},
    'events_produced': ['contact.created', 'contact.updated'],
    'events_consumed': ['user.created', 'invoice.created', 'invoice.paid'],
}
```

---

## 📋 PHASE 3 — Migrate by Business Flow

### ⚠️ Key Rule: Migrate by *use case*, not by *file*.

Each flow removes a coherent cluster of violations at once.

---

### PHASE 3A — POS Sale Posting (Priority 1)

**Target files**:
- `apps/pos/services/accounting_poster.py` (8 finance imports)
- `apps/pos/services/workflow_service.py` (5 finance imports)
- `apps/pos/views/register_order.py` (1 finance import)

**Current violation pattern**: POS directly imports `LedgerService`, `ChartOfAccount`, `JournalEntry`, `SequenceService`, `FinancialAccount` from finance.

**Additional finding**: `accounting_poster.py` contains **hardcoded COA code maps** (`_COA` and `_PM_TO_COA` on lines 30-51) — these should be resolved dynamically via connector reads.

#### Migration Design

**BEFORE** (current — violating):
```python
# apps/pos/services/accounting_poster.py
from apps.finance.services.ledger_service import LedgerService
from apps.finance.models import ChartOfAccount

_COA = {'AR': '411', 'REVENUE': '701', ...}  # HARDCODED

def post_confirmation(order):
    acc = ChartOfAccount.objects.filter(code='411', organization=org).first()
    LedgerService.create_journal_entry(organization=org, lines=[...])
```

**AFTER** (migrated — clean):
```python
# apps/pos/services/accounting_poster.py
from erp.connector_engine import connector_engine

def post_confirmation(order):
    # Resolve accounts through connector (finance owns COA)
    ar_resp = connector_engine.route_read(
        target_module='finance',
        endpoint='get_account_by_code',
        organization_id=org.id,
        params={'code': '411'}
    )

    # Post the journal through connector (finance owns posting)
    result = connector_engine.route_write(
        target_module='finance',
        endpoint='post_sale_transaction',
        data={
            'organization_id': org.id,
            'order_id': order.id,
            'total_ttc': str(order.total_amount),
            'subtotal_ht': str(subtotal_ht),
            'tax_amount': str(order.tax_amount),
            'invoice_number': order.invoice_number,
            'scope': order.scope,
            'site_id': order.site_id,
        },
        organization_id=org.id,
    )

    # After-effects via event bus
    if result.success:
        emit_event('pos.sale_posted', {
            'order_id': order.id,
            'journal_ref': result.data.get('journal_ref'),
            'tenant_id': org.id,
        })
```

#### Finance-side Implementation

**File**: `apps/finance/services/connector_handlers.py` (NEW)

```python
"""
Finance Connector Handlers
============================
Implements the finance public contract.
Called by ConnectorEngine when other modules route to 'finance'.
"""
from decimal import Decimal
from django.utils import timezone

class FinanceConnectorService:
    """Public API for cross-module access to finance."""

    @staticmethod
    def get_account_by_code(organization, code, **kwargs):
        from apps.finance.models import ChartOfAccount
        acc = ChartOfAccount.objects.filter(
            organization=organization, code=code, is_active=True
        ).first()
        if acc:
            return {'account_id': acc.id, 'account_name': acc.name}
        return {'account_id': None, 'account_name': None}

    @staticmethod
    def post_sale_transaction(organization, data):
        from apps.finance.services.ledger_service import LedgerService
        from apps.finance.services.base_services import SequenceService
        # ... (full implementation with all COA resolution INSIDE finance)
        # Finance owns the COA map, the posting rules, the journal creation
        # POS only sends business intent
        pass

    @staticmethod
    def post_cogs_entry(organization, data):
        # ...
        pass

    @staticmethod
    def post_payment_receipt(organization, data):
        # ...
        pass

    @staticmethod
    def post_refund(organization, data):
        # ...
        pass
```

**Key insight**: The `_COA` mapping and `_PM_TO_COA` mapping currently in `accounting_poster.py` **move into finance** where they belong. POS sends intent (`"post a sale"`), finance decides which accounts to use.

#### Flows in Phase 3A

| Flow | Current Files | Imports Removed | Connector Calls |
|------|---------------|-----------------|-----------------|
| Sale confirmation posting | `accounting_poster.py` | 3 | `route_write('finance', 'post_sale_transaction')` |
| COGS on delivery | `accounting_poster.py` | 1 | `route_write('finance', 'post_cogs_entry')` |
| Payment receipt | `accounting_poster.py` | 1 | `route_write('finance', 'post_payment_receipt')` |
| Return/reversal | `accounting_poster.py` | 2 | `route_write('finance', 'post_refund')` |
| Workflow COGS posting | `workflow_service.py` | 3 | `route_write('finance', 'post_cogs_entry')` |
| Workflow A/R adjustment | `workflow_service.py` | 2 | `route_write('finance', 'post_payment_receipt')` |
| Order sequence generation | `register_order.py` | 1 | `route_read('finance', 'generate_sequence')` |

**Estimated imports removed**: ~13 (from the core posting flows)

---

### PHASE 3B — Inventory → Finance (Priority 2)

**Target files**:
- `apps/inventory/services/stock_service.py` (5 finance imports: LedgerService, ForensicAuditService)
- `apps/inventory/services/valuation_service.py` (2 finance imports: LedgerService, ChartOfAccount)
- `apps/inventory/services/order_service.py` (3 finance imports)
- `apps/inventory/services/warehouse_transfer_service.py` (1 finance import: SequenceService)
- `apps/inventory/views/views_orders.py` (4 finance imports: TransactionSequence)
- `apps/inventory/views/warehouse_views.py` (1 finance import)
- `apps/inventory/views/product_bulk.py` (1 finance import: BarcodeService)

**Pattern**: Inventory directly calls `LedgerService.create_journal_entry()` for stock adjustments, `ForensicAuditService` for audit, and `TransactionSequence` for numbering.

#### Migration Design

| Current Import | Connector Replacement |
|----------------|----------------------|
| `LedgerService.create_journal_entry()` | `route_write('finance', 'post_stock_adjustment')` |
| `ForensicAuditService` | `emit_event('inventory.audit_action', {...})` → finance subscribes |
| `TransactionSequence` | `route_read('finance', 'generate_sequence')` |
| `ChartOfAccount.objects.filter()` | `route_read('finance', 'get_account_by_code')` |
| `BarcodeService` | Evaluate: may belong in `core` or `inventory`, not finance |

**Estimated imports removed**: ~17

---

### PHASE 3C — POS → Inventory (Priority 3)

**Target files**:
- `apps/pos/services/workflow_service.py` (5 inventory imports: Warehouse, StockReservationService)
- `apps/pos/services/purchase_service.py` (2 inventory imports: ProductBatch, InventoryMovement)
- `apps/pos/services/replenishment_service.py` (1 inventory import: Product, Inventory, StockLedger)
- `apps/pos/services/returns_service.py` (2 inventory imports: Warehouse)
- `apps/pos/views/register_order.py` (1 inventory import: Product, Inventory)
- `apps/pos/views/register_lobby.py` (2 inventory imports: Warehouse)
- `apps/pos/views/base.py` (1 inventory import: Warehouse, Product)

#### Migration Design

| Current Import | Connector Replacement |
|----------------|----------------------|
| `StockReservationService.reserve()` | `route_write('inventory', 'reserve_stock')` |
| `StockReservationService.release()` | `route_write('inventory', 'release_reservation')` |
| `Warehouse.objects.get()` | `route_read('inventory', 'get_warehouse_info')` |
| `Product.objects.filter()` | Consider: shared read model or connector |
| `InventoryMovement` | `emit_event('pos.delivery_completed')` → inventory subscribes |

**Note on Product**: `Product` is heavily referenced across modules. This may become a **shared read model** exposed via connector, rather than removing all FK references immediately.

**Estimated imports removed**: ~14

---

### PHASE 3D — Client Portal → Everything (Priority 4)

**Target files**: `apps/client_portal/services.py`, `warehouse_router.py`, `views_admin.py`, `views_storefront.py`, etc.

**Pattern**: Portal imports inventory models, finance services, CRM contacts directly.

**Migration**: All reads go through connector. Portal becomes a thin façade.

**Estimated imports removed**: ~25

---

## 📋 PHASE 4 — Enforcement & Monitoring

### Deliverable 4.1: Update CI Pipeline

```yaml
# .github/workflows/architecture.yml
- name: Check forbidden imports
  run: python erp_backend/scripts/check_forbidden_imports.py
```

### Deliverable 4.2: Ratchet Mechanism

After each migration phase:
1. Re-run scanner with `--save-baseline`
2. New baseline has lower counts
3. Any increase triggers CI failure

### Deliverable 4.3: Monitoring Dashboard

Track via ConnectorLog model (already exists):
- Connector call volume per module pair
- Fallback rates (should be near zero)
- Response times
- Event delivery success rates

---

## 📊 Migration Tracker

| Phase | Deliverable | Status | Imports Before | Imports After | Delta |
|-------|------------|--------|----------------|---------------|-------|
| 1 | Forbidden import matrix | ✅ Done | — | — | — |
| 1 | CI enforcement script | ✅ Done | — | — | — |
| 1 | Save baseline | ✅ Done (168) | 168 | 168 | 0 |
| 2 | Finance contract | ✅ Done | — | — | — |
| 2 | Inventory contract | ✅ Done | — | — | — |
| 2 | CRM contract | ✅ Done | — | — | — |
| 3A | POS sale posting flow (wave 1) | ✅ Done | 51 | **37** | **-14** |
| 3A | POS address book (wave 2) | ✅ Done | 37 | **14** | **-23** |
| 3B | Inventory → finance | ✅ Done | 18 | **0** | **-18** |
| 3C | POS → inventory | ⏳ Next | 15 | — | — |
| 3D | Client portal cleanup | ⏳ | ~25 | — | — |
| 4 | CI ratchet | ✅ Ratcheted | 168 → 112 | — | — |

**Current**: 112 violations (was 168) | **Target**: < 50

---

## 🔑 Design Rules (Non-Negotiable)

### Rule 1: Contracts Express Business Intent
```
❌ Bad:  route_write("finance", "create_journal_entry_directly", raw_lines)
✅ Good: route_write("finance", "post_sale_transaction", sale_payload)
```

### Rule 2: Finance Owns Accounting Logic
```
❌ Bad:  POS resolves COA codes, builds journal lines, calls LedgerService
✅ Good: POS sends sale data, Finance decides accounts and creates entries
```

### Rule 3: Events for After-Effects Only
```
❌ Bad:  emit_event("create_invoice") and hope finance handles it
✅ Good: route_write("finance", "post_sale") → then emit_event("sale.posted")
```

### Rule 4: No Connector-Disguised Direct Imports
```
❌ Bad:  route_write("finance", "call_ledger_service_create_journal_entry")
✅ Good: route_write("finance", "post_sale_transaction")
```

---

## ✅ Approval Record

- [x] Strategy approved: Hybrid (C) — ConnectorEngine + Event Bus
- [x] Priority order approved: pos→finance, inv→finance, pos→inv, portal→inv
- [x] ForeignKey policy: defer until service-level is clean
- [x] Phase 1 (freeze) can proceed immediately
- [x] Phase 2 (contracts) can proceed immediately
- [x] Phase 3 requires per-flow approval before implementation

**Next Action**: Implement Phase 1 (CI enforcement script + baseline)

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-11
**Author**: Architecture Team
**Review Required Before**: Phase 3 implementation
