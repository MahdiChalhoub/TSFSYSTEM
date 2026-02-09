---
description: MANDATORY onboarding document - read before ANY task on the Blanc Engine platform
---

# Blanc Engine — Agent Onboarding

**⚠️ READ THIS BEFORE YOUR FIRST TASK ⚠️**

This platform is NOT a normal webapp. It is a **Kernel-based modular platform** similar to an OS.

---

## 📖 Step 1: Read the Rules

Read ALL files in `.agent/rules/` before doing anything:

| Rule | What it covers |
|---|---|
| `architecture.md` | Kernel vs Engine boundary, multi-tenancy, module communication, versioning |
| `security.md` | Auth, validation, data protection, CSRF |
| `data-integrity.md` | Single source of truth, no duplicates, referential integrity |
| `module-mode.md` | Module development rules, isolation, manifest requirements |
| `isolation.md` | No cross-module imports, event-based communication |
| `cleanup.md` | Archive-first approach, never delete files |
| `plan.md` | Plan before executing, save plans and tasks |

## 📋 Step 2: Check Current State

1. **Read `.agent/WORK_IN_PROGRESS.md`** — What did the last agent do?
2. **Read `.agent/WORKMAP.md`** — What tasks are pending?
3. **Check engine version**: `KernelManager.get_current_version()` or `/kernel` page
4. **Review recent commits**: `git log -n 10 --oneline`

## 🛡️ Step 3: Claim Your Work

Before editing ANY file, add your entry to `WORK_IN_PROGRESS.md`:

```markdown
### Session: YYYY-MM-DD (vX.X.X series)
- **Agent**: [name]
- **Status**: 🔄 IN_PROGRESS
- **Worked On**: [description]
- **Files Modified**: [list files]
```

## ✅ Step 4: Feature Completeness Checklist

Every feature MUST include ALL of these:

| Component | Required |
|---|---|
| ✅ Backend API | REST endpoints with proper auth |
| ✅ Frontend UI | Not just a shell — real functionality |
| ✅ Permissions | Role-based access control |
| ✅ Validation | Both frontend and backend |
| ✅ Error Handling | Proper messages and recovery |
| ✅ Documentation | In `/DOCUMENTATION/` — goal, data flow, workflow |
| ✅ Git Commit | Semantic version `[vX.X.X-bNNN]` |

## 🔄 Step 5: Before Ending Session

1. **Update `WORK_IN_PROGRESS.md`** — Mark DONE, add warnings
2. **Update `WORKMAP.md`** — Add discovered tasks, mark completed ones
3. **Push to GitHub** — Every session ends with a push
4. **Never force push** — If conflicts exist, resolve carefully

## 📁 Directory Map

| Area | Path | Who |
|---|---|---|
| Kernel frontend | `src/app/(privileged)/(saas)/` | Core team only |
| Module frontend | `src/modules/{module}/` | Module developer |
| Core backend | `erp_backend/erp/` | Core team only — requires approval |
| Module backend | `erp_backend/apps/{module}/` | Module developer |
| Documentation | `DOCUMENTATION/` | Anyone |
| Agent config | `.agent/` | Anyone |

## 📝 Deferred Work Backlog

See `.agent/WORKMAP.md` for the full backlog. Key deferred items:
1. Full signature enforcement in production
2. MCP module frontend dynamic mounting
3. Module dependency resolution UI
4. Kernel rollback functionality
5. Module hot-reload without restart
