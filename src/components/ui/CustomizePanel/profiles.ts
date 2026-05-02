/**
 * Shared Customize Panel — Profile Persistence
 * ===============================================
 * Backend-first persistence via UserListPreference API.
 * localStorage serves as instant offline cache.
 *
 * Sync strategy:
 *   LOAD:  Backend → merge into local profile → cache to localStorage
 *   SAVE:  localStorage (instant) + debounced backend write
 *
 * This is a SHARED utility — every page passes its own `listKey`
 * (e.g. 'inventory.products', 'purchases.po_grid') to isolate data.
 */
import type { ViewProfile, ColumnDef, FilterDef } from './types'
import { getUserListPreference, saveUserListPreference } from '@/app/actions/list-preferences'

export const MAX_PROFILES = 10

/* ═══════════════════════════════════════════════════════════
 *  LOCAL STORAGE (instant cache layer)
 *  Keys are scoped by `storagePrefix` so different pages don't clash.
 * ═══════════════════════════════════════════════════════════ */

export function loadProfiles(storagePrefix: string, defaultProfile: ViewProfile): ViewProfile[] {
    if (typeof window === 'undefined') return [defaultProfile]
    try {
        const raw = localStorage.getItem(`${storagePrefix}_profiles`)
        if (raw) {
            const parsed = JSON.parse(raw) as ViewProfile[]
            // Backfill columnOrder for old profiles
            return parsed.map(p => ({
                ...p,
                columnOrder: p.columnOrder || defaultProfile.columnOrder,
            }))
        }
    } catch { /* noop */ }
    return [defaultProfile]
}

export function saveProfiles(storagePrefix: string, profiles: ViewProfile[]) {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(`${storagePrefix}_profiles`, JSON.stringify(profiles)) } catch { /* noop */ }
}

export function loadActiveProfileId(storagePrefix: string): string {
    if (typeof window === 'undefined') return 'default'
    return localStorage.getItem(`${storagePrefix}_active`) || 'default'
}

export function saveActiveProfileId(storagePrefix: string, id: string) {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(`${storagePrefix}_active`, id) } catch { /* noop */ }
}

/* ═══════════════════════════════════════════════════════════
 *  BACKEND SYNC (debounced write-through)
 * ═══════════════════════════════════════════════════════════ */

const _syncTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function profileToPayload(
    profile: ViewProfile,
    allColumns: ColumnDef[],
    allFilters?: FilterDef[],
) {
    const order = profile.columnOrder || allColumns.map(c => c.key)
    const cols = profile.columns || {}
    const visibleOrdered = order.filter(key => {
        const colDef = allColumns.find(c => c.key === key)
        if (!colDef) return false
        return colDef.defaultVisible ? cols[key] !== false : !!cols[key]
    })

    const activeFilters: Record<string, boolean> = {}
    if (allFilters && profile.filters) {
        allFilters.forEach(f => {
            if (profile.filters?.[f.key]) activeFilters[f.key] = true
        })
    }

    return {
        visible_columns: visibleOrdered,
        default_filters: activeFilters,
        page_size: 50,
    }
}

/**
 * Debounced sync: writes the active profile to the backend.
 * Called after every local change (column toggle, reorder, etc.)
 */
export function syncProfileToBackend(
    listKey: string,
    profile: ViewProfile,
    allColumns: ColumnDef[],
    allFilters?: FilterDef[],
) {
    if (typeof window === 'undefined') return
    if (_syncTimers[listKey]) clearTimeout(_syncTimers[listKey])
    _syncTimers[listKey] = setTimeout(async () => {
        try {
            const payload = profileToPayload(profile, allColumns, allFilters)
            await saveUserListPreference(listKey, payload)
        } catch {
            // Silent fail — localStorage is the fallback
        }
    }, 800) // 800ms debounce
}

/**
 * Load from backend and merge into the active local profile.
 * Called once on page mount.
 */
export async function loadProfileFromBackend(
    listKey: string,
    profiles: ViewProfile[],
    activeProfileId: string,
    allColumns: ColumnDef[],
    allFilters?: FilterDef[],
): Promise<{
    profiles: ViewProfile[]
    columns: Record<string, boolean>
    filters?: Record<string, boolean>
    columnOrder: string[]
} | null> {
    try {
        const backendPref = await getUserListPreference(listKey)
        if (!backendPref || backendPref.source === 'default') return null

        const visibleCols = backendPref.visible_columns || []
        if (visibleCols.length === 0) return null

        // Derive column visibility map
        const colVisibility: Record<string, boolean> = {}
        allColumns.forEach(col => {
            colVisibility[col.key] = visibleCols.includes(col.key)
        })

        // Derive column order
        const backendOrder = [...visibleCols]
        allColumns.forEach(col => {
            if (!backendOrder.includes(col.key)) backendOrder.push(col.key)
        })

        // Derive filter visibility
        let filterVisibility: Record<string, boolean> | undefined
        if (allFilters) {
            filterVisibility = {}
            const savedFilters = backendPref.default_filters || {}
            allFilters.forEach(f => {
                filterVisibility![f.key] = !!(savedFilters as Record<string, boolean>)[f.key]
            })
        }

        // Update the active profile
        const updatedProfiles = profiles.map(p => {
            if (p.id === activeProfileId) {
                return {
                    ...p,
                    columns: colVisibility,
                    ...(filterVisibility ? { filters: filterVisibility } : {}),
                    columnOrder: backendOrder,
                }
            }
            return p
        })

        return {
            profiles: updatedProfiles,
            columns: colVisibility,
            filters: filterVisibility,
            columnOrder: backendOrder,
        }
    } catch {
        return null // Backend unavailable — use localStorage
    }
}
