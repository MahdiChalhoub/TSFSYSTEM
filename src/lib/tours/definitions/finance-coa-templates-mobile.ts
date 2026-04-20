/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — COA Templates Library (Mobile)
 * ═══════════════════════════════════════════════════════════ */

import { Library, Sparkles, Search, Download, GitMerge, ArrowRightLeft, ShieldCheck, Layers } from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const tour: TourConfig = {
    id: 'finance-coa-templates-mobile',
    title: 'Templates Library (Mobile)',
    module: 'finance',
    description: 'Mobile walkthrough of the COA templates library — browse, compare, migrate.',
    version: 1,
    steps: [
        {
            target: null, isWelcome: true,
            title: 'Welcome to the Templates Library 📚',
            description: 'Pre-built Charts of Accounts for different jurisdictions — French PCG, SYSCOHADA, Lebanese PCN, more. This tour shows how to browse, compare, and migrate on mobile.',
            icon: createElement(Library, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: '[data-tour="kpi-strip"]',
            title: 'Library Stats', placement: 'bottom',
            description: 'Total templates, aggregate accounts, posting rule counts, and available migration maps.',
            icon: createElement(ShieldCheck, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: '[data-tour="search-bar"]',
            title: 'Filter the Library', placement: 'bottom',
            description: 'Search by template name, key, or region. Quick way to narrow down to the jurisdiction you care about.',
            icon: createElement(Search, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: '[data-tour="tree-container"]',
            title: 'Template Cards', placement: 'top',
            description: 'Each card shows the template\'s accent color, region, account count, and an Import button. Tap a card to open its full details — tree of accounts, posting rules, metadata.',
            icon: createElement(Layers, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: null, isWelcome: true,
            title: 'Safe Import 🛡️',
            description: 'Importing handles three cases automatically: empty COA (one-click install), untouched (replace confirmation), or has data (routes you to Migration flow). Your journal entries are never lost.',
            icon: createElement(Download, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: null, isWelcome: true,
            title: 'Compare Templates',
            description: 'The Compare tab (in the overflow menu) lets you pick 2+ templates and see them side by side — useful for evaluating before committing to a switch.',
            icon: createElement(GitMerge, { size: 16 }), color: '#8b5cf6',
        },
        {
            target: null, isWelcome: true,
            title: 'Migration Flow 🔄',
            description: 'Switching templates with live data? The Migration tab walks you through mapping each old account to a new one, remapping journal entries, and syncing posting rules — all atomic.',
            icon: createElement(ArrowRightLeft, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: null, isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'Three modes: Browse → Compare → Migrate. Importing is always safe. Tap ✨ anytime to replay.',
            icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)',
        },
    ],
}

registerTour(tour)
export default tour
