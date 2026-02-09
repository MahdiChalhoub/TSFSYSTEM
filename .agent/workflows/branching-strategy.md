---
description: Branching strategy for TSF Dajingo Platform (Blanc Engine & Updates)
---

# Branching Strategy & Push Policies

This workflow defines the rules for the three primary branches in the TSF Dajingo Platform to maintain the "Blanc Engine" architecture.

## 1. engine-stable (The Blanc Engine)
The pure infrastructure baseline. It MUST remain functional without any optional modules.

### ALLOWED to Push:
- Core middleware, authentication systems, and tenant resolution logic.
- Kernel Managers (`KernelManager`, `ModuleManager`) and update logic.
- Base layout components and global CSS/themes.
- Shared libraries in `src/lib/` or `erp_backend/erp/shared/`.
- System-wide models (User, Organization, Role, Permission).

### PROHIBITED to Push:
- Domain-specific models (e.g., Inventory, Product, Ledger, Invoice).
- Module-specific ViewSets or Serializers.
- Domain-specific server actions (e.g., `createProduct`, `checkout`).
- Functional app folders in `erp_backend/apps/` (except `core`).
- Module-specific pages in `src/app/(privileged)/saas/`.

## 2. update-core (Kernel Updates)
Staging branch for upcoming platform-wide infrastructure updates.

### ALLOWED to Push:
- Any changes that should be included in the next `update-core.zip`.
- Refinements to existing kernel files that are tracked in `engine-stable`.
- Database migrations for core system models.

### PROHIBITED to Push:
- Feature-specific code that belongs in a module.

## 3. update-modules (Module Updates)
Staging branch for modular feature packages.

### ALLOWED to Push:
- Feature code in `erp_backend/apps/[module_name]`.
- Frontend code in `src/app/(privileged)/saas/[module_name]`.
- Module-specific server actions and hooks.
- Module-specific database migrations.

### PROHIBITED to Push:
- Changes to core kernel files (unless necessary for the module to function, in which case they should likely be merged into `update-core` first).

---

## Workflow for the Agent

1. **Verify Branch**: Before every commit, verify you are on the correct branch using `git branch`.
2. **Impact Assessment**: Ask: "If I delete all folders in `apps/`, will this commit still compile?"
   - If NO, the changes belong in `update-core` or `engine-stable`.
   - If YES, the changes belong in `update-modules`.
3. **Draft Commits**: Label commits clearly with the version and module/core scope.
