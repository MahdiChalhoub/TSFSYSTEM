/**
 * PO Intelligence Grid — Column Profile Persistence
 * ===================================================
 * Backend-first persistence via UserListPreference API.
 * localStorage serves as instant offline cache.
 *
 * Same philosophy as Products page profiles:
 *   LOAD:  Backend → merge into local profile → cache to localStorage
 *   SAVE:  localStorage (instant) + debounced backend write
 *
 * List key: 'purchases.po_grid'
 */
import type { ColumnKey } from './columns'
import { COLUMN_DEFS, DEFAULT_ORDER } from './columns'
import { getUserListPreference, saveUserListPreference } from '@/app/actions/list-preferences'
import type { ViewProfile } from '@/components/ui/CustomizePanel/types'
export type POViewProfile = ViewProfile<ColumnKey>

export const MAX_PROFILES = 5
const PROFILES_KEY = 'po_grid_view_profiles'
const ACTIVE_PROFILE_KEY = 'po_grid_active_profile'
const LIST_KEY = 'purchases.po_grid'

/** Default columns visibility map */
const DEFAULT_COLS = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, true])) as Record<ColumnKey, boolean>

/** Default column order */
const DEFAULT_COL_ORDER: ColumnKey[] = [...DEFAULT_ORDER]

// ═══════════════════════════════════════════════════════════
//  LOCAL STORAGE (instant cache layer)
// ═══════════════════════════════════════════════════════════

function migrateProfiles(profiles: POViewProfile[]): POViewProfile[] {
    let changed = false
    const migrated = profiles.map(p => {
        if (!p.columnOrder) {
            changed = true
            return { ...p, columnOrder: DEFAULT_COL_ORDER }
        }
        return p
    })
    if (changed && typeof window !== 'undefined') {
        try { localStorage.setItem(PROFILES_KEY, JSON.stringify(migrated)) } catch { /* noop */ }
    }
    return migrated
}

export function loadProfiles(): POViewProfile[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(PROFILES_KEY)
        if (raw) return migrateProfiles(JSON.parse(raw))
    } catch { /* noop */ }
    return [{
        id: 'default',
        name: 'Default',
        columns: DEFAULT_COLS,
        columnOrder: DEFAULT_COL_ORDER,
    }]
}

export function saveProfiles(profiles: POViewProfile[]) {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)) } catch { /* noop */ }
}

export function loadActiveProfileId(): string {
    if (typeof window === 'undefined') return 'default'
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || 'default'
}

export function saveActiveProfileId(id: string) {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(ACTIVE_PROFILE_KEY, id) } catch { /* noop */ }
}

// ═══════════════════════════════════════════════════════════
//  BACKEND SYNC (debounced write-through)
// ═══════════════════════════════════════════════════════════

let _syncTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Convert a POViewProfile to the backend's expected format:
 *   visible_columns = ordered list of VISIBLE column keys
 */
function profileToPayload(profile: POViewProfile) {
    const order = profile.columnOrder || DEFAULT_COL_ORDER
    const cols = profile.columns || DEFAULT_COLS
    const visibleOrdered = order.filter(key => !!cols[key])

    return {
        visible_columns: visibleOrdered,
        default_filters: {},
        page_size: 50,
    }
}

/**
 * Debounced sync: writes the active profile to the backend.
 * Called after every local change (column toggle, reorder, etc.)
 */
export function syncProfileToBackend(profile: POViewProfile) {
    if (typeof window === 'undefined') return
    if (_syncTimer) clearTimeout(_syncTimer)
    _syncTimer = setTimeout(async () => {
        try {
            const payload = profileToPayload(profile)
            await saveUserListPreference(LIST_KEY, payload)
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
    profiles: POViewProfile[],
    activeProfileId: string,
): Promise<{
    profiles: POViewProfile[]
    columns: Record<string, boolean>
    columnOrder: ColumnKey[]
} | null> {
    try {
        const backendPref = await getUserListPreference(LIST_KEY)
        if (!backendPref || backendPref.source === 'default') return null

        const visibleCols = backendPref.visible_columns || []
        if (visibleCols.length === 0) return null

        // Derive column visibility map from the ordered visible list
        const colVisibility: Record<string, boolean> = {}
        COLUMN_DEFS.forEach(col => {
            colVisibility[col.key] = visibleCols.includes(col.key)
        })

        // Derive column order: backend list order first, then remaining columns
        const backendOrder: ColumnKey[] = [...visibleCols as ColumnKey[]]
        COLUMN_DEFS.forEach(col => {
            if (!backendOrder.includes(col.key)) backendOrder.push(col.key)
        })

        // Update the active profile
        const updatedProfiles = profiles.map(p => {
            if (p.id === activeProfileId) {
                return { ...p, columns: colVisibility, columnOrder: backendOrder }
            }
            return p
        })

        // Cache locally
        saveProfiles(updatedProfiles)

        return {
            profiles: updatedProfiles,
            columns: colVisibility,
            columnOrder: backendOrder,
        }
    } catch {
        return null // Backend unavailable — use localStorage
    }
}
