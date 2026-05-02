'use server'

/**
 * User List Preferences — Server Actions
 * ========================================
 * CRUD for per-user, per-org list view preferences.
 * Backend endpoint: /api/list-preferences/<list_key>/
 *
 * The backend stores:
 *   - visible_columns: string[]  (ordered list → order = column order, presence = visibility)
 *   - default_filters: Record<string, any>
 *   - page_size: number
 *   - sort_column: string
 *   - sort_direction: 'asc' | 'desc'
 *   - view_profiles: DajingoViewProfile[]  (multi-profile data)
 *   - active_profile_id: string
 */

import { erpFetch, handleAuthError } from '@/lib/erp-api'

export interface ListPreferencePayload {
  visible_columns?: string[]
  default_filters?: Record<string, unknown>
  page_size?: number
  sort_column?: string
  sort_direction?: 'asc' | 'desc'
  view_profiles?: any[]
  active_profile_id?: string
}

export interface ListPreferenceResponse extends ListPreferencePayload {
  source: 'user' | 'organization' | 'default'
  list_key: string
}

/**
 * Load user's saved list preference for a specific view.
 * Falls back: user → org default → empty default.
 */
export async function getUserListPreference(listKey: string): Promise<ListPreferenceResponse | null> {
  try {
    const res = await erpFetch(`list-preferences/${listKey}/`)
    return res ?? null
  } catch (error) {
    handleAuthError(error)
    return null
  }
}

/**
 * Save user's list preference for a specific view.
 * Uses PUT → upsert (create or update).
 */
export async function saveUserListPreference(listKey: string, data: ListPreferencePayload): Promise<boolean> {
  try {
    await erpFetch(`list-preferences/${listKey}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return true
  } catch {
    return false
  }
}

/**
 * Load organization-wide default for a specific view.
 */
export async function getOrgListDefault(listKey: string): Promise<ListPreferenceResponse | null> {
  try {
    const res = await erpFetch(`list-preferences/org-default/${listKey}/`)
    return res ?? null
  } catch (error) {
    handleAuthError(error)
    return null
  }
}

/**
 * Save organization-wide default for a specific view.
 * Only staff/superusers can perform this action.
 */
export async function saveOrgListDefault(listKey: string, data: ListPreferencePayload): Promise<boolean> {
  try {
    await erpFetch(`list-preferences/org-default/${listKey}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return true
  } catch {
    return false
  }
}
