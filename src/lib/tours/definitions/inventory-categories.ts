/* ═══════════════════════════════════════════════════════════
 *  TOUR: Inventory — Categories (Interactive)
 *
 *  This tour GUIDES the user through actual interactions:
 *  - Click to expand a category
 *  - Click a row to open the detail sidebar
 *  - Navigate to Brands/Attributes tabs  
 *  - Pin the sidebar
 *  - Enable split panel mode
 *
 *  Step actions are injected by the CategoriesClient component
 *  via the stepActions prop on <GuidedTour />.
 *
 *  To update, increment `version` to re-trigger for existing users.
 * ═══════════════════════════════════════════════════════════ */

import {
    FolderTree, Plus, MousePointerClick, Paintbrush, Tag,
    LayoutPanelLeft, Keyboard, Sparkles, Search, Layers,
    ChevronRight, Bookmark, Package
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

/**
 * Step index reference (for stepActions in CategoriesClient):
 *  0 = Welcome (centered)
 *  1 = KPI strip (info)
 *  2 = New Category button (info)
 *  3 = Search bar (info)
 *  4 = Category tree (info)
 *  5 = Expand a category row (ACTION - programmatic)
 *  6 = Click a row to open sidebar (ACTION - programmatic) → spotlight drawer
 *  7 = Detail drawer overview tab (info) → spotlight drawer
 *  8 = Switch to Brands tab (ACTION) → spotlight drawer tab bar
 *  9 = Switch to Attributes tab (ACTION) → spotlight drawer tab bar
 * 10 = Products tab mention (ACTION) → spotlight drawer tab bar
 * 11 = Close sidebar (ACTION) → spotlight split panel button
 * 12 = Keyboard shortcuts (centered)
 * 13 = Tour complete (centered)
 */

const categoriesTour: TourConfig = {
    id: 'inventory-categories',
    title: 'Category Management',
    module: 'inventory',
    description: 'Interactive walkthrough of category creation, brand/attribute linking, and power features.',
    version: 3,
    steps: [
        // 0 — Welcome
        {
            target: null,
            isWelcome: true,
            title: 'Welcome to Categories 👋',
            description: 'This interactive tour will walk you through the complete category workflow — from creating categories to linking brands and attributes. We\'ll click through it together!',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
        // 1 — KPI strip
        {
            target: '[data-tour="kpi-strip"]',
            title: 'Dashboard at a Glance',
            description: 'Your taxonomy health dashboard: total categories, root nodes, leaf nodes, linked products, and brands. These update in real-time as you build your tree.',
            icon: createElement(Layers, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 2 — New Category button
        {
            target: '[data-tour="add-category-btn"]',
            title: 'Step 1: Create a Category',
            description: 'Click this button to create a new category. Choose Root or Sub-category, set a name and code. The modal is quick — brands and attributes are linked separately after creation.',
            icon: createElement(Plus, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
        },
        // 3 — Search bar
        {
            target: '[data-tour="search-bar"]',
            title: 'Find Categories Fast',
            description: 'Search by name, code, or short name. Pro tip: press Ctrl+K to jump here instantly. The Expand/Collapse button toggles the entire tree at once.',
            icon: createElement(Search, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 4 — Category tree overview
        {
            target: '[data-tour="category-tree"]',
            title: 'The Category Tree',
            description: 'Your hierarchical product taxonomy. Each row shows sub-categories, brands, attributes, and products. Click the arrow to expand, or click a row to see its details.',
            icon: createElement(FolderTree, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'top',
        },
        // 5 — ACTION: Expand a category row
        {
            target: '[data-tour="category-tree"]',
            title: 'Expanding the Tree',
            description: 'Watch! We just expanded the first parent category to reveal its children. Click the arrow ▶ on any row to expand or collapse its sub-categories.',
            icon: createElement(ChevronRight, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'top',
            behavior: 'action',
        },
        // 6 — ACTION: Click a row to open sidebar → spotlight the drawer
        {
            target: '[data-tour="detail-drawer"]',
            title: 'Opening the Detail Panel',
            description: 'We just clicked a category to open its detail sidebar. This panel has 4 tabs: Overview, Products, Brands, and Attributes. Let\'s explore them!',
            icon: createElement(MousePointerClick, { size: 16 }),
            color: '#8b5cf6',
            placement: 'left',
            behavior: 'action',
        },
        // 7 — Sidebar overview tab → spotlight the drawer
        {
            target: '[data-tour="detail-drawer"]',
            title: 'The Detail Panel',
            description: 'The detail sidebar shows everything about this category — stats, sub-categories, and metadata. Now let\'s see how to link Brands...',
            icon: createElement(Layers, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'left',
        },
        // 8 — ACTION: Switch to Brands tab → spotlight the tab bar
        {
            target: '[data-tour="detail-tabs"]',
            title: 'Step 2: Link Brands 🎨',
            description: 'We just switched to the Brands tab! Here you can link existing brands to this category, or unlink them. This is how you associate brands with your product taxonomy — after creating the category.',
            icon: createElement(Paintbrush, { size: 16 }),
            color: '#8b5cf6',
            placement: 'left',
            behavior: 'action',
        },
        // 9 — ACTION: Switch to Attributes tab → spotlight the tab bar
        {
            target: '[data-tour="detail-tabs"]',
            title: 'Step 3: Link Attributes 🏷️',
            description: 'Now we\'re on the Attributes tab! Link product attributes (like size, color, material) to this category. Products in this category will inherit these attribute options.',
            icon: createElement(Tag, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'left',
            behavior: 'action',
        },
        // 10 — ACTION: Switch to Products tab → spotlight the tab bar
        {
            target: '[data-tour="detail-tabs"]',
            title: 'Browse Products',
            description: 'The Products tab shows all products in this category with search, filters, sorting, and a smart move tool to reassign products between categories.',
            icon: createElement(Package, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'left',
            behavior: 'action',
        },
        // 11 — ACTION: Close sidebar → spotlight split panel button
        {
            target: '[data-tour="split-panel-btn"]',
            title: 'Split Panel Mode',
            description: 'Want the detail panel always visible? Click Split Panel to view the tree and details side-by-side. You can also Pin the sidebar from inside the drawer using the bookmark icon.',
            icon: createElement(LayoutPanelLeft, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
            behavior: 'action',
        },
        // 12 — Keyboard shortcuts
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
            description: 'You now know the full workflow: Create a category → Open it → Link Brands & Attributes → Browse Products. Click the ✨ Tour button in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
    ],
}

registerTour(categoriesTour)
export default categoriesTour
