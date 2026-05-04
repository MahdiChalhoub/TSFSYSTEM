/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — COA (Mobile)
 *
 *  Mobile-specific walkthrough. Uses the generic selectors that
 *  MobileMasterPage emits (kpi-strip, search-bar, tree-container,
 *  add-btn) so the tooltip bottom-sheet spotlights the right mobile
 *  elements. Steps that are desktop-only (split panel, focus mode,
 *  posting-rules/migration/templates buttons) are intentionally
 *  omitted — they live in the overflow menu on mobile and auto-skip
 *  via GuidedTour's missing-target behavior anyway.
 * ═══════════════════════════════════════════════════════════ */

import {
    BookOpen, Library, Search, FolderTree, Plus, Sparkles,
    MousePointerClick, Menu, RefreshCcw, Building2, GitBranch,
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const coaMobileTour: TourConfig = {
    id: 'finance-chart-of-accounts-mobile',
    title: 'Chart of Accounts (Mobile)',
    module: 'finance',
    description: 'Mobile-friendly walkthrough of the Chart of Accounts — browse, filter by type, and open account details.',
    version: 1,
    steps: [
        {
            target: null,
            isWelcome: true,
            title: 'Welcome 📚',
            description: 'Your Chart of Accounts, mobile edition. This quick tour covers the KPI rail, filtering by type, searching, and opening account details. Takes under a minute.',
            icon: createElement(BookOpen, { size: 16 }),
            color: 'var(--app-primary)',
        },
        {
            target: '[data-tour="kpi-strip"]',
            title: 'KPI Rail',
            description: 'Swipe horizontally to see Assets, Liabilities, Equity, Income, Expenses. These live-update as you map transactions.',
            icon: createElement(Library, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        {
            target: '[data-tour="search-bar"]',
            title: 'Find Accounts',
            description: 'Search by code, name, or SYSCOHADA code. The sticky bar stays visible as you scroll so the field is always one tap away.',
            icon: createElement(Search, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        {
            target: '[data-tour="tree-container"]',
            title: 'The Account Tree',
            description: 'Tap a row to open its details in a bottom sheet — balance, metadata, sub-accounts. Long-press any row to pull up a quick actions menu (edit, add sub-account, recalc, copy code).',
            icon: createElement(FolderTree, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'top',
        },
        {
            target: '[data-tour="tree-container"]',
            title: 'Filter Chips',
            description: 'The chip row at the top of the list (All / Assets / Liabilities / Equity / Income / Expenses) narrows the tree to one type. Handy for spotting gaps in a single class.',
            icon: createElement(MousePointerClick, { size: 16 }),
            color: '#8b5cf6',
            placement: 'top',
        },
        {
            target: '[data-tour="add-btn"]',
            title: 'Add an Account',
            description: 'The blue + button on the top-right takes you to the desktop creation form. Once created, the new account appears in the tree here — pull down to refresh if needed.',
            icon: createElement(Plus, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
        },
        // SCOPE chip per row
        {
            target: '[data-tour="tree-container"]',
            title: 'Branch Scope on Each Row',
            description: 'Every account row carries a tiny scope chip — 🌐 Tenant-wide (one shared balance), 🏢 Branch-split (slices per branch), 📦 Branch-located (lives at one site). On mobile we keep them compact next to the balance.',
            icon: createElement(Building2, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'top',
        },
        // SCOPE filter rail
        {
            target: '[data-tour="scope-filter-rail"]',
            title: 'Scope Filter Rail',
            description: 'A second row of filter chips lets you focus on one scope category at a time — handy on mobile when scrolling the full tree is slow. Combine with the Branch picker in the drawer to see what changes when you switch branch.',
            icon: createElement(GitBranch, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'top',
        },
        {
            target: null,
            isWelcome: true,
            title: 'More from the Overflow Menu ⋯',
            description: 'Tap the "⋯" button in the header to reach Templates, Posting Rules, Migration Tool, and the Show/Hide Inactive toggle. On mobile we keep the header clean — those tools live one tap away.',
            icon: createElement(Menu, { size: 16 }),
            color: 'var(--app-muted-foreground)',
        },
        {
            target: null,
            isWelcome: true,
            title: 'Pull to Refresh',
            description: 'Swipe down on the list to re-sync the chart with the backend. Balances come back fresh, any new accounts from a parallel session show up.',
            icon: createElement(RefreshCcw, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
        },
        {
            target: null,
            isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'Tap rows to inspect, long-press for actions, overflow menu for tools, pull-to-refresh when things feel stale. Tap ✨ in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
    ],
}

registerTour(coaMobileTour)
export default coaMobileTour
