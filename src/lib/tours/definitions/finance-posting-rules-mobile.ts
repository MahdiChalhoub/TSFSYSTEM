/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — Posting Rules (Mobile)
 * ═══════════════════════════════════════════════════════════ */

import { Target, Sparkles, BarChart3, Zap, RefreshCcw, Save, BookOpen, Package, Layers } from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const tour: TourConfig = {
    id: 'finance-posting-rules-mobile',
    title: 'Posting Engine (Mobile)',
    module: 'finance',
    description: 'Mobile walkthrough of the event-to-account routing console.',
    version: 1,
    steps: [
        {
            target: null, isWelcome: true,
            title: 'Welcome to the Posting Engine 🎯',
            description: 'Every business event — sales, payments, stock moves — has to land on the right accounts. This console wires each event to specific accounts, with heuristics to fill the gaps.',
            icon: createElement(Target, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: '[data-tour="kpi-strip"]',
            title: 'Mapping Coverage', placement: 'bottom',
            description: 'Total events, mapped vs unmapped, coverage percentage. Tap Mapped/Unmapped tiles to filter the list — zone in on what still needs attention.',
            icon: createElement(BarChart3, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: null, isWelcome: true,
            title: 'Module Tabs 📦',
            description: 'Events are grouped by module — Sales, Purchases, Payments, Inventory, etc. Each module has its own mapping coverage; work through them one at a time.',
            icon: createElement(Package, { size: 16 }), color: '#8b5cf6',
        },
        {
            target: '[data-tour="tree-container"]',
            title: 'Event-to-Account Rows', placement: 'top',
            description: 'Each row is one business event with its human label and code. The check/cross shows mapped state. Tap the account button on a row to open a drill-down tree and pick a target account.',
            icon: createElement(Layers, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: null, isWelcome: true,
            title: 'Sync from Template 🔄',
            description: 'Sync Template (in the overflow menu) pulls the default rules shipped with your current COA template (SYSCOHADA, French PCG, etc.) and fills unmapped events. Does NOT overwrite manual mappings.',
            icon: createElement(RefreshCcw, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: null, isWelcome: true,
            title: 'Auto-Detect ⚡',
            description: 'Auto-Detect runs name-similarity + type heuristics against your accounts and proposes mappings for unmapped events. Fastest route from blank to 80%+ coverage — review the proposals, then save.',
            icon: createElement(Zap, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: null, isWelcome: true,
            title: 'Save Your Changes 💾',
            description: 'Tweaks stay as unsaved overrides until you tap Save. The footer shows the unsaved count; a Save button appears in the header when there\'s something to save.',
            icon: createElement(Save, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: null, isWelcome: true,
            title: 'Need to Create an Account? 📖',
            description: 'The Chart of Accounts link (in the overflow menu) jumps you back so you can create a new account first, then return here to wire it up.',
            icon: createElement(BookOpen, { size: 16 }), color: 'var(--app-muted-foreground)',
        },
        {
            target: null, isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'Sync → Auto-Detect → Review unmapped → Pick accounts → Save. Tap ✨ in the header anytime to replay.',
            icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)',
        },
    ],
}

registerTour(tour)
export default tour
