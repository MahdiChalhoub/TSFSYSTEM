/* ═══════════════════════════════════════════════════════════
 *  TOUR: Inventory — Units
 *
 *  Walkthrough for the Units page:
 *    • Base vs derived unit hierarchy
 *    • Creating units
 *    • Conversion factor / calculator
 *    • Balance / scale barcode config
 *    • Detail panel: Overview / Products / Packages / Calculator
 *
 *  Uses TreeMasterPage — the template already provides the
 *  ✨ Tour button in the header, the kpi-strip / search-bar /
 *  tree-container / detail-drawer / split-panel-btn selectors,
 *  and auto-mounts interactions via stepActions.
 * ═══════════════════════════════════════════════════════════ */

import {
    Ruler, Plus, Search, Sparkles, Keyboard, Layers, Package,
    Box, Calculator, MousePointerClick, ChevronRight, ArrowRightLeft,
    LayoutPanelLeft, GitBranch, Scale, Database,
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

/**
 * Step index reference (for stepActions in UnitsClient):
 *  0 = Welcome (centered)
 *  1 = KPI strip (info)
 *  2 = New Unit button (info)
 *  3 = Search bar (info)
 *  4 = Unit tree (info)
 *  5 = Expand tree (ACTION)
 *  6 = Open sidebar on a base unit (ACTION) → spotlight drawer
 *  7 = Detail panel overview (info) → spotlight drawer
 *  8 = Switch to Products tab (ACTION)
 *  9 = Switch to Packages tab (ACTION)
 * 10 = Switch to Calculator tab (ACTION)
 * 11 = Close sidebar (ACTION) → spotlight split-panel button
 * 12 = Standalone Calculator toggle (info)
 * 13 = Variable Barcode button (info)
 * 14 = Data menu — Import / Export / Print (info)
 * 15 = Keyboard shortcuts (centered)
 * 16 = Complete (centered)
 */

const unitsTour: TourConfig = {
    id: 'inventory-units',
    title: 'Units of Measure',
    module: 'inventory',
    description: 'Interactive walkthrough of base vs derived units, conversion factors, packages, and the calculator.',
    version: 1,
    steps: [
        // 0 — Welcome
        {
            target: null,
            isWelcome: true,
            title: 'Welcome to Units 📏',
            description: 'Units define how you count, weigh, and pack products. This tour walks through base units, derived conversions, the built-in calculator, and packaging.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
        },
        // 1 — KPI strip
        {
            target: '[data-tour="kpi-strip"]',
            title: 'Units at a Glance',
            description: 'Totals for base units, derived units, linked products, and scale-barcode units. Base units anchor the hierarchy — everything else converts to a base.',
            icon: createElement(Layers, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 2 — New Unit
        {
            target: '[data-tour="add-btn"]',
            title: 'Create a Unit',
            description: 'Start with a base unit like "Piece" or "KG". Then add derived units ("Box of 12", "Pallet of 50") with a conversion factor. Products reference the base, and the system handles the math.',
            icon: createElement(Plus, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
        },
        // 3 — Search
        {
            target: '[data-tour="search-bar"]',
            title: 'Find Units Fast',
            description: 'Search by name, code, short name, or type. Ctrl+K jumps here instantly. The Expand/Collapse button toggles the whole tree at once.',
            icon: createElement(Search, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 4 — Tree
        {
            target: '[data-tour="tree-container"]',
            title: 'The Unit Hierarchy',
            description: 'Each BASE unit (highlighted in blue) owns a tree of DERIVED units. The ×N column shows the conversion factor. Click a parent to expand, double-click any row to open its details.',
            icon: createElement(Ruler, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'top',
        },
        // 5 — ACTION: Expand tree
        {
            target: '[data-tour="tree-container"]',
            title: 'Expanding the Tree',
            description: 'We just expanded every unit — watch the derived units reveal. Click any parent row to toggle its children individually.',
            icon: createElement(ChevronRight, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'top',
            behavior: 'action',
        },
        // 6 — ACTION: Open sidebar
        {
            target: '[data-tour="detail-drawer"]',
            title: 'Opening the Detail Panel',
            description: 'We opened the detail sidebar! Double-click any parent row — or single-click a derived unit — to open this panel. It has 4 tabs: Overview, Products, Packages, and Calculator.',
            icon: createElement(MousePointerClick, { size: 16 }),
            color: '#8b5cf6',
            placement: 'left',
            behavior: 'action',
        },
        // 7 — Detail overview
        {
            target: '[data-tour="detail-drawer"]',
            title: 'The Detail Panel',
            description: 'The detail sidebar shows the unit\'s conversion factor, linked products, derived children, and any scale-barcode flag. Let\'s see the other tabs...',
            icon: createElement(Layers, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'left',
        },
        // 8 — ACTION: Products tab
        {
            target: '[data-tour="detail-drawer"]',
            title: 'Products Using This Unit',
            description: 'The Products tab lists every SKU tied to this unit, with search, filters, and a move tool that reassigns products to a different unit in one shot.',
            icon: createElement(Package, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'left',
            behavior: 'action',
        },
        // 9 — ACTION: Packages tab
        {
            target: '[data-tour="detail-drawer"]',
            title: 'Linked Packaging',
            description: 'Packaging levels (e.g. 1 Box = 12 Pieces) link products to their real-world pack sizes, with default sale/purchase flags and barcodes. Shows up here when products use this unit.',
            icon: createElement(Box, { size: 16 }),
            color: '#8b5cf6',
            placement: 'left',
            behavior: 'action',
        },
        // 10 — ACTION: Calculator tab
        {
            target: '[data-tour="detail-drawer"]',
            title: 'Unit Calculator',
            description: 'The Calculator tab converts quantities between any two units in the same family. Handy for checking how many pieces are in 3 pallets without leaving the page.',
            icon: createElement(Calculator, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'left',
            behavior: 'action',
        },
        // 11 — ACTION: Close sidebar → spotlight split panel button
        {
            target: '[data-tour="split-panel-btn"]',
            title: 'Split Panel Mode',
            description: 'Prefer the detail panel always visible? Split Panel shows the tree and details side-by-side. You can also Pin the sidebar from inside the drawer using the bookmark icon.',
            icon: createElement(LayoutPanelLeft, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
            behavior: 'action',
        },
        // 12 — Standalone Calculator toggle (separate from the per-unit
        //      Calculator tab in the detail panel — this one floats over
        //      the page without picking a unit first).
        {
            target: '[data-tour="unit-calc-btn"]',
            title: 'Floating Calculator',
            description: 'Toggle a free-floating unit converter that works across every unit in the page — no detail panel needed. Useful for quick "how many pieces in 3 pallets?" math while editing.',
            icon: createElement(ArrowRightLeft, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 13 — Variable Barcode (scale/balance config)
        {
            target: '[data-tour="unit-barcode-btn"]',
            title: 'Variable Barcode',
            description: 'Configure how scale-printed barcodes (variable-weight items) are parsed: prefix, weight digits, price digits, check digit. Drives how the POS reads barcodes from the scale.',
            icon: createElement(Scale, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 14 — Data menu (Export / Import / Print)
        {
            target: '[data-tour="data-menu-btn"]',
            title: 'Import / Export / Print',
            description: 'Round-trip your unit catalog as CSV / Excel: export carries `id` + `base_unit_id` so a re-import updates rows in place. The 2-pass importer wires `base_unit` after all rows exist, so order in the CSV doesn\'t matter.',
            icon: createElement(Database, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'bottom',
        },
        // 15 — Keyboard shortcuts
        {
            target: null,
            isWelcome: true,
            title: 'Power-User Shortcuts ⌨️',
            description: 'Ctrl+K → Focus search\nCtrl+Q → Toggle focus mode (minimal UI)\nEsc → Close panels and dialogs\nArrow keys → Navigate this tour',
            icon: createElement(Keyboard, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
        },
        // 13 — Complete
        {
            target: null,
            isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'You now know the full unit workflow: Create a base unit → Add derived units with conversion factors → Link packages → Use the calculator. Click the ✨ Tour button in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
    ],
}

registerTour(unitsTour)
export default unitsTour
