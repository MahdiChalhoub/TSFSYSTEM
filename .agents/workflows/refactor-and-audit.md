---
description: How to refactor pages and enforce the Strict Audit Plan
---

# Page Refactoring & Audit Workflow

## 1. Analyze the Existing Page
Before making any changes to a page, identify its current state:
- Is the file too large (e.g., > 300 lines)?
- Are there inline components that should be extracted?
- Does it contain hardcoded fetch logic that should be in an action?

## 2. Component Extraction Protocol
If the file is too large, break it down using the following hierarchy:
- `Page.tsx`: Should ONLY contain Server Component logic (fetching data, context) and import Client Components.
- `PageClient.tsx`: The main interactive Client Component.
- `SubComponents/`: Extract complex modals, forms, or tables into their own files.

## 3. Enforce the Strict Audit Plan
While refactoring, you MUST apply the 4-layer audit:

### LAYER A: Action Check
- Verify every `onClick` and `href`.
- Do not allow placeholder functions like `() => console.log('todo')`.
- Use strictly typed Next.js `<Link>` tags instead of raw HTML anchor tags.

### LAYER B: Relational Check
- Ensure lists correctly pass their IDs to detail views.
- Ensure all API fetching includes safe fallbacks for missing foreign keys (e.g., `user.name || 'Unknown'`).

### LAYER C: Isolation Check
- Server Components MUST pass the `X-Scope` header or include it in their `erpFetch` calls if required.
- Client Components must be wrapped safely to prevent cross-tenant layout shifts.

### LAYER D: Data & Math Check
- Ensure all currency values use the correct `parseFloat().toLocaleString()` format.
- Ensure dates are properly parsed before being rendered.

## 4. Final Approval
If the file being refactored was marked as `// STATUS: LOCKED` or `// FINALIZED`, you MUST ask the user for permission before applying the split/refactor. Provide a clear explanation of which components will be created.
