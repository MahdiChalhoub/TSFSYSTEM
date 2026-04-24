import { ChevronDown, ChevronRight, Lock, ShieldCheck, Trash2, Loader2 } from 'lucide-react'
import { getStatusStyle } from '../_lib/constants'
import { PeriodsGrid } from './PeriodsGrid'
import { SummaryTab } from './SummaryTab'
import { HistoryTab } from './HistoryTab'
import { CloseChecklistPanel } from './CloseChecklistPanel'
import type { YearSummary, YearHistoryEvent } from '@/app/actions/finance/fiscal-year'

const TABS = [
    { id: 'periods' as const, label: 'Periods' },
    { id: 'summary' as const, label: 'Summary' },
    { id: 'checklist' as const, label: 'Close Checklist' },
    { id: 'history' as const, label: 'History' },
]

type YearTab = 'periods' | 'summary' | 'checklist' | 'history'

interface YearPanelProps {
    year: Record<string, any>
    isExpanded: boolean
    onToggle: () => void
    activeTab: YearTab
    onTabChange: (tab: YearTab) => void
    isPending: boolean
    closingYearId: number | null
    summary: YearSummary | undefined
    history: { events: YearHistoryEvent[]; je_by_month: { month: string; count: number }[] } | undefined
    // Handlers
    handlePeriodStatus: (periodId: number, newStatus: 'OPEN' | 'CLOSED' | 'FUTURE', yearData?: Record<string, any>) => void
    handlePeriodAction: (periodId: number, action: 'close' | 'softLock' | 'hardLock' | 'reopen', periodName: string) => void
    onSoftClose: () => void
    onYearEndClose: () => void
    onDelete: () => void
}

export function YearPanel({
    year, isExpanded, onToggle, activeTab, onTabChange, isPending, closingYearId,
    summary, history, handlePeriodStatus, handlePeriodAction, onSoftClose, onYearEndClose, onDelete,
}: YearPanelProps) {
    const yearStatus = year.isHardLocked ? 'FINALIZED' : (year.status || 'OPEN')
    const ss = getStatusStyle(yearStatus)
    const periods = [...(year.periods || [])].sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
    const openCount = periods.filter((p: any) => (p.status || 'OPEN') === 'OPEN').length
    const isPartial = new Date() < new Date(year.endDate || year.end_date)

    return (
        <div style={{ borderBottom: '1px solid var(--app-border)' }}>
            {/* Collapse header */}
            <button onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-app-surface/50 text-left"
                style={{ background: isExpanded ? 'var(--app-surface)' : 'transparent' }}>
                {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--app-muted-foreground)' }} /> : <ChevronRight size={14} style={{ color: 'var(--app-muted-foreground)' }} />}
                <div className="flex-1 min-w-0">
                    <div className="text-tp-lg font-bold" style={{ color: 'var(--app-foreground)' }}>{year.name}</div>
                    <div className="text-tp-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                        {new Date(year.startDate).toLocaleDateString()} — {new Date(year.endDate).toLocaleDateString()}
                    </div>
                </div>
                <span className="text-tp-xxs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                <span className="text-tp-xs font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{periods.length} periods · {openCount} open</span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div style={{ background: 'var(--app-bg)' }}>
                    {/* Tab bar + year actions */}
                    <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--app-border)' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => onTabChange(t.id)}
                                className="text-tp-xs font-bold px-2.5 py-1 rounded-lg transition-all"
                                style={{ background: activeTab === t.id ? 'var(--app-primary)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--app-muted-foreground)' }}>
                                {t.label}
                            </button>
                        ))}
                        <div className="flex-1" />
                        {yearStatus === 'OPEN' && (
                            <button onClick={onSoftClose} disabled={isPending}
                                className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-lg border transition-all"
                                style={{ color: 'var(--app-warning, #f59e0b)', borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                                <Lock size={11} /> Soft Close
                            </button>
                        )}
                        {yearStatus === 'OPEN' && (
                            <button onClick={onYearEndClose} disabled={isPending}
                                className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-lg border transition-all"
                                title={isPartial ? 'Year not finished yet — will perform partial close and auto-create remainder year' : 'Close fiscal year and post P&L to Retained Earnings'}
                                style={{ color: isPartial ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)', borderColor: isPartial ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' : 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}>
                                {isPending && closingYearId === year.id ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />} {isPartial ? 'Partial Close' : 'Year-End Close'}
                            </button>
                        )}
                        {year.isHardLocked && (
                            <span className="flex items-center gap-1 text-tp-xxs font-bold uppercase px-2 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                                <ShieldCheck size={10} /> Immutable
                            </span>
                        )}
                        {!year.isHardLocked && (
                            <button onClick={onDelete} disabled={isPending} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--app-muted-foreground)' }}>
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>

                    {/* Tab content */}
                    {activeTab === 'periods' && (
                        <PeriodsGrid periods={periods} year={year} isPending={isPending} handlePeriodStatus={handlePeriodStatus} handlePeriodAction={handlePeriodAction} />
                    )}
                    {activeTab === 'summary' && <SummaryTab summary={summary} fiscalYearId={year.id} />}
                    {activeTab === 'checklist' && <CloseChecklistPanel fiscalYearId={year.id} />}
                    {activeTab === 'history' && <HistoryTab history={history} />}
                </div>
            )}
        </div>
    )
}
