/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — Chart of Accounts
 *
 *  Walkthrough for the Chart of Accounts ledger:
 *    • KPI-driven type filters
 *    • Search (Ctrl+K)
 *    • Hierarchical account tree
 *    • Creating accounts
 *    • Loading country-specific templates (French PCG,
 *      SYSCOHADA, Lebanese PCN)
 *    • Migration flow for importing from legacy systems
 *    • Posting rules (link system events → accounts)
 *    • Balance audit / recalculation
 *    • Focus mode (Ctrl+Q)
 *
 *  Target selectors live on the COA viewer.tsx header /
 *  toolbar. To update, increment `version` to re-trigger for
 *  existing users.
 * ═══════════════════════════════════════════════════════════ */

import {
    BookOpen, BarChart3, Search, FolderTree, Plus, Library, Zap,
    Settings2, RefreshCcw, Maximize2, Sparkles, Keyboard, Layers
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const coaTour: TourConfig = {
    id: 'finance-chart-of-accounts',
    title: 'Chart of Accounts',
    module: 'finance',
    description: 'Walkthrough of the ledger root — types, templates, migration, posting rules, and auditing.',
    version: 2,
    steps: [
        // 0 — Welcome
        {
            target: null,
            isWelcome: true,
            title: 'Welcome to the Chart of Accounts 📚',
            description: 'The Chart of Accounts is the backbone of your ledger. This tour covers filtering by type, loading country templates, migrating legacy books, and wiring system events to the right accounts.',
            icon: createElement(BookOpen, { size: 16 }),
            color: 'var(--app-primary)',
        },
        // 1 — KPI strip / type filters
        {
            target: '[data-tour="kpi-strip"]',
            title: 'Type Filters, at a Glance',
            description: 'Totals for Assets, Liabilities, Equity, Income, and Expenses. Click any tile to filter the tree to that type — click it again to clear the filter.',
            icon: createElement(BarChart3, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 2 — Search
        {
            target: '[data-tour="search-bar"]',
            title: 'Find Accounts Fast',
            description: 'Search by account code, name, or SYSCOHADA code. Press Ctrl+K from anywhere to jump here instantly.',
            icon: createElement(Search, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 3 — Tree
        {
            target: '[data-tour="account-tree"]',
            title: 'The Account Hierarchy',
            description: 'Accounts are grouped into a parent/child tree. Click the chevron to expand a parent. Each row shows its running balance, type badge, and SYSCOHADA mapping when present.',
            icon: createElement(FolderTree, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'top',
        },
        // 4 — New Account
        {
            target: '[data-tour="add-account-btn"]',
            title: 'Create a New Account',
            description: 'Open the inline form to add a root or sub-account. Pick its type (Asset / Liability / etc.), optional sub-type (Cash / Bank / Receivable / Payable), and parent account.',
            icon: createElement(Plus, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
        },
        // 5 — Templates
        {
            target: '[data-tour="templates-btn"]',
            title: 'Country Templates',
            description: 'Jump to the Templates page to seed your ledger from a pre-built chart: French PCG, SYSCOHADA (revised), Lebanese PCN, and more. Saves hours of manual setup.',
            icon: createElement(Library, { size: 16 }),
            color: '#8b5cf6',
            placement: 'bottom',
        },
        // 6 — Migration
        {
            target: '[data-tour="migration-btn"]',
            title: 'Migration from a Legacy Book',
            description: 'Already have a chart from another system? The Migration workspace lets you upload, map old codes to your target template, and execute the switch with a preview.',
            icon: createElement(Zap, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 7 — Posting Rules
        {
            target: '[data-tour="posting-rules-btn"]',
            title: 'Posting Rules',
            description: 'Tell the system which account to hit on every business event — sales, purchases, payments, subscription revenue, etc. Without rules, fallbacks kick in via each account\'s system role.',
            icon: createElement(Settings2, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'bottom',
        },
        // 8 — Audit / recalc
        {
            target: '[data-tour="audit-btn"]',
            title: 'Recalculate Balances',
            description: 'Audit rebuilds every account balance from the posted journal entries. Run it after bulk imports or if a balance ever looks suspicious.',
            icon: createElement(RefreshCcw, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 9 — Focus mode
        {
            target: '[data-tour="focus-mode-btn"]',
            title: 'Focus Mode',
            description: 'Hide the header chrome and work with a compact toolbar only — handy for long sessions. Toggle with Ctrl+Q from anywhere.',
            icon: createElement(Maximize2, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'left',
        },
        // 10 — Keyboard
        {
            target: null,
            isWelcome: true,
            title: 'Power-User Shortcuts ⌨️',
            description: 'Ctrl+K → Focus search\nCtrl+Q → Toggle focus mode\nEsc → Close modals and panels\nArrow keys → Navigate this tour',
            icon: createElement(Keyboard, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
        },
        // 11 — Complete
        {
            target: null,
            isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'You now know the full COA workflow: filter by type, search, build the tree, load templates, migrate legacy books, wire posting rules, and audit balances. Click the ✨ Tour button in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
    ],
}

registerTour(coaTour)
export default coaTour
