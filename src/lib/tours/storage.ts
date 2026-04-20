/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — Platform Tour Engine — Storage
 *
 *  Hybrid persistence:
 *   • Primary: per-user backend (/api/user-tours/) — survives device
 *     switches, incognito, cookie clears.
 *   • Cache: localStorage — fast sync reads, keeps working offline,
 *     fallback when user is anonymous (login page, public routes).
 *
 *  Writes go to both layers. Reads return the localStorage cache; the
 *  TourProvider hydrates the cache from the backend on mount so the
 *  cache reflects per-user state within ~1 round trip after login.
 * ═══════════════════════════════════════════════════════════ */

import type { TourStatus } from './types'

const STORAGE_PREFIX = 'tsf-tour-'

/** Backend endpoint. Uses the Next.js proxy so httpOnly auth cookies are
 *  injected server-side — the client can't read them directly. */
const API_ENDPOINT = '/api/proxy/user-tours/'

/** Get the completion status of a tour (from localStorage cache) */
export function getTourStatus(tourId: string): TourStatus {
    if (typeof window === 'undefined') return { completed: false }
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${tourId}`)
        if (!raw) return { completed: false }
        return JSON.parse(raw) as TourStatus
    } catch {
        return { completed: false }
    }
}

/** Internal: write a status to localStorage cache. */
function writeLocalStatus(tourId: string, status: TourStatus): void {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${tourId}`, JSON.stringify(status))
    } catch {
        /* quota / private-mode — non-fatal */
    }
}

/** Mark a tour as completed. Writes to localStorage AND fires a
 *  fire-and-forget POST to the backend so it persists per-user. */
export function markTourCompleted(tourId: string, version: number): void {
    if (typeof window === 'undefined') return
    const status: TourStatus = {
        completed: true,
        completedAt: new Date().toISOString(),
        completedVersion: version,
    }
    writeLocalStatus(tourId, status)
    // Fire-and-forget — anonymous users (401) just silently stay on
    // localStorage-only behaviour.
    fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour_id: tourId, version }),
        credentials: 'include',
    }).catch(() => { /* offline / anonymous — cache-only is fine */ })
}

/** Reset a specific tour so it shows again */
export function resetTourStatus(tourId: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(`${STORAGE_PREFIX}${tourId}`)
    fetch(`${API_ENDPOINT}${encodeURIComponent(tourId)}/`, {
        method: 'DELETE',
        credentials: 'include',
    }).catch(() => { /* offline / anonymous */ })
}

/** Reset all tours */
export function resetAllTourStatuses(): void {
    if (typeof window === 'undefined') return
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
    keys.forEach(k => localStorage.removeItem(k))
    fetch(API_ENDPOINT, {
        method: 'DELETE',
        credentials: 'include',
    }).catch(() => { /* offline / anonymous */ })
}

/** Check if a tour should auto-start (not completed, or version changed) */
export function shouldAutoStart(tourId: string, version: number): boolean {
    const status = getTourStatus(tourId)
    if (!status.completed) return true
    if (status.completedVersion !== undefined && status.completedVersion < version) return true
    return false
}

/** Hydrate the localStorage cache from the backend. Called once per
 *  mount from TourProvider; silently no-ops for anonymous users. */
export async function hydrateTourStatusesFromBackend(): Promise<void> {
    if (typeof window === 'undefined') return
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
        })
        if (!res.ok) return  // 401/403 — anonymous user, stay on localStorage
        const data = await res.json() as { completions: Array<{
            tour_id: string; completed_version: number; completed_at: string | null
        }> }
        for (const c of data.completions || []) {
            writeLocalStatus(c.tour_id, {
                completed: true,
                completedAt: c.completed_at || undefined,
                completedVersion: c.completed_version,
            })
        }
    } catch {
        /* network error — stay on cache */
    }
}
