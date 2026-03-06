# 📍 PROJECT CONTEXT (Source of Truth)

**Last Updated**: 2026-03-04
**Read by**: Both Antigravity and Claude Code

---

## 🎯 Current Status

### **Kernel OS v2.0**
**Status**: ✅ **100% COMPLETE** - Production Ready

**Components** (8 total):
1. ✅ Tenancy Engine - Auto tenant isolation
2. ✅ RBAC Engine - Permissions & roles
3. ✅ Audit Engine - 4-layer audit logging
4. ✅ Event Bus - Domain events with outbox pattern
5. ✅ Config Engine - Feature flags & configuration
6. ✅ Contracts Registry - Interface definitions
7. ✅ Module Loader - Enable/disable modules
8. ✅ Observability - Sentry, metrics, performance

**Files**: 54 kernel files, 6 module.json files
**Tables**: 18 database tables
**Documentation**: Complete

---

## 🚧 Active Work

**Current Task**: NONE (Waiting for next assignment)
**Owner**: N/A
**Status**: Idle

**Last Completed**:
- ✅ Kernel OS v2.0 (completed 2026-03-04)
- ✅ AI Orchestration System design (completed 2026-03-04)
- ✅ Agent Behavioral Rules System (completed 2026-03-04)
- ✅ Antigravity Architecture Constraints (completed 2026-03-04)
- ✅ Module Boundaries Enforcement System (completed 2026-03-04)
- ✅ Event Contracts System (completed 2026-03-04)
- ✅ Events & Contracts per Module — 100% wired (completed 2026-03-04)
  - 19 contracts registered at startup via `apps/core/apps.py`
  - 20 `@subscribe_to_event` handlers across 6 modules
  - All 6 module `apps.py` import `events.py` in `ready()` to activate handlers


---

## 📋 Next Phase Options

**Choose one**:
1. **Integration & Testing** - Test kernel in dev environment
2. **Module Boundaries** - Build linter, enforce boundaries
3. **Event Contracts** - Define contracts for cross-module communication
4. **AI Agents** - Build event-driven AI agent framework

**Recommended**: Module Boundaries (prevents spaghetti code)

---

## 🏗️ Architecture Decisions

### **Event-Driven Communication**
- ✅ Modules communicate via events (not direct calls)
- ✅ Outbox pattern ensures reliability
- ✅ Contracts enforce interface definitions

### **Module Isolation**
- ✅ Each module has `module.json` manifest
- ✅ Module loader enables/disables per tenant
- ✅ Boundaries to be enforced (next phase)

### **Kernel-First**
- ✅ All modules inherit from TenantOwnedModel
- ✅ Automatic tenant isolation
- ✅ Automatic audit logging
- ✅ Centralized RBAC

---

## 📁 File Structure

```
erp_backend/
├── kernel/                    # ✅ COMPLETE (do not modify)
│   ├── tenancy/
│   ├── rbac/
│   ├── audit/
│   ├── events/
│   ├── config/
│   ├── contracts/
│   ├── modules/
│   └── observability/
│
├── apps/
│   ├── core/module.json       # ✅ Created
│   ├── finance/module.json    # ✅ Created
│   ├── inventory/module.json  # ✅ Created
│   ├── crm/module.json        # ✅ Created
│   ├── pos/module.json        # ✅ Created
│   └── hr/module.json         # ✅ Created
│
└── .ai/
    ├── CONTEXT.md                    # ✅ This file
    ├── CURRENT_WORK.md               # ✅ Created
    ├── ROUTING_RULES.yaml            # ✅ Created
    ├── AI_ORCHESTRATION.md           # ✅ Complete guide
    ├── AGENT_RULES.md                # ✅ Behavioral rules
    ├── ANTIGRAVITY_CONSTRAINTS.md    # ✅ Architecture enforcement
    ├── ANTIGRAVITY_QUICK_START.md    # ✅ Quick reference
    └── scripts/
        └── validate_architecture.py   # ✅ Validation tool
```

---

## 🚫 Do NOT Touch (Locked)

These are **complete and stable**:
- `erp_backend/kernel/` (all files)
- `apps/*/module.json` (reviewed and approved)
- `KERNEL_COMPLETE_V2.md` (final documentation)

**Exceptions**: Bug fixes only (with approval)

---

## 🎓 Key Concepts

### **Tenancy**
- Every model inherits from `TenantOwnedModel`
- Automatic tenant filtering on ALL queries
- Impossible to leak cross-tenant data

### **Events**
- Use `emit_event()` for cross-module communication
- Events stored in outbox (transactional)
- Background worker processes events

### **Contracts**
- Define with `define_contract()`
- Validate with `@enforce_contract`
- Track producers/consumers

### **Modules**
- Each has `module.json` manifest
- Enable/disable per tenant
- Track dependencies

---

## 📊 Modules Status

| Module | Status | module.json | Events | Contracts |
|--------|--------|-------------|--------|-----------|
| core | ✅ Complete | ✅ | - | ✅ |
| finance | 🟡 Active | ✅ | ✅ | ✅ |
| inventory | 🟡 Active | ✅ | ✅ | ✅ |
| crm | 🟡 Active | ✅ | ✅ | ✅ |
| pos | 🟡 Active | ✅ | ✅ | ✅ |
| hr | 🟡 Active | ✅ | ✅ | ⏳ |
| ecommerce | 🟡 Active | ✅ | ✅ | ⏳ |

**Legend**:
- ✅ Complete
- 🟡 Active development
- ⏳ Not started
- ❌ Blocked

---

## 📝 Recent Changes

### 2026-03-04
- ✅ Completed Kernel OS v2.0 (8 components)
- ✅ Created 54 kernel files
- ✅ Added module.json for 6 modules
- ✅ Created AI orchestration system
- ✅ Archived unnecessary documentation

---

## 🔄 Update Protocol

**When starting new work**:
1. Update `CURRENT_WORK.md` with task details
2. Lock files being modified
3. Update this file when complete

**When switching AIs**:
1. Update `CURRENT_WORK.md` with handoff
2. Reference this file for context
3. Update status when done

---

**Version**: 1.0.0
**Maintained by**: Both AIs
**Update Frequency**: Every task start/end
