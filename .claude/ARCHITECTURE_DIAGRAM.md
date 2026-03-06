# Claude Code Agent Architecture - Visual Guide

## 🏗️ Complete System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION LAYER                          │
│                                                                         │
│  Slash Commands:                                                        │
│  /preflight  /verify-module  /module-doc  /bug-hunt                   │
│  /deploy-check  /audit-security  /finance  /sales  /inventory  ...    │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│                       MASTER ORCHESTRATION LAYER                        │
│                                                                         │
│  CLAUDE.md (Project Brain)                                             │
│  - Project identity and architecture                                   │
│  - Core principles and standards                                       │
│  - Module map and file structure                                       │
│  - Verification pipeline definition                                    │
│  - Security rules and compliance                                       │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│                     LAYER 2: MODULE AGENTS                              │
│                     (Autonomous Orchestrators)                          │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ finance-agent│  │  sales-agent │  │inventory-agent│                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  crm-agent   │  │   hr-agent   │  │purchase-agent│                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                         │
│  ┌──────────────┐                                                      │
│  │ecommerce-agent│                                                     │
│  └──────────────┘                                                      │
│                                                                         │
│  Each agent:                                                            │
│  • Works independently in its domain                                   │
│  • Coordinates Layer 1 skills                                          │
│  • Uses module-bridge for cross-module needs                           │
└────────────────────────────────────────────────────────────────────────┘
                    ↓                           ↓
┌────────────────────────────────┐   ┌────────────────────────────────┐
│     CROSS-MODULE BRIDGE        │   │    LAYER 1: CORE SKILLS        │
│                                │   │      (Specialists)              │
│  module-bridge                 │   │                                 │
│  • Coordinates data exchange   │   │  ┌──────────────────────────┐ │
│  • Defines interface contracts │   │  │  backend-architect       │ │
│  • Prevents spaghetti code     │   │  │  frontend-engineer       │ │
│  • Documents dependencies      │   │  │  security-guardian       │ │
│                                │   │  │  api-designer            │ │
│  Protocol:                     │   │  │  test-engineer           │ │
│  FROM: module-agent-A          │   │  │  code-reviewer           │ │
│  TO: module-bridge             │   │  │  audit-enforcer          │ │
│  REQUEST: data from module-B   │   │  │  database-expert         │ │
│  INTERFACE: TypeScript def     │   │  │  ux-designer             │ │
│  EXISTING: check if exists     │   │  └──────────────────────────┘ │
└────────────────────────────────┘   └────────────────────────────────┘
                                               ↓
┌────────────────────────────────────────────────────────────────────────┐
│                        AUTOMATION & QUALITY LAYER                       │
│                                                                         │
│  Hooks (Event-Driven):                                                 │
│  • post-edit.sh → Auto-typecheck on file edits                        │
│                                                                         │
│  Verification Pipeline:                                                │
│  1. TypeScript check (zero errors)                                    │
│  2. Business logic tests (34 tests, 7 suites)                         │
│  3. Code quality scan (no console.log, no hardcoded colors)           │
│  4. Build check (production build succeeds)                           │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│                          OUTPUT & DOCUMENTATION                         │
│                                                                         │
│  • WORK_IN_PROGRESS.md (session summary)                               │
│  • WORKMAP.md (task queue updates)                                    │
│  • LESSONS_LEARNED.md (gotchas and warnings)                          │
│  • BRIDGES/ (cross-module interface docs)                             │
│  • Code changes with audit trails                                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Workflow Example: "Add Multi-Currency Invoices"

```
User: "Add multi-currency support to invoices"
                    ↓
┌─────────────────────────────────────────────┐
│ Step 1: /preflight (Auto-runs)             │
│ - Read WORKMAP.md                           │
│ - Read DESIGN_CRITERIA.md                  │
│ - Read MODULE_FINANCE.md                   │
│ - Check for related tasks                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Step 2: finance-agent activates            │
│ "This is in my domain (finance)"           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Skill Coordination                                      │
│                                                                  │
│ finance-agent orchestrates:                                     │
│                                                                  │
│ 1. database-expert                                              │
│    → Design Currency model                                      │
│    → Plan migration strategy                                    │
│    → Add indexes                                                │
│                                                                  │
│ 2. api-designer                                                 │
│    → Define TypeScript interfaces                               │
│    → Update InvoiceCreateData type                             │
│    → Add currency field to response                            │
│                                                                  │
│ 3. backend-architect                                            │
│    → Create migration                                           │
│    → Update Invoice model                                       │
│    → Add CurrencyService                                        │
│    → Update views and serializers                              │
│                                                                  │
│ 4. security-guardian                                            │
│    → Review permissions                                         │
│    → Ensure tenant isolation on currency data                  │
│                                                                  │
│ 5. frontend-engineer                                            │
│    → Add currency selector to invoice form                     │
│    → Update invoice display with currency                      │
│    → Format amounts with currency symbol                       │
│                                                                  │
│ 6. ux-designer                                                  │
│    → Review user flow (selecting currency)                     │
│    → Ensure accessibility                                       │
│                                                                  │
│ 7. test-engineer                                                │
│    → Write tests for currency conversion                       │
│    → Test multi-currency invoicing flow                        │
│    → Test currency display formatting                          │
│                                                                  │
│ 8. audit-enforcer                                               │
│    → Ensure currency changes are logged                        │
│    → Log exchange rate usage                                   │
│                                                                  │
│ 9. code-reviewer                                                │
│    → Review implementation quality                             │
│    → Check for code duplication                                │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Step 4: Verification                        │
│ npm run typecheck:finance                   │
│ npm run test                                │
│ bash scripts/agent-verify.sh finance       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Step 5: Documentation Update                │
│ - WORK_IN_PROGRESS.md (session summary)    │
│ - WORKMAP.md (mark task done)              │
└─────────────────────────────────────────────┘
                    ↓
                  DONE ✅
```

---

## 🔗 Cross-Module Communication Example

```
Scenario: "Show customer loyalty points on invoices"

┌──────────────────────────────────────────────────────────────────┐
│ finance-agent (working on invoice display)                       │
│ "I need customer loyalty points balance"                         │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ Contact module-bridge                                             │
│                                                                   │
│ FROM: finance-agent                                               │
│ TO: module-bridge                                                 │
│ REQUEST: Customer loyalty points balance                         │
│ CONTEXT: Display on invoice header                               │
│ INTERFACE:                                                        │
│   interface CustomerLoyaltyInfo {                                │
│     customer_id: number;                                          │
│     points_balance: number;                                       │
│     tier: string;                                                 │
│   }                                                               │
│ EXISTING: Unknown, need to check CRM module                      │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ module-bridge researches                                          │
│ - Read DOCUMENTATION/MODULE_CRM.md                               │
│ - Check src/types/crm.ts                                         │
│ - Grep for existing loyalty endpoints                            │
│                                                                   │
│ Result: No existing interface for this                           │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ module-bridge contacts crm-agent                                  │
│                                                                   │
│ FROM: module-bridge (on behalf of finance-agent)                 │
│ TO: crm-agent                                                     │
│ REQUEST: Expose customer loyalty data                            │
│ CONTEXT: Finance module needs it for invoice display             │
│ SUGGESTED INTERFACE: CustomerLoyaltyInfo (see above)            │
│ PLEASE PROVIDE:                                                   │
│   1. Final TypeScript interface                                  │
│   2. API endpoint                                                 │
│   3. Security requirements                                        │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ crm-agent implements (coordinates its skills)                     │
│                                                                   │
│ 1. api-designer: Finalize interface                              │
│ 2. backend-architect: Create endpoint                            │
│    GET /api/crm/customers/:id/loyalty/                           │
│ 3. security-guardian: Apply RBAC + tenant isolation              │
│ 4. test-engineer: Test endpoint                                  │
│                                                                   │
│ Returns to module-bridge:                                         │
│ ✅ Interface: CustomerLoyaltyInfo (finalized)                    │
│ ✅ Endpoint: GET /api/crm/customers/:id/loyalty/                 │
│ ✅ Permission: crm.view_customer                                 │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ module-bridge returns to finance-agent                            │
│                                                                   │
│ "Here's the interface contract:"                                 │
│ - TypeScript interface: CustomerLoyaltyInfo                      │
│ - API endpoint: GET /api/crm/customers/:id/loyalty/             │
│ - Import from: @/types/crm (shared)                             │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ finance-agent implements its side                                 │
│                                                                   │
│ 1. frontend-engineer: Add loyalty display to invoice            │
│ 2. api-designer: Use CustomerLoyaltyInfo interface              │
│ 3. test-engineer: Test integration                              │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ module-bridge documents the bridge                                │
│                                                                   │
│ Creates: DOCUMENTATION/BRIDGES/finance-crm-loyalty.md           │
│ - Interface definition                                            │
│ - Endpoint documentation                                          │
│ - Usage examples                                                  │
│ - Security notes                                                  │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ Both modules verify independently                                 │
│                                                                   │
│ CRM:     bash scripts/agent-verify.sh crm                       │
│ Finance: bash scripts/agent-verify.sh finance                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
                          DONE ✅
```

---

## 🎯 Security Layer Integration

```
┌────────────────────────────────────────────────────────────────┐
│                    Every Agent Action                           │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│              security-guardian (Always Active)                  │
│                                                                 │
│  Enforces 14 Security Rules:                                   │
│  ✓ Authentication required                                     │
│  ✓ Tenant isolation (filter by request.tenant)                │
│  ✓ RBAC permissions (user.has_perm())                         │
│  ✓ SQL injection prevention (ORM only)                        │
│  ✓ XSS prevention (sanitize input)                            │
│  ✓ CSRF protection (tokens enabled)                           │
│  ✓ Secrets management (env vars)                              │
│  ✓ Audit logging (all state changes)                          │
│  ✓ Rate limiting (on sensitive endpoints)                     │
│  ✓ Input validation (serializers + Zod)                       │
│  ✓ Password security (PBKDF2 hashing)                         │
│  ✓ JWT security (short-lived tokens)                          │
│  ✓ File upload security (type validation)                     │
│  ✓ HTTPS only (production)                                    │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│           audit-enforcer (Logs Everything)                      │
│                                                                 │
│  4-Layer Audit Plan:                                           │
│  1. User Actions (WHO did WHAT, WHEN)                         │
│  2. Relations (cascading effects)                             │
│  3. Tenant Isolation (boundary verification)                  │
│  4. Data/Math (calculations logged)                           │
└────────────────────────────────────────────────────────────────┘
                            ↓
                  Code is Secure ✅
```

---

## 📊 Quality Verification Pipeline

```
                Code Changes Complete
                        ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 1: TypeScript Check                                       │
│ npm run typecheck                                              │
│ Target: Zero errors in src/                                   │
└────────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 2: Business Logic Tests                                   │
│ npm run test                                                   │
│ 34 tests across 7 suites:                                     │
│ • Cart math (subtotal, tax, discounts)                        │
│ • Tax engine (inclusive/exclusive)                            │
│ • Payments (split, change, refunds)                           │
│ • Double-entry accounting                                     │
│ • Currency (conversion, rounding)                             │
│ • Inventory (stock calculations)                              │
│ • Loyalty points                                              │
└────────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 3: Code Quality Scan                                      │
│ • Check for console.log (none allowed)                        │
│ • Check for debugger (none allowed)                           │
│ • Check for @ts-ignore (requires justification)               │
│ • Check for hardcoded colors (use theme vars)                 │
│ • Check for as any (use proper types)                         │
└────────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 4: Production Build                                       │
│ npm run build                                                  │
│ • Kernel integrity check                                      │
│ • Next.js production build                                    │
│ • Static analysis                                             │
│ • No runtime errors                                           │
└────────────────────────────────────────────────────────────────┘
                        ↓
            All Checks Pass ✅
                        ↓
                Ready to Deploy
```

---

**This completes the visual architecture guide.**

See `.claude/README.md` for usage instructions.
See `.claude/CLAUDE.md` for project context.
See `.claude/IMPLEMENTATION_SUMMARY.md` for what was built.
