/**
 * Ledger Profiles
 * =================
 * localStorage persistence for view profiles.
 */

import type { ViewProfile } from './types'
import { DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS } from './constants'

export const MAX_PROFILES = 10
const PROFILES_KEY = 'ledger_view_profiles'
const ACTIVE_PROFILE_KEY = 'ledger_active_profile'

export function loadProfiles(): ViewProfile[] {
  if (typeof window === 'undefined') return []
  try { const raw = localStorage.getItem(PROFILES_KEY); if (raw) return JSON.parse(raw) } catch { }
  return [{ id: 'default', name: 'Default', columns: DEFAULT_VISIBLE_COLS, filters: DEFAULT_VISIBLE_FILTERS }]
}

export function saveProfiles(p: ViewProfile[]) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(p)) } catch { }
}

export function loadActiveProfileId(): string {
  return (typeof window !== 'undefined' && localStorage.getItem(ACTIVE_PROFILE_KEY)) || 'default'
}

export function saveActiveProfileId(id: string) {
  try { localStorage.setItem(ACTIVE_PROFILE_KEY, id) } catch { }
}
