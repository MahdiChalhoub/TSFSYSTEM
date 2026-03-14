# TSFSYSTEM Architecture: Engine vs. Kernel

This document explains the two primary operating modes of the TSFSYSTEM platform.

---

## 1. Kernel Mode (The Skeleton)

**Kernel Mode** represents the immutable core logic and static skeleton of the application.

### Purpose
To provide the "Machine" that hosts the modular ERP.

### Components

| Component | Location | Description |
|-----------|----------|-------------|
| **Physical Infrastructure** | `src/`, `erp_backend/` | Next.js build system, server config, root structure |
| **The Shell** | `src/components/` | `Sidebar.tsx`, `AdminLayout.tsx`, route orchestrators |
| **Core Utils** | `src/lib/` | API client (`erpFetch`), auth logic, database abstractions |
| **Core Platform Module** | `erp_backend/erp/modules/coreplatform/` | Menu, icon, theme configuration |
| **Multi-Tenancy** | `erp_backend/erp/` | `TenantModel`, `TenantManager`, middleware |
| **Audit & Workflow** | `erp_backend/erp/` | `AuditLog`, `WorkflowDefinition`, `TaskQueue` |

### Update Mechanism
```
┌─────────────────────────────────────────────────────────────┐
│                   KERNEL UPDATE FLOW                         │
├─────────────────────────────────────────────────────────────┤
│  1. Upload .kernel.zip via /api/saas/updates/stage/         │
│  2. KernelManager.stage_update() validates package          │
│  3. SystemUpdate record created (staged)                     │
│  4. Admin approves → /api/saas/updates/{id}/apply/          │
│  5. KernelManager.apply_update() extracts to BASE_DIR       │
│  6. SystemUpdate marked as applied                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Class: `KernelManager` (`erp/kernel_manager.py`)
- `get_current_version()` - Returns current kernel version
- `stage_update(file_obj)` - Validates and stages .kernel.zip
- `apply_update(update_id)` - Applies staged update

---

## 2. Engine Mode (The Slots & Guards)

**Engine Mode** is the dynamic, modular layer enabling on-demand feature management.

### Purpose
To provide specific business functionality (SaaS Modules) that can be added or removed.

### Module Locations

| Location | Type | Description |
|----------|------|-------------|
| `erp_backend/apps/` | **Primary** | New Engine modules (finance, etc.) |
| `erp_backend/erp/modules/` | **Legacy** | Older modules (coreplatform) |

### Current Modules

| Module | Location | Type | Status |
|--------|----------|------|--------|
| `coreplatform` | `erp/modules/` | Kernel | Active |
| `core` | `apps/core/` | Kernel | Active |
| `finance` | `apps/finance/` | Engine | Active |

### Update Mechanism
```
┌─────────────────────────────────────────────────────────────┐
│                   MODULE UPGRADE FLOW                        │
├─────────────────────────────────────────────────────────────┤
│  1. Upload .modpkg.zip via /api/saas/modules/{code}/upload/ │
│  2. ModuleManager.upgrade() validates manifest.json         │
│  3. Dependencies checked against installed modules          │
│  4. Backup created: backups/{module}_{version}_{timestamp}/ │
│  5. Old module replaced with new version                     │
│  6. Migrations run if present                                │
│  7. SystemModuleLog entry created                            │
└─────────────────────────────────────────────────────────────┘
```

### Key Class: `ModuleManager` (`erp/module_manager.py`)

| Method | Purpose |
|--------|---------|
| `discover()` | Scans apps/ and erp/modules/ for manifest.json |
| `sync()` | Syncs filesystem modules with SystemModule registry |
| `upgrade(module_name, package_path)` | Safely upgrades from .modpkg.zip |
| `grant_access(module_name, org_id)` | Enables module for tenant |
| `revoke_all(module_name)` | Revokes module from all tenants |
| `delete(module_name)` | Removes module from registry and filesystem |
| `list_backups(module_name)` | Lists available backups |
| `rollback(module_name, target_version)` | Restores previous version |

---

## 3. Module Manifest Specification

Every Engine module MUST have a `manifest.json`:

```json
{
    "code": "module_code",
    "name": "Human Readable Name",
    "version": "1.0.0",
    "description": "Module description",
    "is_core": false,
    "author": "Author Name",
    "dependencies": [],
    "minimum_kernel_version": "8.0.0",
    
    "permissions": [
        { "code": "module.action", "label": "Permission Label" }
    ],
    
    "models": ["ModelName1", "ModelName2"],
    
    "routes": [
        { "path": "/module/page", "label": "Page Label" }
    ],
    
    "sidebar_items": [
        {
            "label": "Menu Item",
            "icon": "IconName",
            "path": "/module/page"
        }
    ],
    
    "settings_schema": {
        "setting_key": { "type": "string", "default": "value" }
    }
}
```

---

## 4. Platform Integrity Rules

### Rule 1: Uniqueness Before Creation 🔍
> Before implementing new functionality, verify it doesn't already exist.

### Rule 2: Universal Audit Logging 📜
> All mutations logged via `AuditService.log_event()` from `TenantModelViewSet`.

### Rule 3: Conditional Approval Workflow ✅
> Critical changes can require pre/post approval via `WorkflowService`.

### Rule 4: Granular Permission Registry 🔐
> Every module declares permissions in `manifest.json`, enforced via `HasPermission`.

---

## 5. Strict Architectural Constraints

| Constraint | Description |
|------------|-------------|
| ❌ No feature without classification | Must declare Kernel or Engine before coding |
| ❌ No Kernel logic in Engine | Auth, routing, config stay in Kernel |
| ❌ No silent global changes | All global changes documented and versioned |
| ❌ No versionless updates | Every change increments semantic version |

---

## 6. API Endpoints

### Kernel Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/saas/updates/` | GET | List all system updates |
| `/api/saas/updates/current/` | GET | Get current kernel version |
| `/api/saas/updates/stage/` | POST | Stage .kernel.zip package |
| `/api/saas/updates/{id}/apply/` | POST | Apply staged update |

### Module Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/saas/modules/` | GET | List all modules |
| `/api/saas/modules/sync/` | POST | Sync filesystem modules |
| `/api/saas/modules/{code}/install_all/` | POST | Enable for all tenants |
| `/api/saas/modules/{code}/revoke_all/` | POST | Disable for all tenants |
| `/api/saas/modules/{code}/upload/` | POST | Upload .modpkg.zip |
| `/api/saas/modules/{code}/backups/` | GET | List backups |
| `/api/saas/modules/{code}/rollback/` | POST | Rollback to version |
| `/api/saas/modules/{code}/` | DELETE | Delete module |

---

*Last Updated: 2026-02-04 | Version: 8.3.4*
