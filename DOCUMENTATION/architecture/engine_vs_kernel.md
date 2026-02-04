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

---

## ⛔ Strict Architectural Constraints

To maintain the integrity of the TSFSYSTEM, all contributions must follow these rules:

1.  **❌ No feature design without architectural classification**: You MUST explicitly state if a feature is Kernel or Engine before any code is written.
2.  **❌ No Kernel logic inside Engine modules**: Engine modules must remain isolated. Core system logic (e.g., authentication, routing shell, global config) must stay in the Kernel.
3.  **❌ No silent global changes**: Any change affecting the entire platform (white-labeling, sidebar icons, base CSS) MUST be documented and versioned.
4.  **❌ No versionless updates**: Every change to a module or the kernel MUST increment the semantic version in the corresponding `manifest.json` or `PLATFORM_CONFIG`.

---

## 🛡️ Platform Integrity Rules

These rules enforce accountability, prevent duplication, and enable business-driven workflows.

### Rule 1: "Uniqueness Before Creation" 🔍

> **Before implementing a new page, class, or API endpoint, you MUST verify it does not already exist in any active module.**

| Step | Action |
|---|---|
| 1 | Search existing modules in `erp_backend/apps/` and `src/app/(saas)/` for similar functionality. |
| 2 | If a similar feature exists, **reuse or extend it** instead of creating a duplicate. |
| 3 | If the feature is truly new, document its purpose in the `implementation_plan.md`. |

**Violation**: Creating a duplicate feature is a **critical architectural violation**.

---

### Rule 2: "Universal Audit Logging" 📜

> **All database mutations (CREATE, UPDATE, DELETE) and sensitive data access MUST be logged via the central `AuditLog` service.**

- **Model**: `AuditLog` stores `actor`, `action`, `table_name`, `record_id`, `old_value`, `new_value`, `ip_address`, `timestamp`.
- **Service**: `AuditService.log_event(...)` called from all ViewSets.
- **Scope**: Applies to all **Engine Modules**. See [audit_and_workflow_engine.md](audit_and_workflow_engine.md) for schema details.

---

### Rule 3: "Conditional Approval Workflow" ✅

> **Specific data changes can be configured to require approval before or after they take effect.**

| Mode | Behavior |
|---|---|
| **Pre-Approval** | Change is **held** until a manager approves. |
| **Post-Approval** | Change is **applied immediately** but flagged for review. |

- **Criteria**: Event priority and actor role determine the mode.
- **Task Generation**: Approved events can automatically create tasks (e.g., "Print Etiquette" -> Shelf Manager).
- See [audit_and_workflow_engine.md](audit_and_workflow_engine.md) for `WorkflowDefinition` and `TaskQueue` schemas.

---

### Rule 4: "Granular Permission Registry" 🔐

> **Every Module MUST declare a list of permissions in its `manifest.json`.**

```json
// Example: inventory/manifest.json
{
  "permissions": [
    { "code": "inventory.view_products", "label": "View Products" },
    { "code": "inventory.add_product", "label": "Add New Product" }
  ]
}
```

| Enforcement Point | Mechanism |
|---|---|
| **Backend** | `@permission_required('inventory.add_product')` decorator. |
| **Frontend** | `useHasPermission('inventory.add_product')` hook. |
