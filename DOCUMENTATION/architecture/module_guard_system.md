# Module Guard and Connector System

## Overview
The Module Guard system provides graceful degradation when modules are not installed.

## Components

### 1. ModuleGuard Component
**Path:** `src/components/ModuleGuard.tsx`

Wraps pages and shows "feature suspended" when module not installed:
```tsx
<ModuleGuard moduleCode="inventory" moduleName="Inventory">
    <InventoryContent />
</ModuleGuard>
```

### 2. Module Connectors
**Path:** `src/lib/connectors/index.ts`

Handles inter-module communication with graceful fallback:
```tsx
import { ModuleConnectors } from '@/lib/connectors'

// Returns null if inventory module disabled
const cost = await ModuleConnectors.inventory.getProductCost()
```

### 3. Stub Action Files
**Path:** `src/app/actions/[module]/`

Placeholder functions for build-time compatibility:
- `inventory/` - Inventory module stubs
- `crm/` - CRM module stubs (contacts.ts)
- `finance/` - Finance module actions

## Module Dependencies

| Module | Depends On |
|--------|------------|
| Inventory | - (core) |
| Finance | - (core) |
| CRM | - (core) |
| POS | Inventory |
| Delivery | CRM, Inventory |
| Production | Inventory |
| Ecommerce | POS, Inventory |
| Audit | Finance |
| Importation | Inventory |
| Report | Finance, Inventory |

## Adding New Modules

1. Create stub actions in `src/app/actions/[module]/`
2. Add connector methods to `ModuleConnectors` registry
3. Wrap pages with `<ModuleGuard>`
4. Update Sidebar visibility logic
