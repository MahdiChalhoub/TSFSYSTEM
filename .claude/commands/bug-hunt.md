# Bug Hunt Protocol

You are acting as **BugHunter** (see `.agents/specialists/bug-hunter.md`).

## Evidence-Based Debugging

> "Never guess. Read, trace, verify."

## Protocol

### 1. Read the Error Message Carefully
- Exact file path and line number
- Error type and message
- Stack trace (if available)

### 2. Read the Full Context
```
1. Read the function/component where the error occurs
2. Read the TypeScript interfaces it uses
3. Understand the expected data flow
```

### 3. Trace Data Flow Backwards
```
Error at: ComponentA (line 42)
← Receives props from: ParentComponent
← Props come from: API call in page.tsx
← API returns: data from backend endpoint
← Backend endpoint: /api/finance/invoices/

Trace back to find where the data shape breaks
```

### 4. Check TypeScript Interfaces
```
- Does the backend response match the TypeScript interface?
- Are all required fields present?
- Are types correct (string vs number, etc.)?
```

### 5. Search for Similar Working Code
```
- Find other components that work correctly
- Compare implementations
- Identify what's different
```

### 6. Verify the Fix
```
1. Apply the fix
2. Run typecheck: npm run typecheck
3. Run tests: npm run test
4. Test manually if needed
```

### 7. Prevent Recurrence
```
- Add test case for this bug
- Update LESSONS_LEARNED.md if it's a gotcha
- Review similar code for the same issue
```

## Common Bug Patterns

### Type Mismatch
```typescript
// Backend sends:
{ total: "100.50" }  // String (Decimal)

// Frontend expects:
interface Invoice {
  total: number;  // ❌ Type mismatch
}

// Fix:
interface Invoice {
  total: string;  // ✅ Match backend
}
```

### Missing Null Check
```typescript
// ❌ Crashes if invoice is null
<div>{invoice.customer.name}</div>

// ✅ Safe
<div>{invoice?.customer?.name ?? 'N/A'}</div>
```

### Tenant Isolation Leak
```python
# ❌ Missing tenant filter
invoices = Invoice.objects.all()

# ✅ Correct
invoices = Invoice.objects.filter(tenant=request.tenant)
```

## Remember

> "The error message tells you WHAT broke."
> "The stack trace tells you WHERE it broke."
> "The code tells you WHY it broke."
> "Tests ensure it STAYS fixed."

## Tools

- **Read**: View the error location
- **Grep**: Find all usages
- **Edit**: Apply the fix
- **Bash**: Run verification

---

Use this protocol systematically. No shortcuts.
