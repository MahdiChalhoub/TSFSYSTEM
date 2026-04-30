'use client'

import { RefObject, ReactNode } from 'react'
import {
    Library, Search, Maximize2, Minimize2, ChevronLeft,
} from 'lucide-react'
import { PageTour } from '@/components/ui/PageTour'

type ActiveView = 'gallery' | 'compare' | 'migration' | 'execution'
type Tab = { id: 'gallery' | 'compare' | 'migration'; label: string; icon: any }

// ── Page Header (hidden in focus mode) ──
export function PageHeader({
    cameFromCOA, router, templates, TABS, activeView, setActiveView, setFocusMode, tourStepActions,
}: {
    cameFromCOA: boolean
    router: { push: (path: string) => void }
    templates: { length: number }
    TABS: Tab[]
    activeView: ActiveView
    setActiveView: (v: ActiveView) => void
    setFocusMode: (v: boolean) => void
    tourStepActions: Record<number, () => void>
}) {
    return (
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-3">
                {cameFromCOA && (
                    <button
                        onClick={() => router.push('/finance/chart-of-accounts')}
                        className="flex items-center gap-1 text-tp-sm font-bold px-2 py-1.5 rounded-xl border transition-all mr-1"
                        style={{
                            color: 'var(--app-muted-foreground)',
                            borderColor: 'var(--app-border)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-foreground)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                    >
                        <ChevronLeft size={14} /> Back
                    </button>
                )}
                <div className="page-header-icon bg-app-primary"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <Library size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">
                        Accounting Standards Library
                    </h1>
                    <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                        {templates.length} Templates · Compare, Migrate & Import
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <div data-tour="templates-tab-bar" className="flex items-center gap-1 p-1 rounded-xl"
                    style={{ background: 'var(--app-surface-2, var(--app-surface))' }}>
                    {TABS.map(tab => {
                        const Icon = tab.icon
                        return (
                            <button key={tab.id} onClick={() => setActiveView(tab.id)}
                                className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-lg transition-all"
                                style={{
                                    background: activeView === tab.id ? 'var(--app-primary)' : 'transparent',
                                    color: activeView === tab.id ? '#fff' : 'var(--app-muted-foreground)',
                                }}>
                                <Icon size={13} /> {tab.label}
                            </button>
                        )
                    })}
                </div>
                <PageTour tourId="finance-coa-templates" stepActions={tourStepActions} />
                <button data-tour="templates-focus-mode-btn" onClick={() => setFocusMode(true)}
                    className="flex items-center gap-1 text-tp-sm font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                    <Maximize2 size={13} />
                </button>
            </div>
        </div>
    )
}

// ── KPI Strip (hidden in focus mode) ──
export function KpiStrip({ kpis }: {
    kpis: { label: string; value: ReactNode; icon: ReactNode; color: string }[]
}) {
    return (
        <div data-tour="templates-kpi-strip" className="mb-4 flex-shrink-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            {kpis.map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                        {s.icon}
                    </div>
                    <div className="min-w-0">
                        <div className="text-tp-xs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                        <div className="text-sm font-bold text-app-foreground tabular-nums">{s.value}</div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ── Toolbar (search + tabs in focus, just search in normal) ──
export function Toolbar({
    focusMode, TABS, activeView, setActiveView, searchRef, searchQuery, setSearchQuery, setFocusMode, tourStepActions,
}: {
    focusMode: boolean
    TABS: Tab[]
    activeView: ActiveView
    setActiveView: (v: ActiveView) => void
    searchRef: RefObject<HTMLInputElement | null>
    searchQuery: string
    setSearchQuery: (v: string) => void
    setFocusMode: (v: boolean) => void
    tourStepActions: Record<number, () => void>
}) {
    return (
        <div data-tour="templates-search-bar" className="flex items-center gap-2 mb-3 flex-shrink-0">
            {focusMode && (
                <>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                            <Library size={14} className="text-white" />
                        </div>
                        <span className="text-tp-md font-bold text-app-foreground hidden sm:inline">Standards Library</span>
                    </div>
                    <div className="flex items-center gap-1 p-0.5 rounded-lg flex-shrink-0"
                        style={{ background: 'var(--app-surface)' }}>
                        {TABS.map(tab => {
                            const Icon = tab.icon
                            return (
                                <button key={tab.id} onClick={() => setActiveView(tab.id)}
                                    className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-md transition-all"
                                    style={{
                                        background: activeView === tab.id ? 'var(--app-primary)' : 'transparent',
                                        color: activeView === tab.id ? '#fff' : 'var(--app-muted-foreground)',
                                    }}>
                                    <Icon size={11} /> {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
            <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, region, key... (Ctrl+K)"
                    className="w-full pl-9 pr-3 py-2 text-tp-md md:text-tp-lg bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" />
            </div>
            {focusMode && (
                <PageTour tourId="finance-coa-templates" stepActions={tourStepActions} />
            )}
            {focusMode && (
                <button onClick={() => setFocusMode(false)}
                    className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                    <Minimize2 size={13} />
                </button>
            )}
        </div>
    )
}

// ── Footer ──
export function PageFooter({
    filteredCount, totalCount, totalAccounts, totalRules, activeView,
}: {
    filteredCount: number
    totalCount: number
    totalAccounts: number
    totalRules: number
    activeView: ActiveView
}) {
    return (
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2.5 mt-0 rounded-b-2xl"
            style={{
                background: 'var(--app-surface)',
                borderTop: '1px solid var(--app-border)',
                borderLeft: '1px solid var(--app-border)',
                borderRight: '1px solid var(--app-border)',
                borderBottom: '1px solid var(--app-border)',
                marginTop: '-1px',
                borderBottomLeftRadius: '1rem',
                borderBottomRightRadius: '1rem',
            }}>
            <div className="flex items-center gap-4">
                <span className="text-tp-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--app-foreground)' }}>
                    {filteredCount} of {totalCount} templates
                </span>
                <span className="text-tp-xs font-bold tabular-nums"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {totalAccounts.toLocaleString()} accounts
                </span>
                <span className="text-tp-xs font-bold tabular-nums"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {totalRules.toLocaleString()} posting rules
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-tp-xxs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{
                        color: 'var(--app-primary)',
                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                    }}>
                    {activeView === 'gallery' ? 'Gallery' : activeView === 'compare' ? 'Compare' : 'Migration'} View
                </span>
            </div>
        </div>
    )
}
