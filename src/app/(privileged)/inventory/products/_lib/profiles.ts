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
 * Debounced sync: writes all non-shared profiles to the user's preference.
 */
export function syncProfileToBackend(profile: ViewProfile) {
  if (typeof window === 'undefined') return
  // Find current profiles from localStorage to ensure we save the full set
  const profiles = loadProfiles()
  
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(async () => {
    try {
      // User only saves their private profiles.
      // Backend merges them with shared ones on GET.
      const privateProfiles = profiles.filter(p => !p.is_shared)
      
      const payload = {
          ...profileToPayload(profile),
          view_profiles: privateProfiles,
          active_profile_id: profile.is_shared ? undefined : profile.id
      }
      await saveUserListPreference(LIST_KEY, payload)
    } catch {
      // Silent fail — localStorage is the fallback
    }
  }, 800)
}

/**
 * Promote or demote a profile to "shared" (organization-wide) status.
 */
export async function shareProfile(profiles: ViewProfile[], id: string, shared: boolean): Promise<ViewProfile[]> {
    const { getOrgListDefault, saveOrgListDefault } = await import('@/app/actions/list-preferences')
    
    // 1. Get current org defaults
    const orgDefaults = await getOrgListDefault(LIST_KEY)
    const orgProfiles: ViewProfile[] = orgDefaults?.view_profiles || []
    
    // 2. Find the profile to share
    const profile = profiles.find(p => p.id === id)
    if (!profile) return profiles

    let nextOrgProfiles = [...orgProfiles]
    if (shared) {
        // Add to org profiles if not already there
        if (!nextOrgProfiles.find(p => p.id === id)) {
            nextOrgProfiles.push({ ...profile, is_shared: true })
        }
    } else {
        // Remove from org profiles
        nextOrgProfiles = nextOrgProfiles.filter(p => p.id !== id)
    }

    // 3. Save to backend
    await saveOrgListDefault(LIST_KEY, {
        view_profiles: nextOrgProfiles
    })

    // 4. Update local state: shared profiles are marked as such
    const updated = profiles.map(p => {
        if (p.id === id) return { ...p, is_shared: shared }
        return p
    })
    
    // Also merge in any other org profiles we just fetched to keep in sync
    nextOrgProfiles.forEach(op => {
        if (!updated.find(u => u.id === op.id)) {
            updated.push(op)
        }
    })

    saveProfiles(updated)
    return updated
}

/**
 * Load from backend and merge into the active local profile.
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
    if (!backendPref) return null

    // Backend returns merged profiles (private + shared)
    const backendProfiles = (backendPref.view_profiles || []) as ViewProfile[]
    
    if (backendProfiles.length === 0) {
        // Fallback for legacy "single profile" users
        const visibleCols = backendPref.visible_columns || []
        if (visibleCols.length === 0) return null
        return null // Skip complex merge for now if no profiles
    }

    // Determine the "real" active profile: backend's recommendation or current local
    const finalActiveId = backendPref.active_profile_id || activeProfileId
    const activeProfile = backendProfiles.find(p => p.id === finalActiveId) || backendProfiles[0]

    // Cache locally
    saveProfiles(backendProfiles)
    saveActiveProfileId(activeProfile.id)

    return {
      profiles: backendProfiles,
      columns: activeProfile.columns,
      filters: activeProfile.filters,
      columnOrder: activeProfile.columnOrder || DEFAULT_COLUMN_ORDER,
    }
  } catch {
    return null
  }
}
