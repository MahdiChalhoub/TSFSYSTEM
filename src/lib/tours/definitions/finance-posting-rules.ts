/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — Posting Rules / Posting Engine
 *
 *  Interactive walkthrough of the event-to-account routing
 *  console. Drives the module sidebar programmatically so the
 *  user sees the rule grid populate during the tour.
 *
 *  Step index reference (for stepActions in form.tsx):
 *    0 = Welcome (centered)
 *    1 = KPI strip + coverage ring (info)
 *    2 = ACTION: select first module (sidebar spotlight)
 *    3 = Rules grid (info)
 *    4 = Account Tree Picker / mapping row (info)
 *    5 = Search bar (info)
 *    6 = Sync Template button (info)
 *    7 = Auto-Detect button (info)
 *    8 = Save Changes flow (info)
 *    9 = Chart of Accounts return link (info)
 *   10 = Keyboard shortcuts (centered)
 *   11 = Complete (centered)
 * ═══════════════════════════════════════════════════════════ */

import {
    Target, BarChart3, Package, Search, Zap, Save, RefreshCcw,
    BookOpen, Sparkles, Keyboard, Layers, CheckCircle2, MousePointerClick
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const postingRulesTour: TourConfig = {
    id: 'finance-posting-rules',
    title: 'Posting Engine — Event-to-Account Routing',
    module: 'finance',
    description: 'Interactive walkthrough of the Posting Rules console — map every business event to the right account.',
    version: 1,
    steps: [
        // 0 — Welcome
        {
            target: null,
            isWelcome: true,
            title: 'Welcome to the Posting Engine 🎯',
            description: 'Every transaction in the system — a sale, a payment, a stock move — has to land on the right accounts. This console wires each business event to specific accounts, with heuristics to auto-fill the gaps.',
            icon: createElement(Target, { size: 16 }),
            color: 'var(--app-primary)',
        },
        // 1 — KPI strip
        {
            target: '[data-tour="postingrules-kpi-strip"]',
            title: 'Mapping Coverage',
            description: 'Total events, mapped vs unmapped, coverage percentage, and module count. Click Mapped/Unmapped to filter the rules grid — great for zoning in on what still needs attention. The ring on the right is a visual coverage meter.',
            icon: createElement(BarChart3, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 2 — ACTION: Select first module
        {
            target: '[data-tour="postingrules-module-sidebar"]',
            title: 'Events Grouped by Module',
            description: 'Each module (Sales, Purchases, Payments, Inventory, etc.) owns its own set of events. We just selected the first module for you — click any module to switch focus. The small "X/Y mapped" line under each label shows its coverage at a glance.',
            icon: createElement(Package, { size: 16 }),
            color: '#8b5cf6',
            placement: 'right',
            behavior: 'action',
        },
        // 3 — Rules grid
        {
            target: '[data-tour="postingrules-rules-grid"]',
            title: 'The Event-to-Account Grid',
            description: 'Each row is one business event. The check/cross icon shows mapped status. The event\'s human label + code are on the left; the account picker is on the right. A highlighted row means an unsaved override.',
            icon: createElement(Layers, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'top',
        },
        // 4 — Account picker
        {
            target: '[data-tour="postingrules-rules-grid"]',
            title: 'Picking an Account',
            description: 'Click the account button on any row to open a drill-down tree of your Chart of Accounts. You can search, browse parent → child, and pick a leaf account. Automation events (depreciation parent, fx root, etc.) accept parent accounts; normal posting events require a leaf.',
            icon: createElement(MousePointerClick, { size: 16 }),
            color: '#8b5cf6',
            placement: 'top',
        },
        // 5 — Search
        {
            target: '[data-tour="postingrules-search-bar"]',
            title: 'Find Events Fast',
            description: 'Search by event label, code, or even the currently-mapped account. Combine with the KPI filters above (Mapped/Unmapped) to narrow the grid to exactly the rows you care about.',
            icon: createElement(Search, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 6 — Sync Template
        {
            target: '[data-tour="postingrules-sync-btn"]',
            title: 'Sync from the Active Template',
            description: 'Pulls the default rules shipped with your current Chart of Accounts template (French PCG, SYSCOHADA, Lebanese PCN, etc.) and fills in any gaps. Does NOT overwrite your manual mappings — it only adds to unmapped events.',
            icon: createElement(RefreshCcw, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 7 — Auto-Detect
        {
            target: '[data-tour="postingrules-autodetect-btn"]',
            title: 'Auto-Detect',
            description: 'Runs name-similarity + type heuristics against your accounts to propose mappings for unmapped events. You review the results in the grid and save them. Fastest way to go from a blank chart to 80%+ coverage.',
            icon: createElement(Zap, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
        },
        // 8 — Save Changes
        {
            target: '[data-tour="postingrules-kpi-strip"]',
            title: 'Saving Your Changes',
            description: 'Any mapping you tweak stays as an unsaved override until you click Save Changes. The Save button appears in the header only when there\'s something to save — the footer also shows the unsaved count.',
            icon: createElement(Save, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'bottom',
        },
        // 9 — CoA link
        {
            target: '[data-tour="postingrules-coa-btn"]',
            title: 'Jump Back to Accounts',
            description: 'Need to create a new account first? Use the Chart of Accounts button to jump straight there, add the account, and come back. The KPI coverage will update live as you map events.',
            icon: createElement(BookOpen, { size: 16 }),
            color: 'var(--app-muted-foreground)',
            placement: 'bottom',
        },
        // 10 — Keyboard
        {
            target: null,
            isWelcome: true,
            title: 'Power-User Shortcuts ⌨️',
            description: 'Ctrl+K → Focus search\nCtrl+Q → Toggle focus mode (minimal UI)\nEsc → Close pickers and dialogs\nArrow keys → Navigate this tour',
            icon: createElement(Keyboard, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
        },
        // 11 — Complete
        {
            target: null,
            isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'The playbook: Sync Template → Auto-Detect → Review unmapped → Pick accounts → Save. Click the ✨ Tour button in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
    ],
}

registerTour(postingRulesTour)
export default postingRulesTour
