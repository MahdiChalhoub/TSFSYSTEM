/* ═══════════════════════════════════════════════════════════
 *  TOUR: Finance — COA Migrate Workspace (Mobile)
 * ═══════════════════════════════════════════════════════════ */

import { ArrowRightLeft, Sparkles, BarChart3, Zap, Shield, Database, Layers, FileText } from 'lucide-react'
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'

const tour: TourConfig = {
    id: 'finance-coa-migrate-mobile',
    title: 'Migration Workspace (Mobile)',
    module: 'finance',
    description: 'Mobile walkthrough of the COA migration flow.',
    version: 1,
    steps: [
        {
            target: null, isWelcome: true,
            title: 'Welcome to Migration 🔄',
            description: 'Swap your Chart of Accounts from one standard to another — without losing a single journal entry. This tour walks the flow on mobile.',
            icon: createElement(ArrowRightLeft, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: '[data-tour="kpi-strip"]',
            title: 'Current State', placement: 'bottom',
            description: 'Current template, account count, journal entries, and migration-required status. If red/amber shows Migration Required, your book has real data and you must go through this flow.',
            icon: createElement(Database, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: null, isWelcome: true,
            title: 'Pick a Target 🎯',
            description: 'Choose where you want to end up — French PCG, SYSCOHADA, Lebanese PCN, etc. Only templates different from your current one are offered.',
            icon: createElement(Layers, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: null, isWelcome: true,
            title: 'Analyze the Impact',
            description: 'Hitting Analyze scans your accounts and returns a preview: how many have balance, how many have transactions, which are custom, and which are clean. Read-only — nothing is committed yet.',
            icon: createElement(BarChart3, { size: 16 }), color: 'var(--app-info, #3b82f6)',
        },
        {
            target: null, isWelcome: true,
            title: 'Review Risk Categories',
            description: 'Red = With Balance (journal entries remapped). Amber = With Transactions (zero balance but history). Blue = Custom sub-accounts (your additions that need manual mapping). Clean = exist in both templates, migrated automatically.',
            icon: createElement(FileText, { size: 16 }), color: 'var(--app-warning, #f59e0b)',
        },
        {
            target: null, isWelcome: true,
            title: 'Tweak Mappings',
            description: 'Each account has a suggested target. Match badges tell you how confident we are: ✓ Exact, ↑ Parent, ~ Type, ✗ Manual. Tap the target dropdown to override any suggestion.',
            icon: createElement(Sparkles, { size: 16 }), color: '#8b5cf6',
        },
        {
            target: null, isWelcome: true,
            title: 'Apply — Safely',
            description: 'Apply runs atomically: swap the template, remap journal lines using your mapping, sync posting rules, archive the old chart. If anything goes wrong, warnings show up as toasts.',
            icon: createElement(Zap, { size: 16 }), color: 'var(--app-primary)',
        },
        {
            target: null, isWelcome: true,
            title: 'Safety Guarantees ⚠️',
            description: 'Net balance stays identical before/after. Journal entries are never deleted — only remapped. Posting rules re-sync to the new accounts. You\'re redirected to the new COA tree on success.',
            icon: createElement(Shield, { size: 16 }), color: 'var(--app-success, #22c55e)',
        },
        {
            target: null, isWelcome: true,
            title: 'You\'re All Set! 🎉',
            description: 'Pick target → Analyze → Review → Override if needed → Apply. Tap ✨ anytime to replay.',
            icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)',
        },
    ],
}

registerTour(tour)
export default tour
