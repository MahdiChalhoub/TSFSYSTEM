'use client'

/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — Platform Tour Engine — Context + Provider
 *  Wraps the application to provide global tour state.
 *  Mount in the privileged layout so all ERP pages have access.
 * ═══════════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { TourState, TourConfig } from './types'
import { getAllTours, getToursByModule } from './registry'
import { getTourStatus, markTourCompleted, resetTourStatus, resetAllTourStatuses } from './storage'

const TourContext = createContext<TourState | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
    const [activeTourId, setActiveTourId] = useState<string | null>(null)

    const startTour = useCallback((tourId: string) => {
        setActiveTourId(tourId)
    }, [])

    const dismissTour = useCallback(() => {
        setActiveTourId(null)
    }, [])

    const resetTour = useCallback((tourId: string) => {
        resetTourStatus(tourId)
    }, [])

    const resetAllTours = useCallback(() => {
        resetAllTourStatuses()
    }, [])

    const isTourCompleted = useCallback((tourId: string) => {
        return getTourStatus(tourId).completed
    }, [])

    const getCompletionStats = useCallback(() => {
        const all = getAllTours()
        const completed = all.filter(t => getTourStatus(t.id).completed).length
        return { total: all.length, completed }
    }, [])

    const value: TourState = {
        activeTourId,
        startTour,
        dismissTour,
        resetTour,
        resetAllTours,
        isTourCompleted,
        getAllTours,
        getToursByModule,
        getCompletionStats,
    }

    return (
        <TourContext.Provider value={value}>
            {children}
        </TourContext.Provider>
    )
}

/** Hook to access global tour state. Must be used inside TourProvider. */
export function useTourContext(): TourState {
    const ctx = useContext(TourContext)
    if (!ctx) {
        // Graceful fallback when used outside provider (e.g., SaaS pages)
        return {
            activeTourId: null,
            startTour: () => {},
            dismissTour: () => {},
            resetTour: () => {},
            resetAllTours: () => {},
            isTourCompleted: () => false,
            getAllTours: () => [],
            getToursByModule: () => [],
            getCompletionStats: () => ({ total: 0, completed: 0 }),
        }
    }
    return ctx
}
