/* ═══════════════════════════════════════════════════════════
 *  TOUR: Inventory — Packages (Desktop)
 *  Walks the user through the first-class packaging master page.
 * ═══════════════════════════════════════════════════════════ */

import {
    Box, Sparkles, Layers, Search, Plus, Keyboard, MousePointerClick,
    LayoutPanelLeft, Archive, Database, History,
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const tour: TourConfig = {
    id: 'inventory-packages',
    title: 'Packages Master',
    module: 'inventory',
    description: 'First-class packaging templates — barcodes, prices, links to categories/brands/attributes.',
    version: 1,
    steps: [
        {
            target: null, isWelcome: true,
            title: 'Welcome to Packages 📦',
            description: 'Packages are reusable packaging templates — "Pack of 6", "Carton 24", "Pallet 144" — that carry their own barcode, price, and links to categories / brands / attributes. Each one is a first-class entity, like a mini-product.',
            icon: createElement(Box, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: '[data-tour="kpi-strip"]', placement: 'bottom',
            title: 'At a Glance',
            description: 'Totals for packages: active count, how many have barcodes, how many are priced, how many are set as the default for their unit, plus the total suggestion rules fired by these packages.',
            icon: createElement(Layers, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: '[data-tour="search-bar"]', placement: 'bottom',
            title: 'Search + Filters',
            description: 'Filter by name, code, or barcode. Toggle the Expand / Collapse button to open every unit group at once. Press Ctrl+K anywhere to jump to the search.',
            icon: createElement(Search, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: '[data-tour="tree-container"]', placement: 'top',
            title: 'Unit Tree',
            description: 'Packages are grouped under their base unit. Click a unit row to expand its packages. Click a package to open its 5-tab detail drawer. Double-click anywhere opens the drawer directly.',
            icon: createElement(MousePointerClick, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: '[data-tour="add-btn"]', placement: 'bottom',
            title: 'Create a Package',
            description: 'New Package opens the full form: name, code, unit, ratio, barcode, selling price, default flag, active flag, notes. After saving, link it to categories / brands / attributes from its detail drawer.',
            icon: createElement(Plus, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: null, isWelcome: true,
            title: 'The 5-Tab Detail Drawer',
            description: 'Click a package row to open the drawer:\n• Overview — all fields at a glance\n• Links — category / brand / attribute rules (smart engine)\n• Products — SKUs currently using this package\n• Economics — cost-per-base-unit, margin preview\n• Barcode — format detection, scan-ready chip',
            icon: createElement(Sparkles, { size: 16 }), color: '#8b5cf6',
        },
        {
            target: '[data-tour="split-panel-btn"]', placement: 'bottom',
            title: 'Split Panel Mode',
            description: 'Flip to side-by-side view — tree on the left, detail panel permanently on the right. Handy when you\'re doing bulk edits across many packages in the same unit family.',
            icon: createElement(LayoutPanelLeft, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: '[data-tour="pkg-archive-toggle"]', placement: 'bottom',
            title: 'Archive vs Delete',
            description: 'Templates support a soft-delete: Archive hides them from the picker and the suggestion engine but preserves history. Toggle "Show archived" anytime to restore. Hard-delete (Trash) is staff-only.',
            icon: createElement(Archive, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: '[data-tour="data-menu-btn"]', placement: 'bottom',
            title: 'Import / Export / Print',
            description: 'Round-trip the catalog as CSV / Excel. Export carries `id` and `parent_id` so a re-import updates rows in place; the 2-pass importer wires the parent chain after every row exists, so order in the CSV doesn\'t matter.',
            icon: createElement(Database, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: null, isWelcome: true,
            title: 'Detail panel: Audit tab',
            description: 'Open any template and switch to the Audit tab to see who changed what (action chip · user · time-ago · per-field old → new diff). Same shape as the Units page — useful for compliance and "who broke this?" debugging.',
            icon: createElement(History, { size: 16 }), color: 'var(--app-muted-foreground)',
        },
        {
            target: null, isWelcome: true,
            title: 'Power Shortcuts ⌨️',
            description: 'Ctrl+K → search · Ctrl+Q → focus mode (minimal chrome) · Esc → close drawers · Arrow keys → navigate this tour.',
            icon: createElement(Keyboard, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: null, isWelcome: true,
            title: 'You\'re all set 🎉',
            description: 'Create package → wire up its links (category / brand / attribute) → the smart engine proposes it during product creation → each acceptance bumps usage_count so popular choices surface first next time. Tap the ✨ button anytime to replay this tour.',
            icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)',
        },
    ],
}

registerTour(tour)
export default tour
