# Pre-Flight Research Protocol

You are acting as **MasterAgent** (see `.agents/specialists/master-agent.md`).

## CRITICAL RULE: Research Before Writing

> **Never edit a file you haven't read.**
> **Never pass props to a component whose interface you haven't verified.**
> **Guessing field names = instant failure.**

---

## Execute Pre-Flight Checklist

### Phase 0: Context Gathering (5 minutes)

Read these files in order:

1. **`WORKMAP.md`**
   - Check for related open/done items
   - Look for dependencies or conflicts

2. **`WORK_IN_PROGRESS.md`**
   - Check for warnings from previous sessions
   - Identify any incomplete work in the affected area

3. **`LESSONS_LEARNED.md`**
   - Check for gotchas related to the module/area you're working on
   - Read warnings about specific files or patterns

4. **`CODEBASE_MAP.md`**
   - Find WHERE files live
   - Understand WHAT components exist
   - Learn HOW data flows

5. **`DESIGN_CRITERIA.md`**
   - Visual standards (colors, spacing, typography)
   - Architectural patterns
   - Theme system requirements

6. **Identify the affected module** and read its documentation:
   - `DOCUMENTATION/MODULE_{MODULE}.md`
   - `.agents/modules/{module-name}.md`

7. **Review applicable `.agent/rules/`** (ALWAYS-ON mandatory rules):
   - `architecture.md` - Module structure, Engine vs Kernel
   - `security.md` - 14 security rules (auth, XSS, CSRF, secrets)
   - `isolation.md` - Tenant isolation enforcement
   - `data-integrity.md` - Database and validation standards
   - `responsiveness.md` - Viewport rules, mobile-first
   - `cleanup.md` - Code cleanup standards

---

### Phase 1: File Research (10 minutes)

For EVERY file you plan to edit:

1. **Read the FULL file first** (or at minimum the outline + key sections)
   ```bash
   # Use Read tool to view the file
   ```

2. **Read the TypeScript types/interfaces** that the file consumes AND produces
   ```bash
   # Look for: interface, type, Props, ReturnType
   ```

3. **Trace data flow**:
   - Where does props/data come from?
   - Where does it go?
   - What components/functions consume this?

4. **Search for ALL consumers**:
   ```bash
   # Use Grep tool to find every file that imports/uses the function/component
   ```

5. **Read the prop types / interface definitions** of components you will wire into

#### Critical Research Checklist:
```
□ I have read the TypeScript interface for the component I am editing
□ I have read the TypeScript interface for every component I pass props TO
□ I have identified every consumer of the function/hook I am modifying
□ I have verified the exact field names in the database/API response
□ I have checked the existing state management (what hook/context provides the data?)
□ I have verified the import paths are correct
□ I understand the data flow from API → Component → Child Components
```

---

### Phase 2: Plan Declaration

Before writing code, state your plan explicitly:

1. **What** files will be changed (full paths)
2. **Why** each change is needed (problem statement)
3. **What** types/interfaces are involved (TypeScript signatures)
4. **What** could break (impact analysis - list ALL consumers)
5. **How** you will verify success (which tests/checks to run)

Example:
```
PLAN:
- Edit: src/app/(privileged)/finance/invoices/page.tsx
  Why: Add multi-currency display support
  Types: Invoice interface, Currency type from src/types/finance.ts
  Impact: InvoiceCard component (consumer), InvoiceList (parent)
  Verify: npm run typecheck:finance && npm run test

- Edit: src/components/finance/InvoiceCard.tsx
  Why: Accept new currencyCode prop
  Types: InvoiceCardProps interface (add currencyCode: string)
  Impact: 3 consumers (InvoiceList, InvoiceDetail, DashboardWidget)
  Verify: Grep for all InvoiceCard imports, update each
```

---

### Phase 3: Select Appropriate Workflow

Based on task type, choose the right workflow:

| Task Type | Workflow File | When to Use |
|-----------|---------------|-------------|
| Vague request | `.agent/workflows/auto-scope.md` | User gave unclear requirements |
| New feature | `.agent/workflows/new-feature.md` | Full-stack feature from scratch |
| New API | `.agent/workflows/new-api.md` | Create new backend endpoint |
| Module work | `.agent/workflows/dev-module.md` | Working within existing module |
| Bug fix | `.agents/specialists/bug-hunter.md` | Debugging and fixing issues |
| Security audit | `.agent/workflows/security-audit.md` | Vulnerability scanning |
| Deployment | `.agent/workflows/deploy-smart.md` | Production deployment |
| Cleanup | `.agent/workflows/cleanup-project.md` | Tech debt, refactoring |

---

### Phase 4: Execute with Validation

After EVERY non-trivial edit:

1. **Run TypeScript check**:
   ```bash
   npm run typecheck
   # Or module-specific:
   npm run typecheck:pos
   npm run typecheck:finance
   ```

2. **Fix all errors BEFORE moving to the next file**
   - Zero tolerance for leaving broken files

3. **Never leave a file in a broken state**
   - If you must stop, revert the change

---

### Phase 5: Final Verification

After all changes are complete:

1. **Run the full verification pipeline**:
   ```bash
   bash scripts/agent-verify.sh          # All modules
   bash scripts/agent-verify.sh finance  # Finance only
   bash scripts/agent-verify.sh pos      # POS only
   ```

   This runs:
   - Business logic tests (34 tests, 7 suites)
   - TypeScript check (src/ only)
   - Code quality scan
   - Build check

2. **Or run individual checks**:
   ```bash
   npm run test          # Business logic tests
   npm run typecheck     # TypeScript errors in src/
   npm run verify        # Typecheck + full build
   ```

3. **Update documentation**:
   - `WORK_IN_PROGRESS.md` - Add session summary
   - `WORKMAP.md` - Mark completed items, add newly discovered tasks
   - `LESSONS_LEARNED.md` - Document new gotchas if discovered

---

## Anti-Patterns to AVOID

| ❌ WRONG | ✅ CORRECT |
|---------|-----------|
| Edit without reading | Read full file outline first |
| Guess prop names | Read TypeScript interface |
| Add props without checking consumers | Grep for all imports |
| Assume function signature | Read the definition |
| Skip TypeScript check | Run after EVERY file edit |
| Add CSS without standards check | Cross-reference DESIGN_CRITERIA.md |
| Create new state unnecessarily | Search existing hooks/context first |
| Edit only one component | Trace full prop chain (parent + children) |

---

## Success Criteria

You have completed pre-flight when:

- ✅ All context documents read
- ✅ All affected files read
- ✅ All TypeScript interfaces verified
- ✅ All consumers identified
- ✅ Data flow understood
- ✅ Plan stated and clear
- ✅ Workflow selected
- ✅ Impact analysis complete
- ✅ Verification method defined

**Only then** should you proceed to code.

---

**Remember**: 5 minutes of research saves 50 minutes of rework.
