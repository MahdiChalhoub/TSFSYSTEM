/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — Chart of Accounts Migration Workspace
 *
 *  INTERACTIVE walkthrough — drives the workspace so the user
 *  sees each stage of the migration flow in real time:
 *    • Auto-select a target template
 *    • Auto-run the Analyze preview (read-only — safe)
 *    • Tour then walks the user through the loaded preview
 *      (sections, stats, mapping dropdowns, apply button)
 *
 *  Step index reference (for stepActions in MigrationPageClient):
 *    0 = Welcome (centered)
 *    1 = Page header + title (info)
 *    2 = Current state KPIs (info)
 *    3 = ACTION: pick first available target template
 *    4 = ACTION: trigger handleLoadPreview — wait for preview
 *    5 = Summary stats bar (info — now visible)
 *    6 = Category sections (info — now visible)
 *    7 = Target dropdown + match badges (info)
 *    8 = Apply Migration button (info — now visible)
 *    9 = Warnings / post-apply explainer (centered)
 *   10 = Complete (centered)
 * ═══════════════════════════════════════════════════════════ */

import {
    ArrowRightLeft, BarChart3, Zap, Sparkles, Keyboard, Database,
    Target, Layers, Shield, ShieldCheck, FileText, MousePointerClick
} from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const migrateTour: TourConfig = {
    id: 'finance-coa-migrate',
    title: 'Chart of Accounts — Migration Workspace',
    module: 'finance',
    description: 'Interactive walkthrough of the migration workspace — analyze, review, and safely execute a template swap without losing journal history.',
    version: 3,
    steps: [
        // 0 — Welcome
        {
            target: null,
            isWelcome: true,
            title: 'Welcome to Migration 🔄',
            description: 'This workspace lets you swap your Chart of Accounts from one standard to another — without losing a single journal entry. The system scans your existing book, matches accounts, and remaps every posted line.',
            icon: createElement(ArrowRightLeft, { size: 16 }),
            color: 'var(--app-primary)',
        },
        // 1 — Page header
        {
            target: '[data-tour="migrate-header"]',
            title: 'The Workspace',
            description: 'You land here from the main Chart of Accounts page. The Back button (top-left) returns you to the COA tree whenever you want to abandon the migration.',
            icon: createElement(Target, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 2 — Current state KPIs
        {
            target: '[data-tour="migrate-state-kpis"]',
            title: 'Your Current Book',
            description: 'Shows the template you\'re on today, the number of accounts, and how many journal entries exist. If "Migration Required" appears, the book has real data — a simple replace would destroy history, so the system forces you through this flow.',
            icon: createElement(Database, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
        },
        // 3 — ACTION: Pick target template
        {
            target: '[data-tour="migrate-target-select"]',
            title: 'Pick a Target Template',
            description: 'We just picked the first available target for you — French PCG, SYSCOHADA, Lebanese PCN, or whichever is first in your list. You\'d normally choose based on your business needs; only templates different from the current one are offered.',
            icon: createElement(Layers, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'bottom',
            behavior: 'action',
        },
        // 4 — ACTION: Analyze
        {
            target: '[data-tour="migrate-analyze-btn"]',
            title: 'Analyze the Impact',
            description: 'We\'re running the Analyze preview right now — the system scans every source account, matches it against the target template using exact/parent/name-similarity heuristics, and groups results by risk. This is read-only; nothing is committed.',
            icon: createElement(BarChart3, { size: 16 }),
            color: 'var(--app-info, #3b82f6)',
            placement: 'bottom',
            behavior: 'action',
            actionDelay: 1500,
        },
        // 5 — Summary stats (KPI strip now includes them post-preview)
        {
            target: '[data-tour="migrate-state-kpis"]',
            title: 'The Impact Summary',
            description: 'The KPI strip just expanded with the analysis result: total accounts, how many have Balance, Transactions, Custom sub-accounts, or are Clean. The net balance should stay identical before and after migration.',
            icon: createElement(ShieldCheck, { size: 16 }),
            color: 'var(--app-success, #22c55e)',
            placement: 'bottom',
        },
        // 6 — Category sections
        {
            target: '[data-tour="migrate-sections"]',
            title: 'Risk Categories, Expanded',
            description: 'Red = Accounts with Balance (journal entries get remapped). Amber = Accounts with Transactions (zero balance but history exists). Blue = Custom sub-accounts (your additions — e.g. individual employee or contact accounts — that need manual target selection).',
            icon: createElement(FileText, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
            placement: 'top',
        },
        // 7 — Target dropdown + badges
        {
            target: '[data-tour="migrate-sections"]',
            title: 'Mapping Each Account',
            description: 'Each row has a suggested target with a match badge: ✓ Exact (code matches), ↑ Parent (code inherited from parent), ~ Type (same type, different code), or ✗ Manual (no match — you must pick). Use the dropdown to override any suggestion before executing.',
            icon: createElement(MousePointerClick, { size: 16 }),
            color: '#8b5cf6',
            placement: 'top',
        },
        // 8 — Apply button
        {
            target: '[data-tour="migrate-apply-btn"]',
            title: 'Execute — Safely',
            description: 'When you\'re happy, Apply Migration & Import runs atomically: swap the template, remap every journal line using your mapping, sync posting rules, and report remap warnings if any. You\'re redirected to the new COA tree afterward.',
            icon: createElement(Zap, { size: 16 }),
            color: 'var(--app-primary)',
            placement: 'left',
        },
        // 9 — Keyboard
        {
            target: null,
            isWelcome: true,
            title: 'What to Watch For ⚠️',
            description: 'After Apply:\n• Journal lines are remapped — totals stay identical\n• Posting rules re-sync to the new accounts\n• Any remap warnings show up as toasts — review them\n• Your old template is archived; you can restore from backup if needed',
            icon: createElement(Shield, { size: 16 }),
            color: 'var(--app-warning, #f59e0b)',
        },
        // 10 — Complete
        {
            target: null,
            isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'The migration playbook: Pick target → Analyze → Review each category → Override mappings → Apply. Click the ✨ Tour button in the header anytime to replay this guide.',
            icon: createElement(Sparkles, { size: 16 }),
            color: 'var(--app-primary)',
        },
    ],
}

registerTour(migrateTour)
export default migrateTour
