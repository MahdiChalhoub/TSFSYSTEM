/* ═══════════════════════════════════════════════════════════
 *  TOUR: Inventory — Packages (Mobile)
 * ═══════════════════════════════════════════════════════════ */

import { Box, Sparkles, Search, Plus, Layers, Archive, Database, History } from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const tour: TourConfig = {
    id: 'inventory-packages-mobile',
    title: 'Packages (Mobile)',
    module: 'inventory',
    description: 'Mobile walkthrough of package templates and the bottom-sheet detail.',
    version: 1,
    steps: [
        {
            target: null, isWelcome: true,
            title: 'Welcome to Packages 📦',
            description: 'Templates define the SHAPE of a packaging — name + ratio + unit. Products adopt them and supply their own barcode and price.',
            icon: createElement(Box, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: '[data-tour="kpi-strip"]', placement: 'bottom',
            title: 'Templates at a glance',
            description: 'Total templates · unit families · defaults · archived count. Tap any KPI to filter the list.',
            icon: createElement(Layers, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: '[data-tour="search-bar"]', placement: 'bottom',
            title: 'Find a template',
            description: 'Search by name, code, or unit. The bar stays visible as you scroll.',
            icon: createElement(Search, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: '[data-tour="add-btn"]', placement: 'bottom',
            title: 'New template',
            description: 'Pick a unit, name it, set the ratio (and optional parent for a chain). The smart engine then proposes it whenever a matching product is created.',
            icon: createElement(Plus, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: null, isWelcome: true,
            title: 'Bottom-sheet detail',
            description: 'Tap any template row to open the bottom sheet. Two tabs: Overview (read-only stats) and Audit (who changed what). Footer carries Edit / Archive / Delete.',
            icon: createElement(History, { size: 16 }), color: 'var(--app-muted-foreground)',
        },
        {
            target: '[data-tour="data-menu-btn"]', placement: 'bottom',
            title: 'Import / Export / Print',
            description: 'Round-trip the catalog as CSV / Excel. Order in the CSV doesn\'t matter — the importer wires the parent chain in pass 2.',
            icon: createElement(Database, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: null, isWelcome: true,
            title: 'Archive instead of delete',
            description: 'Tap "Show archived" in the toolbar to surface retired templates. Restore one anytime — past ProductPackagings that referenced it stay intact.',
            icon: createElement(Archive, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: null, isWelcome: true,
            title: 'You\'re all set 🎉',
            description: 'Tap the ✨ Tour button in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)',
        },
    ],
}

registerTour(tour)
export default tour
