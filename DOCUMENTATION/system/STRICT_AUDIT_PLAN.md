# TSF PLATFORM | STRICT AUDIT PLAN & MODIFICATION PROTOCOL

## 🛑 1. THE ZERO-TRUST MODIFICATION PROTOCOL (MANDATORY APPROVAL)
**NEVER MODIFY ANY FILE MARKED AS "LOCKED", "FINALIZED", OR IN A "PRODUCTION READY" STATE WITHOUT EXPLICIT USER APPROVAL.**

Before editing any file that is explicitly or implicitly finalized, the Agent MUST:
1. Identify the file and state exactly what change is proposed and why.
2. Provide a diff or snippet of the exact change.
3. Stop and WAIT for the user to explicitly reply with "Approved", "Yes", or similar clear permission.
4. If a file contains `// STATUS: LOCKED`, `// FINALIZED`, or is part of a completed milestone, bypassing approval is a critical violation of system integrity.

---

## 🛡️ 2. THE TSF SYSTEM AUDIT PLAN
To prevent "stupid errors" (dead buttons, unlinked records, wrong data, isolation leaks) from reaching production, this 4-layer Audit Plan is mandatory before marking any feature as complete.

### LAYER A: "Dead Button" & Interaction Check (The Action Audit)
Every interactive element (Buttons, Checkboxes, Table Rows, Icons) MUST be actively verified:
- `onClick` Verification: Does this button have a functional `onClick` handler? If it's a placeholder (`() => console.log('todo')`), it FAILS the audit.
- Routing Verification: If it's a `<Link href="...">`, does the target route actually exist in the Next.js `app/` directory (e.g., `/purchases/[id]`)?
- Form Actions: Are form submissions actually calling `erpFetch` or a valid Server Action, and handling the `isLoading`/Error states correctly?

### LAYER B: "Ghost Data" Check (The Relational Audit)
Every list view and detail view MUST be verified for referential integrity:
- Broken Links: Are lists properly referencing their parent/child records? (e.g., A "List of purchases" must successfully click through to the *actual* purchase details using the correct ID, not a generic template or the wrong ID).
- Null Safety: Are foreign keys or optional fields crash-proofed? If a record (like a User or Category) is deleted or empty, the UI must render a fallback (`Unknown` or `N/A`) and not throw an "Unhandled Runtime Error".

### LAYER C: "Iron Wall" Check (The Tenant & Scope Isolation Audit)
Every endpoint and data-fetching component MUST be verified for security:
- Backend Enforcement: Is the QuerySet strictly filtered by `organization` AND `scope` (Internal/Official)? This should be automatically handled by `TenantModelViewSet`, but custom views must manually call `get_authorized_scope()`.
- Frontend Propagation: Is the component pulling the correct `tsf_view_scope` from context/cookies and passing it via the `X-Scope` header or query parameters (`erpFetch` handles this, but custom fetches must not bypass it).
- Cross-Tenant Block: Ensure a standard user cannot access administrative settings or cross-tenant data by simply manipulating the URL.

### LAYER D: "Data Accuracy & Math" Check (The Quality Audit)
- Type Safety: Are numeric fields (prices, quantities, discounts, tax rates) strictly typed, parsed, and validated?
- Math Integrity: Are calculations being done securely? (Avoid floating-point errors by using `Decimal` on the backend, and explicit BigInt/formatting libraries natively or safely on the frontend).
- Impossible States: Are "Wrong Data" scenarios (like negative quantities, negative prices, or `NaN` totals) explicitly caught or prevented by UI validation rules before hitting the backend?

By adhering to this Strict Audit Plan, we eliminate the silent failures, broken paths, and leaked data that cause critical friction in the TSF System.
