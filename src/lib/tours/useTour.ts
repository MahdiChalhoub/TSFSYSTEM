'use client'

/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — Platform Tour Engine — useTour Hook
 *  Page-level hook for consuming and controlling a specific tour.
 *
 *  Usage:
 *    const { isActive, steps, start, currentTour } = usePageTour('inventory-categories')
 * ═══════════════════════════════════════════════════════════ */

import { useCallback, useMemo } from 'react'
import { useTourContext } from './context'
import { getTour } from './registry'
import { shouldAutoStart } from './storage'
import type { TourConfig } from './types'

interface UsePageTourReturn {
    /** Whether this tour is the currently active tour */
    isActive: boolean
    /** The full tour config */
    currentTour: TourConfig | undefined
    /** The tour steps */
    steps: TourConfig['steps']
    /** Manually start this tour (resets localStorage first) */
    start: () => void
    /** Whether this tour should auto-start (first visit or new version) */
    shouldAutoStart: boolean
    /** Tour version */
    version: number
}

/**
 * Hook for a specific page tour.
 * Call this in your page component with the tour ID.
 */
export function usePageTour(tourId: string): UsePageTourReturn {
    const { activeTourId, startTour, resetTour } = useTourContext()

    const currentTour = useMemo(() => getTour(tourId), [tourId])
    const isActive = activeTourId === tourId
    const autoStart = currentTour ? shouldAutoStart(tourId, currentTour.version) : false

    const start = useCallback(() => {
        resetTour(tourId)
        startTour(tourId)
    }, [tourId, resetTour, startTour])

    return {
        isActive,
        currentTour,
        steps: currentTour?.steps ?? [],
        start,
        shouldAutoStart: autoStart,
        version: currentTour?.version ?? 1,
    }
}
