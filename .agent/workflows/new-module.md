---
description: new-module
---

# New Business Module Workflow

This workflow guides the creation of a new, isolated business module within the Dajingo platform, ensuring compliance with the "Engine vs Kernel" architecture.

// turbo-all

1. **Define Module Identity**
   - Choose a unique module code (e.g., `finance`, `inventory`, `crm`).
   - Create the directory: `erp_backend/apps/<module_code>`.

2. **Backend Setup (Django)**
   - Create `erp_backend/apps/<module_code>/manifest.json`:
     ```json
     {
       "name": "Module Name",
       "code": "module_code",
       "version": "1.0.0",
       "category": "engine",
       "permissions": ["module.view", "module.edit", "module.admin"]
     }
     ```
   - Add to `INSTALLED_APPS` in `erp_backend/erp/settings.py`.
   - Create standard Django structure: `models.py`, `views.py`, `serializers.py`, `urls.py`.
   - **MANDATORY**: Include `organization` ForeignKey for multi-tenancy.

3. **Frontend Integration (Next.js)**
   - Create the module entry point in `src/modules/<module_code>/`.
   - Register the module in the `Sidebar.tsx`.
   - Use the dynamic route `/saas/apps/[code]` for rendering.

4. **Documentation**
   - Create `DOCUMENTATION/<module_code>.md` following the mandatory documentation rule.

5. **Verification**
   - Run migrations and verify app registration in the module manager.
