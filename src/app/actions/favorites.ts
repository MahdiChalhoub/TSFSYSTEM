'use server'

/**
 * User Favorites — Server Actions
 * =================================
 * Persists the user's favorited sidebar pages per-user, per-org in the
 * backend (list-preferences endpoint — reuses the existing Django model).
 *
 * Stored at: /api/list-preferences/user_quick_favorites/
 * Field used: default_filters.favorites  → FavoriteEntry[]
 *
 * Priority: backend (cross-device) → localStorage cache (instant display)
 */

import { erpFetch, handleAuthError } from '@/lib/erp-api'

const FAVORITES_PREF_KEY = 'user_quick_favorites'

export interface FavoriteEntry {
    title: string
    path: string
}

/**
 * Fetch the user's favorites from the backend.
 * Returns [] if not set or on any error (graceful fallback to localStorage).
 */
export async function getFavorites(): Promise<FavoriteEntry[]> {
    try {
        const res = await erpFetch(`list-preferences/${FAVORITES_PREF_KEY}/`, {
            cache: 'no-store',
        })
        const favs = res?.default_filters?.favorites
        return Array.isArray(favs) ? favs : []
    } catch (error) {
        handleAuthError(error)
        return []
    }
}

/**
 * Save the full favorites list to the backend.
 * Called after every add/remove. Fire-and-forget from the client.
 */
export async function saveFavorites(favorites: FavoriteEntry[]): Promise<boolean> {
    try {
        await erpFetch(`list-preferences/${FAVORITES_PREF_KEY}/`, {
            method: 'PUT',
            body: JSON.stringify({
                visible_columns: [],
                default_filters: { favorites },
            }),
        })
        return true
    } catch {
        return false
    }
}
