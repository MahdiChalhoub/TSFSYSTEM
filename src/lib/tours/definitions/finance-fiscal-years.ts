/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — Fiscal Years
 *
 *  Walkthrough for the Fiscal Years control plane:
 *    • The years list (left rail) — open/closed/finalized state
 *    • Per-year tabs: Periods · Summary · Checklist · History
 *      · Close Entries · Snapshots · Integrity
 *    • Year-end close, soft-close, prior-period adjustment
 *    • Snapshot hash-chain (tampering detection)
 *    • Task Settings (auto-task rules + reminder lead-time)
 *    • Create Fiscal Year wizard
 *    • Multi-year comparison tab
 *    • Focus mode (Ctrl+Q) and search (Ctrl+K)
 *
 *  Target selectors live on the fiscal-years viewer / panels.
 *  To update copy or add steps, increment `version` so the
 *  tour replays for users who already saw the previous one.
 * ═══════════════════════════════════════════════════════════ */

import {
    Calendar, Layers, ListChecks, BarChart3, History, BookOpen,
    ShieldCheck, Lock, Plus, Zap, GitCompare, Keyboard, Sparkles,
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const fiscalYearsTour: TourConfig = {
    id: 'finance-fiscal-years',
    title: 'Fiscal Years',
    module: 'finance',
    description: 'Periods, closing cycles, snapshots, and routing rules for the accounting calendar.',
    version: 1,
    steps: [
        // 0 — Welcome
        {
            target: null,
            isWelcome: true,
            title: 'Welcome to Fiscal Years 📅',
            description: 'This is the control plane for your accounting calendar — every period, every close, every snapshot. The tour covers how to open/close periods, run year-end close, audit snapshots, and route reminder tasks to the right people.',
            icon: createElement(Calendar, { size: 16 }),
            color: 'var(--app-primary)',
        },
        // 1 — Years list (left rail)
        {
            target: '[data-tour="years-list"]',
            title: 'Your Fiscal Years',
            description: 'All fiscal years live here. Each card shows its name, date range, period count, and how many periods are still open. Click a year to drill into its details on the right.',
            icon: createElement(Layers, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'right',
        },
        // 2 — Year tabs strip
        {
            target: '[data-tour="year-tabs"]',
            title: 'Tabs Inside a Year',
            description: 'Each year has 7 tabs: Periods (the calendar), Summary (P&L + Balance Sheet), Checklist (close-time todos), History (audit log), Close Entries (closing JEs + opening balances), Snapshots (hash chain), Integrity (canary checks).',
            icon: createElement(ListChecks, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'bottom',
        },
        // 3 — Periods grid
        {
            target: '[data-tour="periods-grid"]',
            title: 'Periods & Their Status',
            description: 'Each period shows its status: OPEN (entries allowed), SOFT_LOCKED (visible to managers only), HARD_LOCKED (immutable), CLOSED (year-end). Use the row actions to soft-close a month or reopen one.',
            icon: createElement(Calendar, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'top',
        },
        // 4 — Summary tab
        {
            target: '[data-tour="summary-tab"]',
            title: 'Year Summary',
            description: 'Revenue, Expenses, Net Income, Assets, Liabilities, Equity — all computed from posted journal entries within this year. Numbers respect the OFFICIAL ↔ INTERNAL toggle in the sidebar (OFFICIAL filters journals, INTERNAL sums everything).',
            icon: createElement(BarChart3, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 5 — History tab
        {
            target: '[data-tour="history-tab"]',
            title: 'Audit Log + Activity',
            description: 'A timeline of every state change for this year — period closures, year-end execution, hard locks, and a per-month chart of journal entry counts.',
            icon: createElement(History, { size: 16 }),
            color: '#8b5cf6',
            placement: 'bottom',
        },
        // 6 — Close Entries tab
        {
            target: '[data-tour="entries-tab"]',
            title: 'Closing & Opening Entries',
            description: 'Once year-end close runs, this tab shows the closing JE (P&L → Retained Earnings) and the opening balances generated for next year. INTERNAL view also surfaces the parallel internal closing JE.',
            icon: createElement(BookOpen, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 7 — Snapshots tab
        {
            target: '[data-tour="snapshots-tab"]',
            title: 'Snapshot Hash Chain',
            description: 'Every period close and year close captures an immutable cryptographic snapshot. Each one points at the previous via prev_hash — so if anyone tampers with a closed period, the chain breaks and you\'ll see "tampered" or "chain_break" right here.',
            icon: createElement(ShieldCheck, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'bottom',
        },
        // 8 — Year-End Close action
        {
            target: '[data-tour="year-close-btn"]',
            title: 'Year-End Close',
            description: 'Sweeps Income and Expense to Retained Earnings, generates opening balances for next year, captures snapshots for both OFFICIAL and INTERNAL scopes. Two-step confirm — preview first, execute second.',
            icon: createElement(Lock, { size: 16 }),
            color: 'var(--app-error, #ef4444)',
            placement: 'left',
        },
        // 9 — Task Settings
        {
            target: '[data-tour="task-settings-btn"]',
            title: 'Reminders & Auto-Tasks',
            description: 'Set the reminder lead-time (how many days before a period\'s end/start the reminder fires) and toggle individual auto-task rules — closing reminders, opening reminders, and reopen-request handlers.',
            icon: createElement(Zap, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 10 — Create Fiscal Year
        {
            target: '[data-tour="create-year-btn"]',
            title: 'Create a Fiscal Year',
            description: 'Wizard to seed a new year — name, start/end date, period frequency (monthly / quarterly / weekly), default period status, and an optional 13th audit period for year-end adjustments.',
            icon: createElement(Plus, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
        },
        // 11 — Multi-year comparison
        {
            target: '[data-tour="multiyear-tab"]',
            title: 'Multi-Year Comparison',
            description: 'Switch to the Multi-Year tab for side-by-side Revenue / Expense / Net Income across all your fiscal years — useful for trend spotting and YoY analysis.',
            icon: createElement(GitCompare, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 12 — Keyboard shortcuts
        {
            target: null,
            isWelcome: true,
            title: 'Power-User Shortcuts ⌨️',
            description: 'Ctrl+K → Focus search\nCtrl+Q → Toggle focus mode\nEsc → Close modals\nArrow keys → Navigate this tour',
            icon: createElement(Keyboard, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
        },
        // 13 — Complete
        {
            target: null,
            isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'You now know the full Fiscal Years workflow: navigate years, work the per-year tabs, close periods and years, audit snapshots, route tasks. Click the ✨ Tour button in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
    ],
}

registerTour(fiscalYearsTour)
export default fiscalYearsTour
