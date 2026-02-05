---
description: MANDATORY rules for developing on Blanc Engine - read before ANY task
---

# Blanc Engine Development Rules

**⚠️ READ THIS BEFORE ANY TASK ⚠️**

This platform is NOT a normal webapp. It is a **Kernel-based modular platform** similar to an OS.

**📝 SELF-UPDATING RULE:** When developing new features or modules, UPDATE THIS DOCUMENT with any new rules, patterns, or gotchas discovered. This keeps the rules current as the platform evolves.

---

## 🛡️ GOLDEN RULES

### 1. NEVER Pollute the Kernel
- **Kernel space** = `src/app/(privileged)/(saas)/`
- Only **core infrastructure** goes here (settings, kernel, modules, organizations)
- Business features → `src/modules/` with dynamic mounting
- If it's OPTIONAL → it's NOT kernel

### 2. Check Kernel Version First
Before implementing ANY feature, ask:
- "What is the current engine version?" 
- Check `/kernel` page or `KernelManager.get_current_version()`
- Reference this version when creating kernel updates

### 3. Modules Must Be Self-Contained
- Backend: `apps/{module_name}/` 
- Frontend: `src/modules/{module_name}/`
- Manifest: `manifest.json` with sidebar_items, routes, features
- No direct imports between modules - use APIs

### 4. Security is Mandatory in Production
- All module/kernel packages must be signed
- `REQUIRE_PACKAGE_SIGNATURES = True` in production
- Use `sign_package.py` before distribution

### 5. Feature Completeness Checklist
Every page, feature, or module MUST include:

| Component | Description |
|-----------|-------------|
| ✅ **Permissions** | Role-based access control (who can access?) |
| ✅ **API Endpoints** | Backend REST API with proper auth |
| ✅ **Audit Logs** | Log user actions for compliance/debugging |
| ✅ **MCP Tools** | AI tool definitions if feature is AI-accessible |
| ✅ **Validation** | Input validation on both frontend and backend |
| ✅ **Error Handling** | Proper error messages and recovery |
| ✅ **Documentation** | What it does, how to use, data flow |

**DO NOT** ship a feature that is just a frontend shell. Every feature must be production-ready.

---

## 📋 DEFERRED WORK BACKLOG

Track items for later implementation:

1. [ ] Full signature enforcement in production
2. [ ] MCP module frontend dynamic mounting
3. [ ] Module dependency resolution UI
4. [ ] Kernel rollback functionality
5. [ ] Module hot-reload without restart

---

## 🔄 CODE CONTINUITY RULES

When resuming work from a previous session:

1. **Check `task.md`** in artifacts for current progress
2. **Check `walkthrough.md`** for what was accomplished
3. **Check engine version** to understand current state
4. **Read relevant KIs** (Knowledge Items) for context
5. **Review recent git commits** for context: `git log -n 10 --oneline`

---

## 👥 MULTI-AGENT COLLABORATION

When multiple agents may be working on the project:

### Before Starting ANY Work
1. **Check `WORK_IN_PROGRESS.md`** - See what others are working on
2. **Claim your work area** - Add entry to `WORK_IN_PROGRESS.md`:
   ```markdown
   ## [Agent/Session ID] - [Timestamp]
   - Working on: [feature/module name]
   - Files: [list of files being modified]
   - Status: IN_PROGRESS
   ```
3. **Pull latest** - `git pull origin main` before any edits

### During Work
- **Stay in your lane** - Only edit files you claimed
- **Frequent commits** - Push often to reduce conflicts
- **Don't touch core without approval** - `erp/models.py`, `settings.py`, `urls.py`

### After Completing Work
1. **Update `WORK_IN_PROGRESS.md`** - Mark status as DONE
2. **Update deferred backlog** if you discovered new items
3. **Push and notify** - Others can now work on related areas

### Conflict Resolution
If you find uncommitted changes or conflicts:
1. **DO NOT force push**
2. Check `WORK_IN_PROGRESS.md` for owner
3. If no owner claimed, proceed carefully with `git stash` → `git pull` → `git stash pop`

### Directory Ownership (Soft Lock)
| Area | Owner |
|------|-------|
| `erp/` | Core team only - requires approval |
| `apps/{module}/` | Module developer |
| `src/modules/{module}/` | Module developer |
| `DOCUMENTATION/` | Anyone can update |

---

## 🔌 MODULE COMMUNICATION

Modules should NOT import each other directly. Use:

1. **Backend APIs** - REST endpoints at `/api/{module}/`
2. **Events** - Django signals for cross-module notifications
3. **Shared Models** - Only core models in `erp/models.py`
4. **Feature Flags** - Check if module is enabled via `OrganizationModule`
5. **Model Connector** - Registry pattern to link module models to core

### Model Connector Pattern
When a module needs to reference another module's data:

```python
# In core: erp/connectors.py
class ModelRegistry:
    _models = {}
    
    @classmethod
    def register(cls, name, model):
        cls._models[name] = model
    
    @classmethod
    def get(cls, name):
        return cls._models.get(name)

# In module: apps/finance/apps.py
def ready(self):
    from erp.connectors import ModelRegistry
    from .models import Invoice
    ModelRegistry.register('finance.Invoice', Invoice)

# In another module that needs it:
Invoice = ModelRegistry.get('finance.Invoice')
if Invoice:
    # Module is installed, use it
    invoices = Invoice.objects.filter(...)
```

This allows modules to discover and use each other's models without hard dependencies.

---

## ❌ WHAT SHOULD NEVER BE IN KERNEL

- Business logic (finance calculations, inventory rules)
- Domain-specific features (POS, CRM, HR)
- Optional integrations (AI connectors, third-party APIs)
- Custom reports or dashboards

## ✅ WHAT BELONGS IN KERNEL

- Authentication & authorization
- Organization/tenant management
- Module management & dynamic mounting
- Kernel updates & version tracking
- Core settings infrastructure
- Health checks & system status

---

## 🚀 BEFORE PUSHING TO PRODUCTION

1. Run kernel integrity check: `npm run check-kernel`
2. Ensure no business modules in kernel space
3. Update version in commit message: `[vX.X.X-bNNN]`
4. Merge to `engine-stable` branch
5. Sign any distributable packages
