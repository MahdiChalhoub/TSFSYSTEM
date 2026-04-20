/* ═══════════════════════════════════════════════════════════
 *  TOUR: Inventory — Units (Mobile)
 * ═══════════════════════════════════════════════════════════ */

import { Ruler, Sparkles, Search, Plus, Package, Menu, RefreshCcw, Scale, Layers } from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const tour: TourConfig = {
    id: 'inventory-units-mobile',
    title: 'Units (Mobile)',
    module: 'inventory',
    description: 'Mobile walkthrough of units, conversions, and packaging.',
    version: 1,
    steps: [
        {
            target: null, isWelcome: true,
            title: 'Welcome to Units 📏',
            description: 'Units define how you count, weigh, and pack products. This quick tour covers base vs derived units, the calculator, and packaging.',
            icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: '[data-tour="kpi-strip"]',
            title: 'Unit Stats', placement: 'bottom',
            description: 'Swipe to see base units, derived units, products linked, and scale-weighted units.',
            icon: createElement(Layers, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: '[data-tour="search-bar"]',
            title: 'Find a Unit', placement: 'bottom',
            description: 'Search by name, code, short name, or type. The sticky bar stays visible as you scroll.',
            icon: createElement(Search, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: '[data-tour="tree-container"]',
            title: 'Unit Hierarchy', placement: 'top',
            description: 'Base units (in blue) anchor each family. Tap a row to open details — conversion factor, derived units, linked packaging. Long-press for the quick-actions sheet.',
            icon: createElement(Ruler, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: '[data-tour="add-btn"]',
            title: 'Create a Unit', placement: 'bottom',
            description: 'Start with a base unit (Piece, KG) then add derived ones with conversion factors (Box of 12, Pallet of 50). The + opens the creation form.',
            icon: createElement(Plus, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: null, isWelcome: true,
            title: 'Packaging 📦',
            description: 'Each unit can have linked packaging levels — real-world pack sizes tied to products with default sale/purchase flags and barcodes. Visible in the detail sheet under the Packages tab.',
            icon: createElement(Package, { size: 16 }), color: '#8b5cf6',
        },
        {
            target: null, isWelcome: true,
            title: 'Scale-Weighted Units ⚖️',
            description: 'Flag units that require a weighing scale at POS (KG, LB, grams). Products using scale units get a scale icon and special barcode handling.',
            icon: createElement(Scale, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: null, isWelcome: true,
            title: 'More Tools via ⋯',
            description: 'Tap the overflow menu in the header for the Calculator (convert between any two units), Barcode config, and Maintenance cleanup.',
            icon: createElement(Menu, { size: 16 }), color: 'var(--app-muted-foreground)',
        },
        {
            target: null, isWelcome: true,
            title: 'Pull to Refresh',
            description: 'Swipe down to re-sync units from the backend. Handy after a parallel session created new derived units.',
            icon: createElement(RefreshCcw, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: null, isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'Base → derived → packaging, calculator for conversions, scale flag for POS. Tap ✨ in the header to replay.',
            icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)',
        },
    ],
}

registerTour(tour)
export default tour
