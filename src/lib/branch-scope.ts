/**
 * Branch scope helpers — share one mental model between client and server.
 *
 * - Client-side React: import `useBranchScope` from '@/context/BranchContext'
 * - Server actions / SSR: call `getBranchScope()` here (reads the cookie)
 * - Both sides: call `applyBranchScope(params)` to add the right query
 *   parameters to a URLSearchParams before hitting the backend.
 *
 * "All Branches" = both ids null → no scoping params added.
 */

const COOKIE_BRANCH = 'tsf_active_branch'
const COOKIE_LOCATION = 'tsf_active_location'

export type BranchScope = {
    branchId: number | null
    locationId: number | null
}

/** Server-side reader (works in server actions + RSC). */
export async function getBranchScope(): Promise<BranchScope> {
    const { cookies } = await import('next/headers')
    const store = await cookies()
    const b = store.get(COOKIE_BRANCH)?.value
    const l = store.get(COOKIE_LOCATION)?.value
    return {
        branchId: b ? Number(b) || null : null,
        locationId: l ? Number(l) || null : null,
    }
}

/**
 * Mutate the URLSearchParams in-place to add the active scope, if any.
 * - Adds `branch=<id>` when a branch is selected
 * - Adds `warehouse=<id>` when a specific location is selected
 *   (location IDs are warehouse PKs, so backend filters that already
 *   accept `warehouse=` work without backend changes)
 *
 * Returns the same params object for chaining.
 */
export function applyBranchScope(params: URLSearchParams, scope: BranchScope): URLSearchParams {
    if (scope.branchId != null) params.set('branch', String(scope.branchId))
    if (scope.locationId != null) params.set('warehouse', String(scope.locationId))
    return params
}

/** Convenience: build a query string from scope alone (client-side fetches). */
export function branchScopeQuery(scope: BranchScope): string {
    const p = new URLSearchParams()
    applyBranchScope(p, scope)
    const s = p.toString()
    return s ? `?${s}` : ''
}
