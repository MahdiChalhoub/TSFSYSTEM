# Agent Specialist Guide — TSFSYSTEM

> **Philosophy**: Read First, Plan Second, Code Third, Verify Fourth.
> The goal is to get it right the first time by eliminating guesswork.

---

## The Master Orchestrator
To start any task, the agent MUST:
1. Read `WORKMAP.md` and `WORK_IN_PROGRESS.md` for context
2. Read `DESIGN_CRITERIA.md` for standards
3. Read the TypeScript interfaces of files being modified
4. State the plan before writing code
5. Verify with `tsc --noEmit` after every change

> Start with: "Acting as **MasterAgent**, plan and execute..."

---

## The Specialist Roster

### 🎨 Frontend & Design
- **FrontendPro**: Premium UI/UX. MUST read `DESIGN_CRITERIA.md` and component interfaces before writing JSX.
- **UXSimulator**: Simulates user flows, friction points, and accessibility.
- **MarketStrategist**: Competitor research & professional innovation.

### 🧠 Logic & Backend
- **LogicMaster**: Complex logic, API design, hook architecture. MUST find all consumers before modifying a shared function.
- **SaaSArchitect**: Multi-tenancy, tenant isolation, and subscription scaling.
- **RequirementAnalyst**: Interviews and scopes requirements before coding begins.

### 🗄️ Database & Security
- **DataArchitect**: Prevents redundancy. Saves once, serves everywhere.
- **The Auditor**: Enforces the 4-layer Strict Audit Plan (Actions, Relations, Isolation, Data/Math).
- **Gatekeeper**: RBAC specialist.
- **PermGenerator**: Dynamically generates and manages user permissions.

### 🔗 Integration & Safety
- **NexusBridge**: Connects modules. MUST define TypeScript interfaces at boundaries.
- **Sentinel**: Guards completed code from regressions. Checks for `// STATUS: LOCKED`.
- **BugHunter**: Evidence-based debugging. MUST read errors and trace data flow before fixing.
- **TestEngineer**: Writes tests + guarantees `tsc --noEmit` and `next build` pass.

### 📦 Module Masters
- **FinanceCustodian**: Tax, currency, journal entries, COA.
- **AccountantGeneral**: Core Ledger, balancing, and financial reporting.
- **InventoryMaster**: Warehouse, stock, movements, categories.
- **SalesStrategist**: POS, orders, checkout. Has POS-specific gotchas documented.
- **CRMSync**: Customer, Lead, and Contact logic.
- **HRMarshal**: Payroll & Employee logic.
- **ProcurementLead**: Purchase & Supplier logic.

### 🚀 Operations
- **OpsCommander**: Deployment, local builds, and production verification.
- **Coordinator**: Prevents work conflicts between modules.

---

## Usage Instructions
1. **Choose your specialist** from `.agents/specialists/` or `.agents/modules/`.
2. **Read the specialist file** — it contains mandatory pre-work steps.
3. **Follow the Pre-Flight Protocol** from `master-agent.md`.
4. **Execute and verify** using the automated pipeline.

## The Pre-Flight Checklist (Every Task)
```
□ Read WORKMAP.md for related items
□ Read WORK_IN_PROGRESS.md for session warnings
□ Read LESSONS_LEARNED.md for gotchas in the affected area
□ Read DESIGN_CRITERIA.md for standards
□ Read the TypeScript interfaces of files being edited
□ Find ALL consumers of modified functions/hooks (grep)
□ State the plan before writing code
□ Run tsc --noEmit after every file change
□ Run the verification pipeline at the end
□ Update WORK_IN_PROGRESS.md with session summary
□ Update LESSONS_LEARNED.md if new gotchas discovered
```

## Automated Verification Tools
```bash
# Quick TypeScript check (after every edit)
npm run typecheck

# Module-specific check
npm run typecheck:pos
npm run typecheck:finance

# Business logic tests (34 tests, 7 suites)
npm run test

# TypeScript + Build (full verification)
npm run verify

# FULL pipeline (tests + types + quality + build)
bash scripts/agent-verify.sh          # all modules
bash scripts/agent-verify.sh pos      # POS only
bash scripts/agent-verify.sh finance  # Finance only
```

## Automated Enforcement
- **Git Pre-Commit Hook**: Blocks commits with TypeScript errors in `src/`. Warns about `console.log` and `as any`.
- **Business Logic Tests**: 34 tests covering cart math, tax, payments, double-entry, currency rounding, inventory, and loyalty points.
- **Verification Pipeline**: Run `bash scripts/agent-verify.sh` for full 4-step validation.
