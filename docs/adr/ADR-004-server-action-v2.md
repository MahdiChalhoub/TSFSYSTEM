# ADR-004: Server Action V2 Standardization

**Status**: Accepted
**Date**: 2026-03-01
**Decision Makers**: Core Architecture Team

## Context

The frontend uses Next.js Server Actions for all API communication. Early implementations had inconsistent error handling, mixed API path conventions, and no standardized return types.

## Decision

All server actions follow the **V2 pattern**:

```typescript
'use server'

export async function createVoucher(formData: FormData): Promise<ActionResult> {
  try {
    const data = await erpFetch('/api/finance/vouchers/', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
    })
    revalidateTag('finance')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

### Standards
- **`erpFetch`** for all privileged API calls (centralized auth + base URL)
- **`portalFetch`** for supplier portal API calls (token-based auth)
- **`ActionResult`** return type with `success` boolean
- **`revalidateTag`** for cache invalidation after mutations
- **Server-side only** — `'use server'` directive mandatory

## Rationale

- **Type safety** — consistent `ActionResult<T>` across all actions
- **Auth centralization** — `erpFetch` handles cookie-based auth automatically
- **Cache management** — `revalidateTag` ensures UI reflects mutations immediately
- **Error isolation** — server errors never crash the client; always return `ActionResult`

## Consequences

- **Positive**: Standardized across 200+ pages; predictable error handling
- **Negative**: Requires discipline to avoid raw `fetch()` in server actions (fitness check #3)
- **Enforcement**: Fitness check #3 (frontend API discipline), #13 (portal fetch discipline)
