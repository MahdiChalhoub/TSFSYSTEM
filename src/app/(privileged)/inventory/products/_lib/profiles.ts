/**
 * Product Manager — View Profile Persistence
 * =============================================
 * Backend-first persistence via UserListPreference API.
 * localStorage serves as instant offline cache.
 *
 * Backend stores: visible_columns (ordered list of visible column keys)
 * Frontend stores: columns (visibility map), columnOrder (ordering), filters (visibility map)
 *
 * Sync strategy:
 *   LOAD:  Backend → merge into local profile → cache to localStorage
 *   SAVE:  localStorage (instant) + debounced backend write
 */
import type { ViewProfile } from './types'
import { ALL_COLUMNS, ALL_FILTERS, DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS } from './constants'
import { getUserListPreference, saveUserListPreference } from '@/app/actions/list-preferences'

export const MAX_PROFILES = 10
const PROFILES_KEY = 'pm_view_profiles'
const ACTIVE_PROFILE_KEY = 'pm_active_profile'
const LIST_KEY = 'inventory.products'

/** Default column order — all column keys in their default position */
const DEFAULT_COLUMN_ORDER = ALL_COLUMNS.map(c => c.key)

// ═══════════════════════════════════════════════════════════
//  LOCAL STORAGE (instant cache layer)
// ═══════════════════════════════════════════════════════════

/** Migrate old profiles: backfill any missing fields */
function migrateProfiles(profiles: ViewProfile[]): ViewProfile[] {
  let changed = false
  const migrated = profiles.map(p => {
    if (!p.columnOrder) {
      changed = true
      return { ...p, columnOrder: DEFAULT_COLUMN_ORDER }
    }
    return p
  })
  if (changed && typeof window !== 'undefined') {
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(migrated)) } catch { /* noop */ }
  }
  return migrated
}

export function loadProfiles(): ViewProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (raw) return migrateProfiles(JSON.parse(raw))
  } catch { /* noop */ }
  return [{ id: 'default', name: 'Default', columns: DEFAULT_VISIBLE_COLS, filters: DEFAULT_VISIBLE_FILTERS, columnOrder: DEFAULT_COLUMN_ORDER }]
}

export function saveProfiles(profiles: ViewProfile[]) {
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
 * Convert a ViewProfile to the backend's expected format:
 *   visible_columns = ordered list of VISIBLE column keys
 *   default_filters = map of visible filter keys → true
 */
function profileToPayload(profile: ViewProfile) {
  // Build ordered visible columns: respect columnOrder, include only visible ones
  const order = profile.columnOrder || DEFAULT_COLUMN_ORDER
  const cols = profile.columns || DEFAULT_VISIBLE_COLS
  const visibleOrdered = order.filter(key => {
    const colDef = ALL_COLUMNS.find(c => c.key === key)
    if (!colDef) return false
    return colDef.defaultVisible ? cols[key] !== false : !!cols[key]
  })

  // Visible filters as a map
  const filters = profile.filters || DEFAULT_VISIBLE_FILTERS
  const activeFilters: Record<string, boolean> = {}
  ALL_FILTERS.forEach(f => {
    if (filters[f.key]) activeFilters[f.key] = true
  })

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
export function syncProfileToBackend(profile: ViewProfile) {
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
 * Returns updated profiles array or null if backend had nothing.
 */
export async function loadProfileFromBackend(
  profiles: ViewProfile[],
  activeProfileId: string,
): Promise<{
  profiles: ViewProfile[]
  columns: Record<string, boolean>
  filters: Record<string, boolean>
  columnOrder: string[]
} | null> {
  try {
    const backendPref = await getUserListPreference(LIST_KEY)
    if (!backendPref || backendPref.source === 'default') return null

    // Backend has saved preferences — merge into the active profile
    const visibleCols = backendPref.visible_columns || []
    if (visibleCols.length === 0) return null

    // Derive column visibility map from the ordered visible list
    const colVisibility: Record<string, boolean> = {}
    ALL_COLUMNS.forEach(col => {
      colVisibility[col.key] = visibleCols.includes(col.key)
    })

    // Derive column order: backend list order first, then remaining columns
    const backendOrder = [...visibleCols]
    ALL_COLUMNS.forEach(col => {
      if (!backendOrder.includes(col.key)) backendOrder.push(col.key)
    })

    // Derive filter visibility
    const filterVisibility: Record<string, boolean> = {}
    const savedFilters = backendPref.default_filters || {}
    ALL_FILTERS.forEach(f => {
      filterVisibility[f.key] = !!savedFilters[f.key]
    })

    // Update the active profile
    const updatedProfiles = profiles.map(p => {
      if (p.id === activeProfileId) {
        return {
          ...p,
          columns: colVisibility,
          filters: filterVisibility,
          columnOrder: backendOrder,
        }
      }
      return p
    })

    // Cache locally
    saveProfiles(updatedProfiles)

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
