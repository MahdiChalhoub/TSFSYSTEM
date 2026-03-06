# TSFSYSTEM ERP — Claude Code Master Configuration

## 🎯 Project Identity
- **Name**: TSFSYSTEM (TSF ERP Platform)
- **Type**: Multi-tenant SaaS ERP System
- **Architecture**: Modular Django + Next.js 16 with hot-reload capability
- **Stack**: Django 5.1 + Next.js 16 + PostgreSQL + Redis + Celery
- **Deployment**: Production @ https://tsf.ci
- **Repository**: Multi-branch with main/master strategy

## 🧠 Core Philosophy

> **"Ask First, Understand Second, Propose Third, Code Fourth"**
>
> The goal is CUSTOM solutions that match user needs, NOT standard assumptions.

### The Six Pillars
1. **Ask Questions First**: NEVER assume - always clarify requirements
2. **Collaborative Planning**: Propose 2-3 options, user chooses approach
3. **No Hardcoding**: Everything configurable via kernel.config or database
4. **Custom > Standard**: User's specific needs > "best practices"
5. **Module Isolation**: Use events for cross-module communication
6. **Dynamic & Flexible**: Build systems that can be customized

### CRITICAL RULES (Read .ai/AGENT_RULES.md)
- ⚠️ **NO ASSUMPTIONS**: Ask clarifying questions before implementing
- ⚠️ **NO HARDCODING**: Use get_config() for all configurable values
- ⚠️ **PROPOSE OPTIONS**: Offer 2-3 approaches, let user decide
- ⚠️ **GET APPROVAL**: Show plan before implementing

## 📁 Project Structure Intelligence

### Backend (Django)
```
erp_backend/
├── apps/
│   ├── core/           # Tenant isolation, auth, base models
│   ├── finance/        # Tax, currency, invoices, journal entries, COA
│   ├── inventory/      # Products, warehouses, stock, movements, categories
│   ├── pos/            # Point of Sale, registers, sessions, receipts
│   ├── crm/            # Customers, leads, contacts, opportunities
│   ├── hr/             # Employees, payroll, attendance, departments
│   ├── ecommerce/      # Online store, promotions, coupons, shipping
│   ├── integrations/   # Third-party API connectors
│   └── workspace/      # Projects, tasks, documents
├── erp/                # Django settings, URLs, middleware
└── manage.py
```

### Frontend (Next.js 16)
```
src/
├── app/
│   ├── (privileged)/   # Protected routes (requires auth)
│   │   ├── finance/
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── crm/
│   │   ├── hr/
│   │   └── ecommerce/
│   ├── (public)/       # Public routes (login, register, etc.)
│   └── api/            # API route handlers
├── components/
│   ├── ui/             # Reusable UI primitives (shadcn/ui)
│   ├── finance/
│   ├── inventory/
│   ├── pos/
│   └── shared/
├── lib/                # Utilities, API clients, helpers
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
└── styles/             # Global styles, theme engine
```

### Agent Configuration
```
.agent/                 # Original agent methodology (keep intact)
├── rules/              # Mandatory always-on rules
├── workflows/          # Task-type workflows
├── CODEBASE_MAP.md
├── LESSONS_LEARNED.md
├── WORKMAP.md
└── WORK_IN_PROGRESS.md

.agents/                # Specialist definitions (keep intact)
├── specialists/        # Core specialists
├── modules/            # Module specialists
├── workflows/          # Workflow definitions
└── communication-protocol.md

.claude/                # Claude Code configuration (NEW)
├── CLAUDE.md          # This file
├── commands/          # Slash commands
├── agents/
│   ├── skills/        # Layer 1: Core skills
│   └── modules/       # Layer 2: Module orchestrators
└── hooks/             # Event-driven automation
```

## 🚦 Mandatory Pre-Flight Checklist

Before ANY code change, you MUST:

### Phase 0: Context Gathering
- [ ] Read `WORKMAP.md` - Check for related open/done items
- [ ] Read `WORK_IN_PROGRESS.md` - Check for session warnings
- [ ] Read `LESSONS_LEARNED.md` - Check for module-specific gotchas
- [ ] Read `CODEBASE_MAP.md` - Verify file locations and data flow
- [ ] Read `DESIGN_CRITERIA.md` - Understand UI/UX standards
- [ ] Read relevant `.agent/rules/*.md` - Apply mandatory policies

### Phase 1: File Research
For EVERY file you plan to edit:
- [ ] Read the FULL file (or outline + key sections)
- [ ] Read TypeScript interfaces it consumes AND produces
- [ ] Trace data flow (where does data come from? where does it go?)
- [ ] Search for ALL consumers using grep/search
- [ ] Verify import paths and prop names

### Phase 2: Plan Declaration
- [ ] State which files will be changed
- [ ] Explain why each change is needed
- [ ] List types/interfaces involved
- [ ] Analyze impact on consumers
- [ ] Define verification method

### Phase 3: Execute with Validation
- [ ] Run `npm run typecheck` after every edit
- [ ] Fix errors BEFORE moving to next file
- [ ] Never leave a file in broken state

### Phase 4: Final Verification
- [ ] Run full pipeline: `bash scripts/agent-verify.sh [module]`
- [ ] Update `WORK_IN_PROGRESS.md` with session summary
- [ ] Update `WORKMAP.md` if items completed/discovered
- [ ] Update `LESSONS_LEARNED.md` if new gotchas found

## 🎯 Agent Architecture: Two-Layer System

### Layer 1: Core Skills (Specialists)
These are the foundational experts. They do NOT work independently.
They are invoked by Layer 2 agents.

| Skill | Expertise | Invocation |
|-------|-----------|------------|
| **backend-architect** | Django, APIs, models, business logic | Module agents |
| **frontend-engineer** | React, Next.js, components, state | Module agents |
| **security-guardian** | Auth, RBAC, tenant isolation, XSS/CSRF | Module agents |
| **api-designer** | REST, TypeScript interfaces, validation | Module agents |
| **test-engineer** | Unit, integration, business logic tests | Module agents |
| **code-reviewer** | Quality, best practices, refactoring | Module agents |
| **audit-enforcer** | Audit logs, compliance, data integrity | Module agents |
| **database-expert** | Schema, migrations, queries, optimization | Module agents |
| **ux-designer** | User flows, accessibility, responsive design | Module agents |

### Layer 2: Module Agents (Orchestrators)
These work **independently** within their module domain.
They use Layer 1 skills and communicate via `module-bridge` when needed.

| Module Agent | Domain | Backend Path | Frontend Path |
|--------------|--------|--------------|---------------|
| **finance-agent** | Tax, invoices, payments, accounting | `apps/finance/` | `(privileged)/finance/` |
| **sales-agent** | POS, orders, quotes, checkout | `apps/pos/` | `(privileged)/sales/` |
| **purchase-agent** | Suppliers, POs, receiving, procurement | `apps/procurement/` | `(privileged)/purchase/` |
| **inventory-agent** | Products, warehouses, stock, movements | `apps/inventory/` | `(privileged)/inventory/` |
| **crm-agent** | Customers, leads, contacts, opportunities | `apps/crm/` | `(privileged)/crm/` |
| **hr-agent** | Employees, payroll, attendance, leaves | `apps/hr/` | `(privileged)/hr/` |
| **ecommerce-agent** | Online store, promotions, shipping | `apps/ecommerce/` | `(privileged)/ecommerce/` |

### Cross-Module Communication Protocol

When a module agent needs functionality from another module:

```
FROM: [Module Agent A]
TO: module-bridge
REQUEST: [What is needed from Module B]
CONTEXT: [Why it is needed]
INTERFACE: [Expected TypeScript types]
EXISTING: [What already exists in target module]
```

The `module-bridge` agent:
1. Reads target module's TypeScript interfaces
2. Identifies if functionality exists
3. Coordinates with target module agent
4. Returns interface contract to requesting agent

## 🔐 Security Rules (ALWAYS ENFORCED)

See `.agent/rules/security.md` for full 14-rule checklist. Key rules:

1. **Authentication**: All privileged routes require JWT auth
2. **Tenant Isolation**: ALWAYS filter by `request.tenant` in Django views
3. **RBAC**: Check `user.has_perm()` before state-changing operations
4. **SQL Injection**: Use Django ORM, never raw SQL with user input
5. **XSS Prevention**: Sanitize user input, use `dangerouslySetInnerHTML` sparingly
6. **CSRF Protection**: Django middleware enabled, tokens on all forms
7. **Secrets**: NEVER commit `.env` files, use environment variables
8. **Audit Logging**: Log ALL state changes via `AuditLogMixin`
9. **Rate Limiting**: API endpoints protected (Django-Ratelimit)
10. **Input Validation**: Zod schemas on frontend, Django serializers on backend

## 🎨 Design Standards

See `DESIGN_CRITERIA.md` for full guidelines. Key points:

- **Theme System**: Use CSS variables (`--app-bg-primary`, `--app-text-primary`)
- **NO Hardcoded Colors**: Never use `#hex` or `rgb()` directly
- **Responsive**: Mobile-first (except POS which is fullscreen-only)
- **Components**: Use shadcn/ui primitives from `src/components/ui/`
- **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation
- **Icons**: Lucide React icons only
- **Typography**: System font stack with fallbacks

## 🧪 Verification Pipeline

### Quick Checks (after every edit)
```bash
npm run typecheck              # TypeScript errors in src/
npm run typecheck:pos          # POS-specific check
npm run typecheck:finance      # Finance-specific check
```

### Comprehensive Verification
```bash
npm run test                   # Business logic tests (34 tests, 7 suites)
npm run verify                 # Typecheck + build
bash scripts/agent-verify.sh   # Full pipeline (all modules)
bash scripts/agent-verify.sh pos      # POS only
bash scripts/agent-verify.sh finance  # Finance only
```

### Test Coverage
- **Cart Math**: Subtotal, tax, discounts, loyalty points
- **Tax Engine**: Inclusive/exclusive, multi-rate, rounding
- **Payments**: Split payments, change calculation, refunds
- **Double-Entry**: Journal entry balance verification
- **Currency**: Conversion, rounding, precision
- **Inventory**: Stock calculations, reservations, movements

## 🚀 Module Agent Workflow

### Example: Finance Agent receives task

1. **Self-Assessment**
   ```
   "I am finance-agent. This task is within my domain (apps/finance/).
   I will need: backend-architect, frontend-engineer, test-engineer."
   ```

2. **Pre-Flight Research**
   ```
   - Read WORKMAP.md, LESSONS_LEARNED.md
   - Read DOCUMENTATION/MODULE_FINANCE.md
   - Read .agents/modules/finance-custodian.md
   - Read TypeScript interfaces in src/types/finance.ts
   ```

3. **Skill Invocation** (Internal - uses Layer 1)
   ```
   - backend-architect: Design API endpoint
   - database-expert: Plan schema change
   - security-guardian: Verify RBAC permissions
   - api-designer: Define TypeScript interface
   - frontend-engineer: Build UI component
   - test-engineer: Write business logic tests
   - audit-enforcer: Add audit logging
   ```

4. **Cross-Module Check**
   ```
   "Does this need inventory data?"
   → YES → Contact module-bridge
   → module-bridge coordinates with inventory-agent
   → Receive interface contract
   → Continue implementation
   ```

5. **Verification**
   ```
   npm run typecheck:finance
   npm run test
   bash scripts/agent-verify.sh finance
   ```

6. **Documentation Update**
   ```
   Update WORK_IN_PROGRESS.md
   Update WORKMAP.md (mark task as done)
   ```

## 📋 Available Slash Commands

### Core Commands
- `/preflight` - Run complete pre-flight research protocol
- `/verify-module [module]` - Run verification pipeline
- `/module-doc [module]` - Lookup module documentation

### Workflow Commands
- `/new-feature` - Full-stack feature development lifecycle
- `/bug-hunt` - Evidence-based debugging protocol
- `/deploy-check` - Pre-deployment verification checklist
- `/audit-security` - Security vulnerability scan

### Module Commands
- `/finance [task]` - Invoke finance-agent
- `/sales [task]` - Invoke sales-agent
- `/inventory [task]` - Invoke inventory-agent
- `/crm [task]` - Invoke crm-agent
- `/hr [task]` - Invoke hr-agent
- `/purchase [task]` - Invoke purchase-agent
- `/ecommerce [task]` - Invoke ecommerce-agent

## 🎓 Code Style & Conventions

### TypeScript
- Strict mode enabled
- No `any` types (use `unknown` if necessary)
- Prefer `interface` over `type` for object shapes
- Explicit return types on functions
- Zod schemas for runtime validation

### React/Next.js
- Functional components only
- Server components by default (`"use client"` only when needed)
- Custom hooks for reusable logic
- Avoid inline functions in JSX (define outside)
- Use `React.memo()` for expensive components

### Django
- Class-based views (CBV) with mixins
- `TenantRequiredMixin` on ALL privileged views
- Type hints on all functions
- Docstrings for complex logic
- Use `select_related()` / `prefetch_related()` to avoid N+1 queries

### Git Commits
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Reference module: `feat(finance): add multi-currency support`
- Include version tag: `(v3.1.4-AG-260303.1200)`

## 🔄 Git Workflow

- **Main Branch**: `main` (production-ready)
- **Feature Branches**: `feature/module-name-description`
- **Hotfix Branches**: `hotfix/issue-description`
- **Release Tags**: `v3.1.x-AG-YYMMDD.HHMM`

## 🌐 Environment Variables

Key variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis cache/queue
- `SECRET_KEY` - Django secret
- `NEXT_PUBLIC_API_URL` - API base URL
- `JWT_SECRET` - Token signing key

## 📊 Module Status & Health

| Module | Status | Backend | Frontend | Tests | Docs |
|--------|--------|---------|----------|-------|------|
| Finance | 🟢 Production | ✅ | ✅ | ✅ | ✅ |
| Inventory | 🟢 Production | ✅ | ✅ | ✅ | ✅ |
| POS | 🟡 Active Dev | ✅ | 🔄 | ✅ | ✅ |
| CRM | 🟢 Production | ✅ | ✅ | ✅ | ✅ |
| HR | 🟢 Production | ✅ | ✅ | ⚠️ | ✅ |
| Ecommerce | 🟡 Active Dev | ✅ | 🔄 | ⚠️ | 🔄 |
| Workspace | 🔵 Beta | ✅ | ✅ | ⚠️ | 🔄 |

## 🎯 Current Sprint Focus

See `WORK_IN_PROGRESS.md` for active session work.
See `WORKMAP.md` for backlog and roadmap.

---

**Last Updated**: 2026-03-03
**Agent Architecture Version**: 1.0.0
**Configuration Maintained By**: MasterAgent + TaskArchitect
