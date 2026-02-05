# TSF Ultimate Enterprise Suite - Isolated Architecture (v2)

## Goal
To provide a Windows-like isolated structure where the core "Kernel/Engine" is protected from "Business Modules". This allows for independent updates via ZIP packages, isolated error handling (one module crashing doesn't kill the platform), and easy maintenance.

## 1. Kernel & Engine (The OS)
The Kernel is the brain of the software. It controls the environment but contains zero business logic.

- **Security Brain**: Managed by `permissions.py` and `middleware.py`.
- **Registry & Permission Brain**: Managed by `kernel_manager.py` and `module_manager.py`.
- **Model Connector Brain**: Managed by `connector_engine.py` (The nervous system).
- **API Center**: The unified entry point for all communication.

## 2. Modules (The Applications)
Modules are independent units (like Odoo apps) that can be installed, updated, or deleted without affecting the Kernel.

- **Independence**: All module files live in `src/modules/[module_code]` (Frontend) and `apps/[module_code]` (Backend).
- **Update Method**: Modules are ONLY updated via `.modpkg.zip` packages uploaded through the UI. **No Git pull on server.**
- **Communication**: Modules talk to each other *only* through the **Model Connector Brain**.

## 3. Data Flow & Isolation
- **Read/Write**: All inter-module requests are brokered by the `ConnectorEngine`.
- **UI Rendering**: Modules are loaded via a **Dynamic Loader** (`/saas/m/[code]`) wrapped in an **Error Boundary**.
- **Error Isolation**: If `inventory` module crashes, the `finance` module and the `Dashboard` remain perfectly functional.

## 4. Maintenance Workflow
1. **Develop**: Create module in isolated folder.
2. **Export**: Package as ZIP.
3. **Upload**: Use "Global Registry" UI to upload ZIP.
4. **Deploy**: Kernel extracts files to isolation zones and runs migrations.

## Hardening & Resilience (v2.1.0)

To achieve enterprise-grade reliability, the architecture implements the following safety patterns:

### 1. Atomic Updates (Swap & Rollback)
Both **Kernel** and **Modules** use an atomic-style directory swap during updates:
1.  **Stage**: Extract package to a temporary directory.
2.  **Verify**: Validate manifest, kernel compatibility, and file integrity.
3.  **Backup**: Move the current live version to the `backups/` directory.
4.  **Swap**: Move the staged version into the live system.
5.  **Migrate**: Run database migrations. If this fails, the system **automatically** wipes the new files and restores the backup.

### 2. Connector Circuit Breaker
The **ConnectorEngine** (Nervous System) monitors module reliability:
-   **Failure Threshold**: If a module crashes more than 5 times within a 10-minute window, the Circuit Breaker trips.
-   **Self-Healing**: The Connector automatically marks the module as `MISSING` to protect the core, applying the configured fallback (Empty/Cached/Mock) instead of crashing the system.

### 3. Strict Manifest Enforcement
Modules must declare:
-   `kernel_compat`: Minimum kernel version required.
-   `requires`: Dependency map with version constraints.
-   `lifecycle`: Hooks (`pre_install.py`, `post_install.py`) for custom setup.

---
*Created by Antigravity AI for TSF Ultimate Enterprise Suite.*
