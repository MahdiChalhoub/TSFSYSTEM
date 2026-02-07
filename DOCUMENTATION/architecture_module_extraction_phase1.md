# Architecture Module Extraction – Full Documentation

## Goal
Migrate business logic from monolithic Kernel (`erp/`) into isolated module directories (`apps/`), and create a formal Engine layer for the frontend. Follows the **Engine → Kernel → Core → Modules** architecture.

---

## Backend Structure

### Kernel (`erp/`)
**Contains only infrastructure:**
| File | Purpose |
|------|---------|
| `models.py` | Organization, User, Role, Permission, Site, SystemModule, etc. + re-exports |
| `services.py` | ProvisioningService, ConfigurationService + re-exports |
| `serializers/core.py` | Kernel serializers + re-exports |
| `urls.py` | Auth, SaaS, Settings routes + `include()` for module URLs |
| `views.py` | All ViewSets (transitional, will move to modules later) |

### Modules (`apps/`)
| Module | Models | Serializers | Services | URLs |
|--------|:---:|:---:|:---:|:---:|
| `apps/finance/` | 12 | 12 | 7 | ✓ |
| `apps/inventory/` | 9 | 11 | 1 | ✓ |
| `apps/pos/` | 2 | 2 | 2 | ✓ |
| `apps/crm/` | 1 | 1 | — | ✓ |
| `apps/hr/` | 1 | 1 | — | ✓ |

### Key Principles
- All models use `db_table` → **zero database changes**
- Kernel files have backward-compatible re-exports → **zero code breakage**
- Dependency direction: Module → Kernel (correct)
- Cross-module FK references use Django string format: `'finance.ChartOfAccount'`

---

## Frontend Structure

### Engine Layer (`src/engine/`)
| File | Purpose |
|------|---------|
| `storage.ts` | Namespaced localStorage/sessionStorage wrapper |
| `events.ts` | Pub/Sub event bus for cross-module communication |
| `network.ts` | Re-exports erp-api.ts and erp-fetch.ts |
| `config.ts` | Re-exports saas_config.ts |
| `modules.ts` | Re-exports module-registry.tsx |
| `index.ts` | Unified entry: `import { Engine } from '@/engine'` |

### Module Frontend Entry Points (`src/modules/`)
| Module | Entry Point | Components |
|--------|-------------|------------|
| `finance` | `index.ts` | ChartOfAccountPicker, ContactPicker, FinanceAccountSelector, PostEventButton |
| `mcp` | `index.ts` | AICharts |
| `packages` | (existing) | Package management UI |

### Usage
```typescript
// Engine API
import { Engine } from '@/engine'
Engine.storage.get('key')
Engine.events.emit('order:created', data)

// Module imports  
import { ChartOfAccountPicker } from '@/modules/finance'
import { AICharts } from '@/modules/mcp'
```

---

## Verification Results
- `python manage.py check` ✅ (only pre-existing auth.W004)
- `python manage.py showmigrations` ✅ (correct chain)
- `npx next build` ✅ (exit code 0, all routes render)

## Commits
| Version | Description |
|---------|-------------|
| `v1.3.0-b001` | Models + serializers → 5 modules |
| `v1.3.0-b002` | Services → 3 modules |
| `v1.3.0-b003` | URL splitting + migration fix |
| `v1.3.0-b004` | Engine layer + module isolation |
