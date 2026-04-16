/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — Platform Tour Engine — Storage
 *  LocalStorage persistence for tour completion state.
 * ═══════════════════════════════════════════════════════════ */

import type { TourStatus } from './types'

const STORAGE_PREFIX = 'tsf-tour-'

/** Get the completion status of a tour */
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

/** Mark a tour as completed */
export function markTourCompleted(tourId: string, version: number): void {
    if (typeof window === 'undefined') return
    const status: TourStatus = {
        completed: true,
        completedAt: new Date().toISOString(),
        completedVersion: version,
    }
    localStorage.setItem(`${STORAGE_PREFIX}${tourId}`, JSON.stringify(status))
}

/** Reset a specific tour so it shows again */
export function resetTourStatus(tourId: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(`${STORAGE_PREFIX}${tourId}`)
}

/** Reset all tours */
export function resetAllTourStatuses(): void {
    if (typeof window === 'undefined') return
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
    keys.forEach(k => localStorage.removeItem(k))
}

/** Check if a tour should auto-start (not completed, or version changed) */
export function shouldAutoStart(tourId: string, version: number): boolean {
    const status = getTourStatus(tourId)
    if (!status.completed) return true
    if (status.completedVersion !== undefined && status.completedVersion < version) return true
    return false
}
