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
| `views.py` | TenantModelViewSet, Dashboard, Settings, kernel-only ViewSets + re-exports |

### Modules (`apps/`)
| Module | Models | Serializers | Services | ViewSets | URLs |
|--------|:---:|:---:|:---:|:---:|:---:|
| `apps/finance/` | 12 | 12 | 7 | 9 | ✓ |
| `apps/inventory/` | 9 | 11 | 1 | 8 | ✓ |
| `apps/pos/` | 2 | 2 | 2 | 2 | ✓ |
| `apps/crm/` | 1 | 1 | — | 1 | ✓ |
| `apps/hr/` | 1 | 1 | — | 1 | ✓ |

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
| `v1.3.0-b005` | Test imports → canonical paths |
| `v1.3.0-b006` | 21 ViewSets → 5 module views |
| `v1.3.0-b007` | Clean kernel views.py (2029→516 lines) |
| `v1.3.0-b008` | Delete 11 stale backup files |
| `v1.3.0-b009` | Delete debug + backups directory |
