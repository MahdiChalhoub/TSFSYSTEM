'use client'

import { useEffect } from 'react'
import { Calendar, Plus } from 'lucide-react'
import { YearPanel } from './YearPanel'
import { getStatusStyle } from '../_lib/constants'
import type { useFiscalYears } from '../_hooks/useFiscalYears'

/** Master-Detail Split: left = year cards, right = selected year detail */
export function YearsListPanel({ fy }: { fy: ReturnType<typeof useFiscalYears> }) {
    const selectedYear = fy.filteredYears.find(y => y.id === fy.expandedYear)

    // Auto-select the first year when nothing is selected
    useEffect(() => {
        if (!fy.expandedYear && fy.filteredYears.length > 0) {
            fy.setExpandedYear(fy.filteredYears[0].id)
        }
    }, [fy.filteredYears, fy.expandedYear, fy.setExpandedYear])

    if (fy.filteredYears.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex items-center justify-center rounded-2xl" style={{ border: '1px solid var(--app-border)' }}>
                <div className="text-center py-20">
                    <Calendar size={36} className="text-app-muted-foreground mb-3 opacity-40 mx-auto" />
                    <p className="text-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                        {fy.years.length === 0 ? 'No fiscal years configured' : 'No matching fiscal years'}
                    </p>
                    {fy.years.length === 0 && (
                        <>
                            <p className="text-[11px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>Create a year to start recording transactions</p>
                            <button onClick={fy.openWizard} className="mt-4 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl mx-auto" style={{ background: 'var(--app-primary)', color: 'white' }}>
                                <Plus size={13} /> Create First Year
                            </button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 min-h-0 flex gap-3">
            {/* ── Left: Year Cards ── */}
            <div className="w-52 md:w-60 flex-shrink-0 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                {fy.filteredYears.map(year => {
                    const isSelected = fy.expandedYear === year.id
                    const status = year.isHardLocked ? 'FINALIZED' : (year.status || 'OPEN')
                    const ss = getStatusStyle(status)
                    const periods: any[] = year.periods || []
                    const openCount = periods.filter((p: any) => (p.status || 'OPEN') === 'OPEN').length
                    return (
                        <button key={year.id}
                            onClick={() => fy.setExpandedYear(year.id)}
                            className="w-full text-left px-3 py-2.5 transition-all"
                            style={{
                                background: isSelected ? 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))' : 'transparent',
                                borderLeft: isSelected ? '3px solid var(--app-primary)' : '3px solid transparent',
                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[13px] font-bold truncate" style={{ color: isSelected ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                    {year.name}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: ss.bg, color: ss.color }}>
                                    {ss.label}
                                </span>
                            </div>
                            <div className="text-[11px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                {new Date(year.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} – {new Date(year.endDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                            </div>
                            <div className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                {periods.length} periods · {openCount} open
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* ── Right: Selected Year Detail ── */}
            <div className="flex-1 min-w-0 rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid var(--app-border)' }}>
                {selectedYear ? (
                    <YearPanel
                        year={selectedYear}
                        isExpanded={true}
                        onToggle={() => {}}
                        activeTab={fy.yearTab[selectedYear.id] || 'periods'}
                        onTabChange={tab => {
                            fy.setYearTab(prev => ({ ...prev, [selectedYear.id]: tab }))
                            if (tab === 'summary') fy.loadSummary(selectedYear.id)
                            if (tab === 'history') fy.loadHistory(selectedYear.id)
                        }}
                        isPending={fy.isPending}
                        closingYearId={fy.closingYearId}
                        summary={fy.summaryCache[selectedYear.id]}
                        history={fy.historyCache[selectedYear.id]}
                        handlePeriodStatus={fy.handlePeriodStatus}
                        handlePeriodAction={fy.handlePeriodAction}
                        onSoftClose={() => fy.setPendingAction({ type: 'close', yearId: selectedYear.id, title: 'Soft Close?', description: 'Closes all periods. No P&L closing.', variant: 'warning' })}
                        onYearEndClose={() => fy.startYearEndClose(selectedYear.id)}
                        onDelete={() => fy.setPendingAction({ type: 'delete', yearId: selectedYear.id, title: 'Delete Fiscal Year?', description: 'Permanently remove this year and all periods.', variant: 'danger' })}
                        onCloseBacklog={() => fy.handleCloseBacklog(selectedYear.id)}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Select a fiscal year</p>
                    </div>
                )}
            </div>
        </div>
    )
}
