'use client'

import Link from 'next/link'
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import {
    FileText, Scale, Sigma, Landmark, TrendingUp,
    Clock, Wrench, ArrowRight, Sparkles,
} from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

type IconComp = ComponentType<{ size?: number | string; className?: string }>

interface ReportInfo {
    href: string
    label: string
    description: string
    Icon: IconComp
    color: string
    category?: string
}

/* ═══════════════════════════════════════════════════════════
 *  FINANCE REPORTS HUB
 *  Landing page for the Reports section. Three rows:
 *   1. Core statements (Trial Balance, P&L, Balance Sheet)
 *   2. Analytical reports (Cash Flow, Aging, Statement)
 *   3. Custom / saved (builder + list of user-saved definitions)
 *  Every card is a themed tile using V2 tokens.
 * ═══════════════════════════════════════════════════════════ */

const CORE_REPORTS = [
    {
        href: '/finance/reports/trial-balance',
        label: 'Trial Balance',
        description: 'General-ledger integrity — every debit matches every credit',
        Icon: Scale,
        color: 'var(--app-primary)',
        category: 'Core statement',
    },
    {
        href: '/finance/reports/pnl',
        label: 'Profit & Loss',
        description: 'Income, expenses, margin and net result with period comparison',
        Icon: Sigma,
        color: 'var(--app-success)',
        category: 'Core statement',
    },
    {
        href: '/finance/reports/balance-sheet',
        label: 'Balance Sheet',
        description: 'Assets, liabilities and equity as of a date — identity reconciled',
        Icon: Landmark,
        color: 'var(--app-success)',
        category: 'Core statement',
    },
]

const ANALYTICAL_REPORTS = [
    {
        href: '/finance/reports/cash-flow',
        label: 'Cash Flow',
        description: 'Operating · Investing · Financing activities',
        Icon: TrendingUp,
        color: 'var(--app-info)',
    },
    {
        href: '/finance/reports/aging',
        label: 'Aging',
        description: 'Receivables and payables bucketed by age',
        Icon: Clock,
        color: 'var(--app-warning)',
    },
    {
        href: '/finance/reports/statement',
        label: 'Account Statement',
        description: 'Detailed journal history for a single account',
        Icon: FileText,
        color: '#8b5cf6',
    },
]

export default function ReportsHubPage() {
    const [savedCount, setSavedCount] = useState<number | null>(null)

    useEffect(() => {
        erpFetch('finance/reports/')
            .then((data: unknown) => {
                const list = Array.isArray(data)
                    ? data
                    : ((data && typeof data === 'object' && 'results' in data && Array.isArray((data as { results?: unknown[] }).results))
                        ? ((data as { results: unknown[] }).results)
                        : [])
                setSavedCount(list.length)
            })
            .catch(() => setSavedCount(0))
    }, [])

    return (
        <div className="flex flex-col p-4 md:px-6 md:pt-6 md:pb-8 gap-6 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar"
            style={{ minHeight: 'calc(100dvh - 6rem)' }}>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="page-header-icon"
                        style={{
                            background: 'var(--app-primary)',
                            boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}>
                        <TrendingUp size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black tracking-tight"
                            style={{ color: 'var(--app-foreground)' }}>
                            Financial Reports
                        </h1>
                        <p className="text-tp-xs md:text-tp-sm font-bold uppercase tracking-widest"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Statements · Analytics · Custom builder
                        </p>
                    </div>
                </div>
                <Link href="/finance/reports/builder"
                    className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-2 rounded-xl transition-all"
                    style={{
                        background: 'var(--app-primary)', color: 'white',
                        boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                    }}>
                    <Sparkles size={13} /> Open report builder
                </Link>
            </div>

            {/* Core statements */}
            <Section title="Core statements" subtitle="Required for every accounting period">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {CORE_REPORTS.map(r => <ReportCard key={r.href} report={r} />)}
                </div>
            </Section>

            {/* Analytical */}
            <Section title="Analytical" subtitle="Drill-downs and period analyses">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {ANALYTICAL_REPORTS.map(r => <ReportCard key={r.href} report={r} compact />)}
                </div>
            </Section>

            {/* Custom */}
            <Section title="Custom" subtitle="Build or revisit your own definitions">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Link href="/finance/reports/builder"
                        className="group flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-[1.01]"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                                background: 'var(--app-primary)', color: 'white',
                                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}>
                            <Wrench size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                Report Builder
                            </p>
                            <p className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                Compose custom P&L, ledger slices or cross-period reports.
                            </p>
                        </div>
                        <ArrowRight size={16} className="flex-shrink-0 transition-transform group-hover:translate-x-1"
                            style={{ color: 'var(--app-primary)' }} />
                    </Link>
                    <Link href="/finance/reports/dashboard"
                        className="group flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-[1.01]"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-info) 15%, transparent)',
                                color: 'var(--app-info)',
                            }}>
                            <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                Saved reports
                                {savedCount != null && (
                                    <span className="ml-2 text-tp-xxs font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-info) 10%, transparent)',
                                            color: 'var(--app-info)',
                                        }}>
                                        {savedCount}
                                    </span>
                                )}
                            </p>
                            <p className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                Definitions you or your team have saved for reuse.
                            </p>
                        </div>
                        <ArrowRight size={16} className="flex-shrink-0 transition-transform group-hover:translate-x-1"
                            style={{ color: 'var(--app-muted-foreground)' }} />
                    </Link>
                </div>
            </Section>
        </div>
    )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <div className="flex items-baseline gap-3">
                <h2 className="text-tp-md font-black uppercase tracking-widest"
                    style={{ color: 'var(--app-foreground)' }}>
                    {title}
                </h2>
                <p className="text-tp-xs"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {subtitle}
                </p>
            </div>
            {children}
        </section>
    )
}

function ReportCard({ report, compact }: { report: ReportInfo; compact?: boolean }) {
    const { Icon } = report
    return (
        <Link href={report.href}
            className="group relative flex flex-col gap-3 p-4 rounded-2xl transition-all hover:scale-[1.015] overflow-hidden"
            style={{
                background: `color-mix(in srgb, ${report.color} 5%, var(--app-surface))`,
                border: `1px solid color-mix(in srgb, ${report.color} 20%, transparent)`,
                boxShadow: `0 1px 3px color-mix(in srgb, ${report.color} 10%, transparent)`,
            }}>
            <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.06] pointer-events-none"
                style={{
                    background: `radial-gradient(circle at top right, ${report.color}, transparent 70%)`,
                }} />
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: report.color, color: 'white',
                        boxShadow: `0 4px 12px color-mix(in srgb, ${report.color} 30%, transparent)`,
                    }}>
                    <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    {report.category && (
                        <p className="text-tp-xxs font-black uppercase tracking-widest mb-0.5"
                            style={{ color: report.color }}>
                            {report.category}
                        </p>
                    )}
                    <p className="text-tp-lg font-bold truncate"
                        style={{ color: 'var(--app-foreground)' }}>
                        {report.label}
                    </p>
                </div>
                <ArrowRight size={16}
                    className="flex-shrink-0 transition-transform group-hover:translate-x-1"
                    style={{ color: report.color }} />
            </div>
            {!compact && (
                <p className="text-tp-sm leading-relaxed"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {report.description}
                </p>
            )}
            {compact && (
                <p className="text-tp-xs"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {report.description}
                </p>
            )}
        </Link>
    )
}
