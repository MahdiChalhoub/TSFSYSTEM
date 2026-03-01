---
description: How to refactor pages and enforce the Strict Audit Plan
---

# Page Refactoring & Audit Workflow

## 0. Pre-Refactoring Research (MANDATORY — DO THIS FIRST)

Before making ANY changes:

1. **Read the full file** — understand the component's structure, state, and props.
2. **Read the TypeScript interface** — know what types the component expects.
3. **Identify ALL consumers and providers**:
   - Who provides data to this component? (parent, context, hook?)
   - Who consumes data from this component? (children, callbacks?)
4. **Map the prop chain**: e.g., `usePOSTerminal → TerminalContext → useTerminal → Layout`
5. **Search for sibling components** that use the same interface — they must ALSO be updated.

### 🚨 Critical Rule
> If you modify a shared hook or context, you MUST check ALL components that consume it.
> Use: `grep -r "useTerminal\|usePOSTerminal" src/ --include="*.tsx"`

---

## 1. Analyze the Existing Page
Before making any changes, identify its current state:
- Is the file too large (e.g., > 300 lines)?
- Are there inline components that should be extracted?
- Does it contain hardcoded fetch logic that should be in an action?
- Are there TypeScript errors? (Run `tsc --noEmit` filtered for this file)

## 2. Component Extraction Protocol
If the file is too large, break it down:
- `Page.tsx`: Server Component (data fetching, context). Minimal logic.
- `PageClient.tsx`: Main interactive Client Component.
- `SubComponents/`: Extract modals, forms, or tables into their own files.

## 3. Enforce the Strict Audit Plan
While refactoring, apply the 4-layer audit:

### LAYER A: Action Check
- Verify every `onClick` and `href`.
- Do not allow placeholder functions like `() => console.log('todo')`.
- Use strictly typed Next.js `<Link>` tags instead of raw HTML anchor tags.
- **NEW**: Verify function signatures match click handler expectations:
  - `onClick={fn}` requires `fn(e: MouseEvent)` or `fn()` with no args
  - If `fn(skipWarning?: boolean)`, wrap: `onClick={() => fn()}`

### LAYER B: Relational Check
- Ensure lists correctly pass their IDs to detail views.
- Ensure all API fetching includes safe fallbacks for missing foreign keys.
- **NEW**: Verify ID types match across the chain (string vs number).

### LAYER C: Isolation Check
- Server Components MUST include `X-Scope` header in `erpFetch` calls if required.
- Client Components must be wrapped safely to prevent cross-tenant layout shifts.
- **NEW**: Verify hook return types match component prop typed.

### LAYER D: Data & Math Check
- Ensure all currency values use correct formatting.
- Ensure dates are properly parsed before rendering.
- **NEW**: Ensure nullable values are handled in JSX:
  - `value={field || ''}` for selects
  - `{field ?? 'Default'}` for display

## 4. Post-Refactoring Verification (MANDATORY)
After all changes:
```bash
# Check for type errors in the refactored files
npx tsc --noEmit 2>&1 | grep "ComponentName"

# Verify build succeeds
npx next build
```

## 5. Final Approval
If the file was marked `// STATUS: LOCKED` or `// FINALIZED`, you MUST ask the user for permission before applying the refactor.
