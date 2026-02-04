# TSFSYSTEM Architecture: Engine vs. Kernel

This document explains the two primary operating modes of the TSFSYSTEM platform: **Kernel Mode** and **Engine Mode**.

## 1. Kernel Mode (The Skeleton)
**Kernel Mode** represents the immutable core logic and the static skeleton of the application. It is designed to be stable and provides the foundation upon which all other features run.

- **Purpose**: To provide the "Machine" that hosts the modular ERP.
- **Components**:
    - **Physical Next.js Infrastructure**: Build system, server configuration, and root folder structure.
    - **The Shell**: The persistent UI elements like `Sidebar.tsx`, `AdminLayout.tsx`, and the dynamic route orchestrators.
    - **Core Utils**: The API client (`erpFetch`), authentication logic, and primary database abstractions.
    - **Core Platform Module**: The foundational backend logic (located in `erp_backend/erp/modules/coreplatform`) that manages the menus, icons, and theme configuration.
- **Update Mechanism**: Handled via `KernelManager` using `.kernel.zip` packages or stable Git commits for structural changes.
- **Location**: Base repository and `erp_backend/erp/`.

## 2. Engine Mode (The Slots & Guards)
**Engine Mode** is the dynamic, modular layer of the system. It uses a "Slot & Guard" architecture to enable or disable features on-demand without affecting the Kernel.

- **Purpose**: To provide specific business functionality (SaaS Modules) that can be added or removed.
- **Logic**:
    - **Slots**: Areas in the UI (like the Dashboard or Sidebar) that are automatically populated when a module is present and active.
    - **Guards**: Security layers that prevent users from accessing routes associated with disabled modules.
    - **Isolation**: Each module is contained to prevent bugs from spreading across the system.
- **Components**: Business-specific modules like `inventory`, `finance`, `crm`, etc.
- **Update Mechanism**: Handled via `ModuleManager` using `.modpkg.zip` packages.
- **Location**: `erp_backend/apps/` (and legacy `erp_backend/erp/modules/`).

---

## Agent Rules: When to use which?

### Case A: Modifications to Kernel
If the task involves:
- Adding a new global service or API client.
- Modifying the login/auth flow.
- Changing the global sidebar/navigation structure.
- Updating the theme configuration or global white-labeling logic.
**Action**: Work in **Kernel Mode**. Document changes in `DOCUMENTATION/architecture/kernel_update_strategy.md`.

### Case B: Modifications to Engine (Modules)
If the task involves:
- Adding a new feature (e.g., "Add a report to Finance").
- Creating a new business module (e.g., "Add a module for HR").
- Fixing logic inside a specific application area (Inventory, POS, etc.).
**Action**: Work in **Engine Mode**. Ensure the module's `manifest.json` is updated and use the `ModuleManager` for lifecycle operations.
