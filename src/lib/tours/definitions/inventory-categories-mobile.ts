/* ═══════════════════════════════════════════════════════════
 *  TOUR: Inventory — Categories (Mobile)
 * ═══════════════════════════════════════════════════════════ */

import { FolderTree, Sparkles, Search, Plus, Paintbrush, Tag, Menu, MousePointerClick, RefreshCcw } from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const tour: TourConfig = {
    id: 'inventory-categories-mobile',
    title: 'Categories (Mobile)',
    module: 'inventory',
    description: 'Mobile walkthrough of the product category tree.',
    version: 1,
    steps: [
        {
            target: null, isWelcome: true,
            title: 'Welcome to Categories 📁',
            description: 'Your product taxonomy lives here — a nested tree of categories with linked brands and attributes. This tour covers browsing, creating, and the drill-down flow.',
            icon: createElement(FolderTree, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: '[data-tour="kpi-strip"]',
            title: 'Taxonomy Stats', placement: 'bottom',
            description: 'Swipe to see totals, root nodes, leaves, linked products, and brands. Updates live as you build the tree.',
            icon: createElement(FolderTree, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: '[data-tour="search-bar"]',
            title: 'Find a Category', placement: 'bottom',
            description: 'Search by name, code, or short name. The expand/collapse button next to the search toggles the full tree at once.',
            icon: createElement(Search, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: '[data-tour="tree-container"]',
            title: 'The Category Tree', placement: 'top',
            description: 'Tap a parent to drill into it (a breadcrumb appears up top). Tap a leaf to open its detail sheet. Long-press any row for the quick-actions menu (edit, add sub, move, delete).',
            icon: createElement(MousePointerClick, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: '[data-tour="add-btn"]',
            title: 'Create a Category', placement: 'bottom',
            description: 'The + button opens the creation modal — name + optional parent + optional code. After creation, link Brands and Attributes from the category detail sheet.',
            icon: createElement(Plus, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: null, isWelcome: true,
            title: 'Brands & Attributes 🎨',
            description: 'Each category can have linked Brands (design, style, family) and Attributes (size, color, material). Products under the category inherit these as their option set. Link them from the category detail bottom sheet.',
            icon: createElement(Paintbrush, { size: 16 }), color: '#8b5cf6',
        },
        {
            target: null, isWelcome: true,
            title: 'Move Between Parents 🔀',
            description: 'Long-press a category → Move opens a dialog to pick a new parent. All children follow automatically. Handy for reorganizing the taxonomy without recreating.',
            icon: createElement(Tag, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: null, isWelcome: true,
            title: 'More Tools via ⋯',
            description: 'The overflow menu in the header has the Maintenance cleanup tool — find orphans, dedupe, repair broken parent links.',
            icon: createElement(Menu, { size: 16 }), color: 'var(--app-muted-foreground)',
        },
        {
            target: null, isWelcome: true,
            title: 'Pull to Refresh',
            description: 'Swipe down to re-sync. The product count + brand count on each category reflects the latest data.',
            icon: createElement(RefreshCcw, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: null, isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'Tap parents to drill, tap leaves to inspect, long-press for actions, + to create. Tap ✨ anytime to replay.',
            icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)',
        },
    ],
}

registerTour(tour)
export default tour
