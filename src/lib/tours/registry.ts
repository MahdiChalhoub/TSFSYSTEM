/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — Platform Tour Engine — Registry
 *  Central registry of all page-level tours.
 *
 *  HOW TO ADD A TOUR:
 *  1. Import your step definitions from the definitions/ folder
 *  2. Register them with registerTour() below
 *  3. Use useTour('your-tour-id') in your page component
 *
 *  Tours are registered at import time and available globally.
 * ═══════════════════════════════════════════════════════════ */

import type { TourConfig } from './types'

/** Internal map of all registered tours */
const tourRegistry = new Map<string, TourConfig>()

/** Register a tour config. Called at module initialization. */
export function registerTour(config: TourConfig): void {
    tourRegistry.set(config.id, config)
}

/** Get a specific tour by ID */
export function getTour(id: string): TourConfig | undefined {
    return tourRegistry.get(id)
}

/** Get all registered tours */
export function getAllTours(): TourConfig[] {
    return Array.from(tourRegistry.values())
}

/** Get all tours for a specific module */
export function getToursByModule(module: string): TourConfig[] {
    return getAllTours().filter(t => t.module === module)
}

/** Get all unique module names that have tours */
export function getModulesWithTours(): string[] {
    return [...new Set(getAllTours().map(t => t.module))]
}
