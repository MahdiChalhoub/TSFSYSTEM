import { useState } from 'react'
import { Lock, ShieldCheck, Trash2, Loader2, ArrowRightLeft, FastForward } from 'lucide-react'
import { getStatusStyle } from '../_lib/constants'
import { PeriodsGrid } from './PeriodsGrid'
import { SummaryTab } from './SummaryTab'
import { HistoryTab } from './HistoryTab'
import { CloseChecklistPanel } from './CloseChecklistPanel'
import { SnapshotBrowserCard } from './SnapshotBrowserCard'
import { CanaryCard } from './CanaryCard'
import { CloseEntriesPanel } from './CloseEntriesPanel'
import { PriorPeriodAdjustmentModal } from './PriorPeriodAdjustmentModal'
import type { YearSummary, YearHistoryEvent } from '@/app/actions/finance/fiscal-year'

const TABS = [
    { id: 'periods' as const, label: 'Periods' },
    { id: 'summary' as const, label: 'Summary' },
    { id: 'checklist' as const, label: 'Checklist' },
    { id: 'history' as const, label: 'History' },
    { id: 'entries' as const, label: 'Close Entries' },
    { id: 'snapshots' as const, label: 'Snapshots' },
    { id: 'integrity' as const, label: 'Integrity' },
]

type YearTab = 'periods' | 'summary' | 'checklist' | 'history' | 'entries' | 'snapshots' | 'integrity'

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
    onCloseBacklog: () => void
}

export function YearPanel({
    year, isExpanded, onToggle, activeTab, onTabChange, isPending, closingYearId,
    summary, history, handlePeriodStatus, handlePeriodAction, onSoftClose, onYearEndClose, onDelete, onCloseBacklog,
}: YearPanelProps) {
    const yearStatus = year.isHardLocked ? 'FINALIZED' : (year.status || 'OPEN')
    const ss = getStatusStyle(yearStatus)
    const periods = [...(year.periods || [])].sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
    const openCount = periods.filter((p: any) => (p.status || 'OPEN') === 'OPEN').length
    const isPartial = new Date() < new Date(year.endDate || year.end_date)
    const isClosed = yearStatus === 'CLOSED' || yearStatus === 'FINALIZED'
    const [ppaOpen, setPpaOpen] = useState(false)

    // Backlog = OPEN periods whose end_date is in the past (ready to be closed).
    const todayISO = new Date().toISOString().slice(0, 10)
    const backlogCount = periods.filter((p: any) =>
        (p.status || 'OPEN') === 'OPEN' && p.end_date && p.end_date < todayISO
    ).length

    return (
        <div className="flex flex-col h-full">
            {isExpanded && (
                <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
                    {/* Tab bar + year actions — sticky */}
                    <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--app-border)' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => onTabChange(t.id)}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                                style={{ background: activeTab === t.id ? 'var(--app-primary)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--app-muted-foreground)' }}>
                                {t.label}
                            </button>
                        ))}
                        <div className="flex-1" />
                        {yearStatus === 'OPEN' && backlogCount > 0 && !year.isHardLocked && (
                            <button onClick={onCloseBacklog} disabled={isPending}
                                title={`Sequentially close ${backlogCount} open period${backlogCount === 1 ? '' : 's'} whose end date has passed`}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-all"
                                style={{ color: 'var(--app-info, #3b82f6)', borderColor: 'color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)', background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)' }}>
                                <FastForward size={11} /> Close Backlog ({backlogCount})
                            </button>
                        )}
                        {yearStatus === 'OPEN' && (
                            <button onClick={onSoftClose} disabled={isPending}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-all"
                                style={{ color: 'var(--app-warning, #f59e0b)', borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                                <Lock size={11} /> Soft Close
                            </button>
                        )}
                        {yearStatus === 'OPEN' && (
                            <button onClick={onYearEndClose} disabled={isPending}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-all"
                                title={isPartial ? 'Year not finished yet — will perform partial close and auto-create remainder year' : 'Close fiscal year and post P&L to Retained Earnings'}
                                style={{ color: isPartial ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)', borderColor: isPartial ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' : 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}>
                                {isPending && closingYearId === year.id ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />} {isPartial ? 'Partial Close' : 'Year-End Close'}
                            </button>
                        )}
                        {isClosed && (
                            <button onClick={() => setPpaOpen(true)} disabled={isPending}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-all"
                                title="Post a Prior Period Adjustment — closed year is NOT reopened; P&L impact routes through Retained Earnings"
                                style={{ color: 'var(--app-warning, #f59e0b)', borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                                <ArrowRightLeft size={11} /> PPA
                            </button>
                        )}
                        {year.isHardLocked && (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded"
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

                    {/* Tab content — scrollable */}
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                        {activeTab === 'periods' && (
                            <PeriodsGrid periods={periods} year={year} isPending={isPending} handlePeriodStatus={handlePeriodStatus} handlePeriodAction={handlePeriodAction} />
                        )}
                        {activeTab === 'summary' && <SummaryTab summary={summary} fiscalYearId={year.id} />}
                        {activeTab === 'checklist' && <CloseChecklistPanel fiscalYearId={year.id} />}
                        {activeTab === 'history' && <HistoryTab history={history} />}
                        {activeTab === 'entries' && <CloseEntriesPanel summary={summary} />}
                        {activeTab === 'snapshots' && <SnapshotBrowserCard fullHeight />}
                        {activeTab === 'integrity' && <CanaryCard />}
                    </div>
                </div>
            )}

            {/* Prior Period Adjustment modal — mounted only when invoked */}
            {ppaOpen && (
                <PriorPeriodAdjustmentModal
                    fiscalYearId={year.id}
                    fiscalYearName={year.name}
                    onClose={() => setPpaOpen(false)}
                />
            )}
        </div>
    )
}
