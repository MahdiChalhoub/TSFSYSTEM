# TSFSYSTEM Claude Code Agent System

## 🎯 Overview

This is a complete, production-ready agent architecture for Claude Code that enables autonomous, intelligent development across the TSFSYSTEM ERP platform.

## 📐 Architecture: Two-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│                      MASTER ORCHESTRATION                    │
│  MasterAgent + CLAUDE.md (Project Brain)                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                            │
┌───────┴────────┐                         ┌────────┴────────┐
│   LAYER 2:     │                         │   LAYER 1:      │
│ MODULE AGENTS  │◄────coordinate────────► │  CORE SKILLS    │
│ (Orchestrators)│                         │  (Specialists)  │
└────────────────┘                         └─────────────────┘
```

### Layer 1: Core Skills (9 Specialists)
These are the foundational experts. They do NOT work independently.

1. **backend-architect** - Django, APIs, models, business logic
2. **frontend-engineer** - React, Next.js, components, state
3. **security-guardian** - Auth, RBAC, tenant isolation, XSS/CSRF
4. **api-designer** - REST, TypeScript interfaces, validation
5. **test-engineer** - Unit, integration, business logic tests
6. **code-reviewer** - Quality, best practices, refactoring
7. **audit-enforcer** - Audit logs, compliance, data integrity
8. **database-expert** - Schema, migrations, query optimization
9. **ux-designer** - User flows, accessibility, usability

### Layer 2: Module Agents (7 Orchestrators)
These work **independently** within their module domain.

1. **finance-agent** - Invoices, payments, taxes, accounting
2. **sales-agent** - POS, orders, quotes, checkout
3. **inventory-agent** - Products, warehouses, stock, movements
4. **crm-agent** - Customers, leads, contacts, opportunities
5. **hr-agent** - Employees, payroll, attendance, leaves
6. **purchase-agent** - Suppliers, POs, receiving, procurement
7. **ecommerce-agent** - Online store, promotions, shipping

### Cross-Module Communication

**module-bridge** - Coordinates data exchange between module agents using the communication protocol to prevent spaghetti code.

## 🚀 Quick Start

### Basic Usage

```bash
# Research before coding
/preflight

# Get module documentation
/module-doc finance

# Invoke a module agent
/finance [task description]

# Verify your work
/verify-module finance

# Pre-deployment checks
/deploy-check

# Security audit
/audit-security

# Debug issues
/bug-hunt
```

### Example Workflow

```
User: "Add multi-currency support to invoices"

1. Claude runs /preflight
   - Reads WORKMAP.md, DESIGN_CRITERIA.md, etc.

2. finance-agent takes the task
   - Coordinates with skills:
     • backend-architect: Design Currency model
     • database-expert: Plan migration
     • api-designer: Define TypeScript interfaces
     • security-guardian: Review permissions
     • frontend-engineer: Add currency selector UI
     • test-engineer: Write tests
     • audit-enforcer: Add audit logging

3. Cross-module needs (via module-bridge)
   - Needs exchange rates from external API
   - Coordinates interface contracts

4. Verification
   - npm run typecheck:finance
   - bash scripts/agent-verify.sh finance

5. Documentation update
   - WORK_IN_PROGRESS.md
   - WORKMAP.md
```

## 📁 Directory Structure

```
.claude/
├── CLAUDE.md                 # Master project context
├── README.md                 # This file
│
├── commands/                 # Slash commands (user-initiated)
│   ├── preflight.md          # Pre-flight research protocol
│   ├── verify-module.md      # Module verification pipeline
│   ├── module-doc.md         # Module documentation lookup
│   ├── bug-hunt.md           # Debugging protocol
│   ├── deploy-check.md       # Pre-deployment checklist
│   └── audit-security.md     # Security audit
│
├── agents/
│   ├── skills/               # Layer 1: Core specialists
│   │   ├── backend-architect.json
│   │   ├── frontend-engineer.json
│   │   ├── security-guardian.json
│   │   ├── api-designer.json
│   │   ├── test-engineer.json
│   │   ├── code-reviewer.json
│   │   ├── audit-enforcer.json
│   │   ├── database-expert.json
│   │   └── ux-designer.json
│   │
│   ├── modules/              # Layer 2: Module orchestrators
│   │   ├── finance-agent.json
│   │   ├── sales-agent.json
│   │   ├── inventory-agent.json
│   │   ├── crm-agent.json
│   │   ├── hr-agent.json
│   │   ├── purchase-agent.json
│   │   └── ecommerce-agent.json
│   │
│   └── module-bridge.json    # Cross-module coordinator
│
└── hooks/                    # Event-driven automation
    └── post-edit.sh          # Auto-typecheck after edits
```

## 🎓 How It Works

### 1. Module Agent Autonomy

Each module agent works **independently** within its domain:

```
User: "Fix invoice tax calculation bug"

↓
finance-agent activates
↓
Runs /preflight (reads docs, checks gotchas)
↓
Assesses: "This is in my domain (finance)"
↓
Coordinates skills:
  1. bug-hunter: Identify root cause
  2. backend-architect: Fix tax engine
  3. test-engineer: Add test case
  4. code-reviewer: Review fix
↓
Verifies: npm run typecheck:finance && npm run test
↓
Updates LESSONS_LEARNED.md with the gotcha
```

### 2. Cross-Module Communication

When a module needs data from another module:

```
finance-agent: "I need product data for invoices"
↓
Contacts module-bridge
↓
module-bridge:
  1. Checks if inventory module already exposes this
  2. If not, coordinates with inventory-agent
  3. inventory-agent creates interface + endpoint
  4. module-bridge returns contract to finance-agent
↓
finance-agent implements its side using the contract
↓
Both sides verified independently
```

### 3. Skill Coordination

Module agents don't code directly. They coordinate skills:

```
New Feature: "Add invoice PDF export"

finance-agent coordinates:
├── api-designer: Define TypeScript interface
│   └── interface InvoicePDF { ... }
├── backend-architect: Create PDF generation endpoint
│   └── /api/finance/invoices/:id/pdf/
├── security-guardian: Apply RBAC permissions
│   └── Requires 'finance.view_invoice'
├── frontend-engineer: Add "Download PDF" button
│   └── Component with loading state
├── ux-designer: Review user flow
│   └── Ensure accessibility
├── test-engineer: Write tests
│   └── Test PDF generation + download
├── audit-enforcer: Log PDF downloads
│   └── Track who downloaded what
└── code-reviewer: Review quality
    └── Check for code duplication
```

## 📋 Core Principles

### 1. Research First
> "Read First, Plan Second, Code Third, Verify Fourth"

Every task starts with `/preflight`:
- Read WORKMAP.md (task queue)
- Read WORK_IN_PROGRESS.md (warnings)
- Read LESSONS_LEARNED.md (gotchas)
- Read DESIGN_CRITERIA.md (standards)
- Read module documentation

### 2. Type Safety
> "Zero TypeScript errors policy"

- Enforced by hooks (auto-typecheck after edits)
- Module verification requires passing typecheck
- Frontend-backend interfaces must match

### 3. Module Isolation
> "Use communication protocol for cross-module changes"

- Modules never edit each other's code directly
- All cross-module communication via module-bridge
- Interface contracts documented in BRIDGES/

### 4. Audit Everything
> "4-layer audit plan (Actions, Relations, Isolation, Data/Math)"

- All state changes logged
- User actions tracked
- Tenant isolation verified
- Financial calculations logged

## 🔧 Slash Commands Reference

### Core Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/preflight` | Pre-flight research protocol | Before any coding task |
| `/verify-module [module]` | Run verification pipeline | After completing work |
| `/module-doc [module]` | Lookup module docs | When starting module work |

### Workflow Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/bug-hunt` | Evidence-based debugging | When fixing bugs |
| `/deploy-check` | Pre-deployment checklist | Before production deploy |
| `/audit-security` | Security vulnerability scan | Regular security audits |

### Module Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/finance [task]` | Invoke finance-agent | Finance module tasks |
| `/sales [task]` | Invoke sales-agent | Sales/POS tasks |
| `/inventory [task]` | Invoke inventory-agent | Inventory tasks |
| `/crm [task]` | Invoke crm-agent | CRM tasks |
| `/hr [task]` | Invoke hr-agent | HR tasks |
| `/purchase [task]` | Invoke purchase-agent | Purchasing tasks |
| `/ecommerce [task]` | Invoke ecommerce-agent | Ecommerce tasks |

## 🎯 Example Scenarios

### Scenario 1: Bug Fix
```
User: "POS checkout crashes when applying discount"

1. Claude: /preflight
2. sales-agent activates (POS is in sales domain)
3. Coordinates: bug-hunter → backend-architect → test-engineer
4. Fixes discount calculation bug
5. Adds test case to prevent regression
6. Verifies: /verify-module sales
7. Updates LESSONS_LEARNED.md
```

### Scenario 2: New Feature
```
User: "Add customer loyalty points to invoices"

1. Claude: /preflight
2. Assess: Finance (invoices) + CRM (loyalty)
3. finance-agent + crm-agent coordinate via module-bridge
4. module-bridge creates interface contract
5. Both agents implement their sides independently
6. Verification on both modules
7. Documentation updated
```

### Scenario 3: Security Issue
```
User: "Audit the invoice module for security issues"

1. Claude: /audit-security
2. security-guardian runs 14-rule checklist
3. Finds: Missing tenant filter on line 45
4. Finds: No RBAC check on delete endpoint
5. Reports findings with priorities
6. Creates fixes
7. Re-audits to verify
```

## 🔒 Security Integration

All agents follow the 14 security rules:
1. Authentication required
2. Tenant isolation enforced
3. RBAC permissions checked
4. SQL injection prevention
5. XSS prevention
6. CSRF protection
7. Secrets management
8. Audit logging
9. Rate limiting
10. Input validation
11. Password security
12. JWT security
13. File upload security
14. HTTPS only

## 📊 Verification Pipeline

Every module agent runs verification after changes:

```bash
# Quick check (after edit)
npm run typecheck:finance

# Business logic tests
npm run test

# Full verification
bash scripts/agent-verify.sh finance
```

Pipeline includes:
1. TypeScript check (zero errors)
2. Business logic tests (34 tests, 7 suites)
3. Code quality scan (no console.log, no hardcoded colors)
4. Build check (production build succeeds)

## 📚 Integration with Existing Methodology

This Claude Code architecture **enhances** your existing `.agent/` and `.agents/` methodology:

- `.agent/` - Original rules and workflows (kept intact)
- `.agents/` - Specialist definitions (kept intact)
- `.claude/` - Claude Code integration layer (new)

All three work together seamlessly.

## 🚦 Best Practices

### Do:
✅ Always run `/preflight` before coding
✅ Let module agents coordinate skills
✅ Use module-bridge for cross-module needs
✅ Run verification after every change
✅ Update documentation after tasks

### Don't:
❌ Skip the pre-flight checklist
❌ Let modules edit each other's code
❌ Guess prop names or interfaces
❌ Commit without running verification
❌ Leave TypeScript errors unfixed

## 🎓 Learning Resources

- **CLAUDE.md** - Complete project context
- **DESIGN_CRITERIA.md** - UI/UX standards
- **LESSONS_LEARNED.md** - Gotchas and warnings
- **WORKMAP.md** - Task queue and roadmap
- **DOCUMENTATION/** - Module-specific docs

## 🔄 Maintenance

### Weekly
- Run `/audit-security`
- Review WORKMAP.md and prioritize
- Update LESSONS_LEARNED.md with new gotchas

### Before Each Deploy
- Run `/deploy-check`
- All verifications must pass
- Security audit clean

### After Each Sprint
- Review module agent performance
- Update skill definitions if needed
- Refine communication protocols

## 🎯 Success Metrics

This system is successful when:
- ✅ Agents complete tasks autonomously
- ✅ Zero TypeScript errors in commits
- ✅ Cross-module communication uses interfaces
- ✅ Security audits pass consistently
- ✅ Tests cover new features
- ✅ Documentation stays current

## 📞 Support

For issues or questions:
1. Check `LESSONS_LEARNED.md` for known gotchas
2. Review module documentation in `DOCUMENTATION/`
3. Consult `.agents/specialists/` for specialist protocols

## 🚀 Version

**Agent Architecture Version**: 1.0.0
**Created**: 2026-03-03
**Last Updated**: 2026-03-03

---

**Remember**: This system is designed to make you more productive, not to replace your judgment. The agents are tools—use them wisely.
