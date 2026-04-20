/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — Chart of Accounts Templates Library
 *
 *  INTERACTIVE walkthrough that drives the view-switcher
 *  programmatically to show the user each of the three work
 *  modes: Gallery, Compare, and Migration. Step actions are
 *  injected by TemplatesPageClient via the PageTour mount.
 *
 *  Step index reference (for stepActions):
 *    0 = Welcome (centered)
 *    1 = KPI strip (info)
 *    2 = Tab bar overview (info)
 *    3 = ACTION: setActiveView('gallery')
 *    4 = Gallery content area (info)
 *    5 = ACTION: setActiveView('compare')
 *    6 = Compare content area (info)
 *    7 = ACTION: setActiveView('migration')
 *    8 = Migration content area (info)
 *    9 = ACTION: setActiveView('gallery') (reset)
 *   10 = Search bar (info)
 *   11 = Focus mode button (info)
 *   12 = Keyboard shortcuts (centered)
 *   13 = Complete (centered)
 * ═══════════════════════════════════════════════════════════ */

import {
    Library, Sparkles, Keyboard, GitMerge, ArrowRightLeft, Layers,
    Search, Maximize2, Download, ShieldCheck, TreePine, MousePointerClick
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const templatesTour: TourConfig = {
    id: 'finance-coa-templates',
    title: 'Chart of Accounts — Templates Library',
    module: 'finance',
    description: 'Interactive walkthrough of the templates library — Gallery, Compare, and Migration modes.',
    version: 1,
    steps: [
        // 0 — Welcome
        {
            target: null,
            isWelcome: true,
            title: 'Welcome to the Standards Library 📚',
            description: 'Pre-built Charts of Accounts for different jurisdictions — French PCG, SYSCOHADA (revised), Lebanese PCN, and more. We\'ll walk through the three modes together: browse, compare, and migrate.',
            icon: createElement(Library, { size: 16 }),
            color: 'var(--app-primary)',
        },
        // 1 — KPI strip
        {
            target: '[data-tour="templates-kpi-strip"]',
            title: 'Library at a Glance',
            description: 'Total templates, aggregate account count across all templates, posting-rule definitions, and the number of pre-computed migration maps between templates.',
            icon: createElement(ShieldCheck, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 2 — Tab bar
        {
            target: '[data-tour="templates-tab-bar"]',
            title: 'Three Work Modes',
            description: 'Gallery browses all templates. Compare puts two side-by-side. Migration maps one template onto another — essential when you\'re switching jurisdictions mid-life. Let\'s walk each one.',
            icon: createElement(Layers, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
        },
        // 3 — ACTION: Gallery
        {
            target: '[data-tour="templates-content"]',
            title: 'Gallery Mode — Browse & Import',
            description: 'We just switched to Gallery. Each card shows a template\'s accent color, region, account count, and a direct Import button. Click a card to open its full details on the side — tree of accounts, posting rules, metadata.',
            icon: createElement(Download, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'top',
            behavior: 'action',
        },
        // 4 — Gallery info follow-up
        {
            target: '[data-tour="templates-content"]',
            title: 'Smart Import Flow',
            description: 'Importing is safe: if your COA is empty, it\'s a one-click install. If it exists but is untouched, you\'ll see a replace confirmation. If real data already exists (journal entries, custom accounts), you\'re automatically routed into the Migration flow — no data loss.',
            icon: createElement(ShieldCheck, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'top',
        },
        // 5 — ACTION: Compare
        {
            target: '[data-tour="templates-content"]',
            title: 'Compare Mode',
            description: 'We switched to Compare! Pick 2+ templates with the checkbox on each card and the view splits into parallel columns. Useful for side-by-side evaluation — e.g. "how does SYSCOHADA class 7 stack up against the French PCG revenue accounts?"',
            icon: createElement(GitMerge, { size: 16 }),
            color: '#8b5cf6',
            placement: 'top',
            behavior: 'action',
        },
        // 6 — Compare info
        {
            target: '[data-tour="templates-content"]',
            title: 'Side-by-side Structure',
            description: 'Each column shows the same template info — account count, type breakdown, posting-rules coverage. Use this to justify the migration decision before committing.',
            icon: createElement(Layers, { size: 16 }),
            color: '#8b5cf6',
            placement: 'top',
        },
        // 7 — ACTION: Migration
        {
            target: '[data-tour="templates-content"]',
            title: 'Migration Mode',
            description: 'We\'re now in Migration! Pick a source and target template. The system auto-matches account codes using pre-baked migration hints + name/similarity heuristics, shows you a line-by-line preview, and lets you override any mapping before executing.',
            icon: createElement(ArrowRightLeft, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'top',
            behavior: 'action',
        },
        // 8 — Migration info
        {
            target: '[data-tour="templates-content"]',
            title: 'Safe Swap — Even With Live Data',
            description: 'Migration preserves your journal entries, balances, and custom accounts. The executor remaps every JE line to the target account, archives the old chart, and hands you to the posting-rules page to verify the new wiring.',
            icon: createElement(TreePine, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'top',
        },
        // 9 — ACTION: Back to Gallery
        {
            target: '[data-tour="templates-search-bar"]',
            title: 'Back to Gallery',
            description: 'We\'re back on Gallery. Let\'s cover a few last helpers...',
            icon: createElement(MousePointerClick, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
            behavior: 'action',
        },
        // 10 — Search
        {
            target: '[data-tour="templates-search-bar"]',
            title: 'Filter the Library',
            description: 'Search by template name, key, or region. Ctrl+K jumps here instantly from anywhere on the page.',
            icon: createElement(Search, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 11 — Focus mode
        {
            target: '[data-tour="templates-focus-mode-btn"]',
            title: 'Focus Mode',
            description: 'Hide the header and KPI strip for a denser workspace — the tab bar collapses into the toolbar. Toggle with Ctrl+Q from anywhere.',
            icon: createElement(Maximize2, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 12 — Keyboard
        {
            target: null,
            isWelcome: true,
            title: 'Power-User Shortcuts ⌨️',
            description: 'Ctrl+K → Focus search\nCtrl+Q → Toggle focus mode\nEsc → Close modals and dialogs\nArrow keys → Navigate this tour',
            icon: createElement(Keyboard, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
        },
        // 13 — Complete
        {
            target: null,
            isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'You now know the three modes: Gallery → Browse & Import, Compare → Evaluate side-by-side, Migration → Safe swap with live data. Click the ✨ Tour button in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
    ],
}

registerTour(templatesTour)
export default templatesTour
