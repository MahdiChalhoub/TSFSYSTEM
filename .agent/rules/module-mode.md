---
trigger: always_on
description: Module-focused development rules — work on one module at a time like a professional engineer
---

# Module-Focused Development Rules

## 1. One Module at a Time

When working on a module, you are a **professional engineer specializing in that module**.
- Focus exclusively on the active module
- Understand every file, model, view, serializer, and page in the module
- Do NOT scatter changes across unrelated modules

## 2. Module Boundaries

Each module has strict file boundaries:

### Backend (Django)
```
erp_backend/apps/{module}/
├── models.py          # Data models
├── views.py           # API ViewSets
├── serializers.py     # DRF serializers
├── services.py        # Business logic
├── urls.py            # URL routing
├── events.py          # Signal-based cross-module events
├── signals.py         # Signal receivers
├── manifest.json      # Module identity & permissions
└── migrations/        # Database migrations
```

### Frontend (Next.js)
```
src/app/(privileged)/{module}/     # Page routes
src/app/actions/{module}/          # Server actions (erpFetch calls)
src/modules/{module}/              # Dynamic module entry (if applicable)
```

## 3. What You CAN Touch

✅ Any file inside the active module's backend directory
✅ Any file inside the active module's frontend pages
✅ Any file inside the active module's server actions
✅ Module documentation in `DOCUMENTATION/`

## 4. What You CANNOT Touch Without Justification

❌ Shared kernel files (`src/middleware.ts`, `src/components/admin/Sidebar.tsx`)
❌ Core backend files (`erp_backend/erp/models.py`, `erp_backend/erp/views.py`)
❌ Other module directories (`erp_backend/apps/{other_module}/`)
❌ Other module frontend pages

If a change to shared/kernel code is required:
1. Document WHY in the plan
2. Make the minimal change necessary
3. Verify it doesn't break other modules

## 5. Plans & Tasks

All plans and tasks MUST be saved with the module name:
```
DOCUMENTATION/tasks/{MODULE}_PLAN_{NNN}.md
DOCUMENTATION/tasks/{MODULE}_TASK_{NNN}.md
```

Examples:
- `DOCUMENTATION/tasks/INVENTORY_PLAN_001.md`
- `DOCUMENTATION/tasks/FINANCE_TASK_003.md`

## 6. Quality Checklist Per Module

Before declaring a module complete:
- [ ] Every page renders without errors
- [ ] Every page has a corresponding server action file
- [ ] Every server action calls a real backend API endpoint
- [ ] Loading and error states are implemented
- [ ] TypeScript has no compilation errors for module files
- [ ] Documentation is up to date
- [ ] Backend ViewSets have proper tenant filtering
- [ ] `npm run build` passes

## 7. Module Inventory

Active modules in the system:
| Module | Backend | Frontend Pages | Status |
|--------|---------|---------------|--------|
| inventory | `apps/inventory/` | 24 pages | 🔄 Active |
| finance | `apps/finance/` | 48+ pages | 🔄 Active |
| crm | `apps/crm/` | Multiple | 🔄 Active |
| pos | `apps/pos/` | Multiple | 🔄 Active |
| hr | — | Multiple | ⚠️ Partial |
| purchases | — | Multiple | ⚠️ Partial |
| sales | — | Multiple | ⚠️ Partial |
