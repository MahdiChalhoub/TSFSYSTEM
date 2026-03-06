# Module Verification Pipeline

Run the complete verification suite for a module or the entire project.

## Usage

```bash
/verify-module [module-name]
```

**Arguments**:
- `module-name` (optional): pos, finance, inventory, crm, hr, ecommerce, workspace
- If omitted, runs verification for ALL modules

---

## Verification Steps

### 1. Module-Specific TypeScript Check (if available)

```bash
# Check if module-specific script exists
npm run typecheck:${MODULE} 2>&1
```

Available module scripts:
- `npm run typecheck:pos` - POS-specific TypeScript check
- `npm run typecheck:finance` - Finance-specific TypeScript check

### 2. Full TypeScript Check

```bash
npm run typecheck
```

This runs:
```bash
npx tsc --noEmit 2>&1 | grep '^src/' || echo '✅ No TypeScript errors in src/'
```

**Success criteria**: Zero TypeScript errors in `src/` directory

---

### 3. Business Logic Tests

```bash
npm run test
```

This runs the business logic test suite:
- **34 tests** across **7 test suites**
- Cart math (subtotal, tax, discounts)
- Tax engine (inclusive/exclusive, multi-rate)
- Payment calculations (split, change, refunds)
- Double-entry accounting (journal balance)
- Currency (conversion, rounding, precision)
- Inventory (stock calculations, reservations)
- Loyalty points (earning, redemption)

**Success criteria**: All tests pass

---

### 4. Production Build Check

```bash
npm run build
```

This runs:
```bash
node scripts/check-kernel-integrity.js && next build
```

Verifies:
- Kernel integrity (no corrupted core files)
- Next.js production build succeeds
- All pages can be statically analyzed
- No runtime errors during build

**Success criteria**: Build completes without errors

---

### 5. Quality Scan (Full Pipeline)

```bash
bash scripts/agent-verify.sh [module]
```

This is the complete 4-step validation:

#### Step 1: Business Logic Tests
- Runs `npm run test`
- Reports test results

#### Step 2: TypeScript Check
- Runs `npm run typecheck`
- Filters for `src/` errors only
- Reports file:line references

#### Step 3: Code Quality Scan
- Checks for `console.log` statements
- Checks for `debugger` statements
- Checks for `@ts-ignore` / `@ts-expect-error`
- Checks for `as any` type assertions
- Warns about hardcoded colors (non-theme variables)

#### Step 4: Build Verification
- Runs `npm run build`
- Verifies production build succeeds

**Success criteria**: All 4 steps pass

---

## Reporting Format

### On Success
```
✅ Module Verification: [MODULE] - PASSED

Summary:
- TypeScript: ✅ 0 errors
- Tests: ✅ 34/34 passed
- Build: ✅ Production build successful
- Quality: ✅ No issues found

Duration: 2m 15s
```

### On Failure
```
❌ Module Verification: [MODULE] - FAILED

Failures:

1. TypeScript Errors (3 found):
   - src/app/(privileged)/finance/invoices/page.tsx:42
     Property 'currencyCode' does not exist on type 'Invoice'

   - src/components/finance/InvoiceCard.tsx:18
     Type 'undefined' is not assignable to type 'string'

   - src/types/finance.ts:12
     Interface 'InvoiceProps' incorrectly extends 'BaseProps'

2. Tests Failed (2/34):
   - Tax calculation for inclusive tax - Expected 10.00, got 9.09
   - Currency conversion rounding - Expected 100.00, got 99.99

3. Code Quality Issues (5 found):
   - console.log found: src/lib/api/finance.ts:45
   - debugger found: src/components/pos/POSTerminal.tsx:123
   - Hardcoded color: src/app/(privileged)/sales/page.tsx:67 (#0a0f1e)
   - as any: src/hooks/useInvoice.ts:34
   - @ts-ignore: src/components/finance/TaxCalculator.tsx:89

Action Required: Fix all issues before deployment.
```

---

## Module-Specific Considerations

### Finance Module
- Extra attention to Decimal precision
- Verify currency conversion logic
- Check tax calculation accuracy
- Ensure journal entry balance

### POS Module
- Verify fullscreen layout (no responsive checks)
- Check offline functionality (IndexedDB)
- Test receipt generation
- Validate cash drawer calculations

### Inventory Module
- Verify stock calculation logic
- Check warehouse transfer flows
- Validate product variant handling
- Test barcode generation

### CRM Module
- Verify contact deduplication
- Check lead scoring logic
- Validate email template rendering
- Test opportunity pipeline calculations

### HR Module
- Verify payroll calculations
- Check attendance tracking
- Validate leave balance logic
- Test department hierarchy

---

## Integration with Git Workflow

Use this before commits:

```bash
# Before committing
/verify-module finance

# If passed, commit
git add .
git commit -m "feat(finance): add multi-currency support"

# Before pushing
/verify-module

# If all passed, push
git push origin feature/finance-multi-currency
```

---

## Exit Codes

- **0**: All checks passed
- **1**: TypeScript errors found
- **2**: Tests failed
- **3**: Build failed
- **4**: Quality issues found (warnings only)

---

## Related Commands

- `/preflight` - Research protocol before coding
- `/deploy-check` - Pre-deployment verification
- `/bug-hunt` - Debug failing tests
- `/audit-security` - Security-specific checks

---

**Remember**: Verification is not optional. It's the definition of "done".
