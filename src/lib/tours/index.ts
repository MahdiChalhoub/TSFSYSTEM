/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — Platform Tour Engine — Public API
 * ═══════════════════════════════════════════════════════════ */

// Types
export type { TourStep, TourConfig, TourStatus, TourState, StepActions, StepBehavior } from './types'

// Registry
export { registerTour, getTour, getAllTours, getToursByModule, getModulesWithTours } from './registry'

// Storage
export { getTourStatus, markTourCompleted, resetTourStatus, resetAllTourStatuses, shouldAutoStart } from './storage'

// Context (client-only)
export { TourProvider, useTourContext } from './context'

// Page-level hook (client-only)
export { usePageTour } from './useTour'
