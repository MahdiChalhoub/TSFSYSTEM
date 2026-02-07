# Kernel Architecture

## Overview

The platform follows a 4-tier architecture:

```
┌─────────────────────────────────────────────┐
│   Modules (Finance, Inventory, CRM, etc.)   │
│   Each has: manifest.json + pages + actions  │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│                   Kernel                     │
│   auth.ts │ tenant.ts │ modules.ts           │
│   manifest-loader.ts │ types.ts              │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│                   Engine                     │
│   storage │ events │ network │ config        │
└─────────────────────────────────────────────┘
```

## Kernel (`src/kernel/`)

The Kernel is the system's brain — main controller for auth, tenant resolution, and module lifecycle.

### Files

| File | Purpose |
|------|---------|
| `index.ts` | Unified `Kernel` export with `auth`, `tenant`, `modules` namespaces |
| `types.ts` | Shared types: `ModuleManifest`, `KernelUser`, `TenantContext` |
| `auth.ts` | `Kernel.auth.getUser()`, `isAuthenticated()`, `hasPermission()` |
| `tenant.ts` | `Kernel.tenant.getContext()`, `getSlug()`, `isSaaSContext()` |
| `modules.ts` | `Kernel.modules.getAll()`, `enable()`, `disable()`, `getStatus()` |
| `manifest-loader.ts` | Loads `manifest.json` from each module directory |

### Usage

```typescript
import { Kernel } from '@/kernel'

// Auth
const user = await Kernel.auth.getCurrentUser()
const isAuth = await Kernel.auth.isAuthenticated()

// Tenant
const ctx = await Kernel.tenant.getContext()
const isSaaS = await Kernel.tenant.isSaaSContext()

// Modules
const modules = await Kernel.modules.getAll()
await Kernel.modules.enable('finance')
const manifest = Kernel.modules.getManifest('finance')
```

## Module Manifests (`src/modules/*/manifest.json`)

Each module declares its identity, routes, permissions, and dependencies:

```json
{
    "code": "finance",
    "name": "Finance & Accounting",
    "version": "1.0.0",
    "category": "first-party",
    "isolation": "shared",
    "icon": "Landmark",
    "routes": ["/finance/*"],
    "permissions": ["read:journal", "write:journal"],
    "dependencies": [],
    "backendApp": "apps.finance"
}
```

### Key Fields

| Field | Values | Purpose |
|-------|--------|---------|
| `category` | `first-party` / `third-party` | Determines isolation rules |
| `isolation` | `shared` / `iframe` | `shared` = React tree, `iframe` = sandboxed |
| `dependencies` | Module codes | What must be enabled first |
| `backendApp` | Django app path | Maps to backend |

### Registered Modules

| Module | Dependencies | Backend App |
|--------|-------------|-------------|
| finance | — | `apps.finance` |
| inventory | — | `apps.inventory` |
| products | inventory | `apps.inventory` |
| crm | — | `apps.crm` |
| hr | — | `apps.hr` |
| purchases | inventory, finance | `apps.purchases` |
| sales | inventory, finance | `apps.sales` |

## Adding a New Module

1. Create `src/modules/<code>/manifest.json`
2. Add static import in `src/kernel/manifest-loader.ts`
3. Create backend app in `erp_backend/apps/<code>/`
4. Register in Django `INSTALLED_APPS` and `SaaSModule` table
