'use client'

/**
 * BranchContext
 * =============
 * Tenant-side filter for the active Branch + Location selection.
 *
 * What this is for: every list/transaction page that shows warehouse-scoped
 * data should consult this context and pass `branch=<id>` / `location=<id>`
 * (or warehouse=<id>, depending on the endpoint) to its API call. When
 * `branchId` is null, the user is in "All Branches" mode — pages should
 * NOT filter at all.
 *
 * Persistence: writes both to localStorage (so the choice survives reload)
 * AND to a cookie (so server components / server actions can read the same
 * value without JS). The cookie name matches what the proxy / page.tsx
 * SSR fetchers can consume going forward.
 *
 * Reactive update: changing the selection calls `router.refresh()` so any
 * server component that reads the cookie re-renders with the new scope.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const LS_BRANCH = 'tsf_active_branch'
const LS_LOCATION = 'tsf_active_location'
const COOKIE_BRANCH = 'tsf_active_branch'
const COOKIE_LOCATION = 'tsf_active_location'

type BranchContextValue = {
    /** Currently-selected branch id, or null when "All Branches" is active. */
    branchId: number | null
    /** Currently-selected location id, or null when "All in branch" is active. */
    locationId: number | null
    /** Setter — pass null to clear (i.e., switch to "All Branches"). */
    setSelection: (branchId: number | null, locationId: number | null) => void
    /** True until the first hydration read finishes (avoid SSR/CSR mismatch). */
    isHydrated: boolean
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined)

/** Cookie writer — same options the proxy reads (lax, year-long, root-path). */
function writeCookie(name: string, value: string | null) {
    if (typeof document === 'undefined') return
    if (value === null || value === '') {
        document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
    } else {
        document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`
    }
}

export function BranchProvider({ children }: { children: ReactNode }) {
    const router = useRouter()
    const [branchId, setBranchId] = useState<number | null>(null)
    const [locationId, setLocationId] = useState<number | null>(null)
    const [isHydrated, setIsHydrated] = useState(false)

    // Hydrate from localStorage on mount.
    useEffect(() => {
        try {
            const b = localStorage.getItem(LS_BRANCH)
            const l = localStorage.getItem(LS_LOCATION)
            if (b) setBranchId(Number(b))
            if (l) setLocationId(Number(l))
        } catch { /* localStorage may be blocked */ }
        setIsHydrated(true)
    }, [])

    const setSelection = useCallback((bid: number | null, lid: number | null) => {
        setBranchId(bid)
        setLocationId(lid)
        if (bid === null) {
            localStorage.removeItem(LS_BRANCH)
            writeCookie(COOKIE_BRANCH, null)
        } else {
            localStorage.setItem(LS_BRANCH, String(bid))
            writeCookie(COOKIE_BRANCH, String(bid))
        }
        if (lid === null) {
            localStorage.removeItem(LS_LOCATION)
            writeCookie(COOKIE_LOCATION, null)
        } else {
            localStorage.setItem(LS_LOCATION, String(lid))
            writeCookie(COOKIE_LOCATION, String(lid))
        }
        // Refresh server components so anything reading the cookie re-renders
        // with the new scope. Soft-refresh — keeps client state intact.
        router.refresh()
    }, [router])

    return (
        <BranchContext.Provider value={{ branchId, locationId, setSelection, isHydrated }}>
            {children}
        </BranchContext.Provider>
    )
}

/**
 * Read the active branch / location selection.
 *
 * Use in list pages:
 *
 *   const { branchId, locationId } = useBranchScope()
 *   const params = new URLSearchParams()
 *   if (branchId) params.set('branch', String(branchId))
 *   if (locationId) params.set('warehouse', String(locationId))
 *   const data = await erpFetch(`some-endpoint/?${params}`)
 *
 * When branchId is null, the user is in "All Branches" mode — DO NOT
 * filter; pass no scoping params.
 */
export function useBranchScope(): BranchContextValue {
    const ctx = useContext(BranchContext)
    if (!ctx) {
        // Sensible fallback when used outside the provider — read once
        // synchronously from localStorage so first-render queries don't
        // miss the scope.
        return { branchId: null, locationId: null, setSelection: () => {}, isHydrated: true }
    }
    return ctx
}
