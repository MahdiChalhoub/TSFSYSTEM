/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — Platform Tour Engine — Types
 *  Shared types for the interactive guided tour system.
 *
 *  Tours are ACTION-DRIVEN: steps can trigger UI changes,
 *  wait for user clicks, and programmatically demonstrate
 *  features in real time.
 * ═══════════════════════════════════════════════════════════ */

/**
 * How a step advances to the next:
 * - 'info'   → User clicks "Next" button (passive tooltip)
 * - 'click'  → User must click the highlighted target element
 * - 'action' → Step auto-performs an action, then waits for user to click Next
 */
export type StepBehavior = 'info' | 'click' | 'action'

/** A single step in a guided tour */
export interface TourStep {
    /** CSS selector for the element to highlight. If null, shows a centered modal. */
    target: string | null
    /** Title for this step */
    title: string
    /** Description / body text */
    description: string
    /** Icon to display (React node) */
    icon?: React.ReactNode
    /** Accent color for this step's icon box */
    color?: string
    /** Preferred tooltip placement relative to the target */
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
    /** If true, this is a centered modal overlay (ignores target) */
    isWelcome?: boolean
    /**
     * Step behavior type:
     * - 'info'   → Just shows info, user clicks Next (default)
     * - 'click'  → Highlights target and waits for user to click it
     * - 'action' → Programmatically performs an action on enter
     */
    behavior?: StepBehavior
    /** Hint text shown on the Next button for 'click' behavior (e.g., "Click the row") */
    actionHint?: string
    /** Delay in ms before auto-advancing after an 'action' step performs its callback (default: 600) */
    actionDelay?: number
}

/** Configuration for a page-level tour */
export interface TourConfig {
    /** Unique identifier for this tour (e.g., "inventory-categories") */
    id: string
    /** Human-readable title */
    title: string
    /** Module this tour belongs to (e.g., "inventory", "finance", "pos") */
    module: string
    /** Short description of what this tour covers */
    description: string
    /** The steps of the tour */
    steps: TourStep[]
    /** Version number — increment to re-trigger the tour for existing users */
    version: number
}

/** Tour completion status stored in localStorage */
export interface TourStatus {
    /** Whether the tour has been completed or dismissed */
    completed: boolean
    /** Timestamp of completion */
    completedAt?: string
    /** Version that was completed */
    completedVersion?: number
}

/**
 * Step action callbacks provided by the PAGE component.
 * Maps step index → callback that performs a UI action.
 * This is how pages inject interactivity into tour steps.
 */
export type StepActions = Record<number, () => void | Promise<void>>

/** Global tour state exposed via context */
export interface TourState {
    /** Currently active tour ID, or null */
    activeTourId: string | null
    /** Start a tour by ID */
    startTour: (tourId: string) => void
    /** Dismiss the active tour */
    dismissTour: () => void
    /** Reset a tour so it can be shown again */
    resetTour: (tourId: string) => void
    /** Reset all tours */
    resetAllTours: () => void
    /** Check if a tour has been completed */
    isTourCompleted: (tourId: string) => boolean
    /** Get all registered tours */
    getAllTours: () => TourConfig[]
    /** Get tours for a specific module */
    getToursByModule: (module: string) => TourConfig[]
    /** Get completion stats */
    getCompletionStats: () => { total: number; completed: number }
}
