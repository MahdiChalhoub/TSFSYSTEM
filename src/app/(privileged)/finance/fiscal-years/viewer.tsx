'use client'

import { Calendar, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import PeriodEditor from './period-editor'
import { WizardModal } from './_components/WizardModal'
import { DraftAuditModal } from './_components/DraftAuditModal'
import { YearEndCloseModal } from './_components/YearEndCloseModal'
import { KpiStrip } from './_components/KpiStrip'
import { Toolbar } from './_components/Toolbar'
import { YearPanel } from './_components/YearPanel'
import { useFiscalYears } from './_hooks/useFiscalYears'

export default function FiscalYearsViewer({ initialYears }: { initialYears: Record<string, any>[] }) {
    const fy = useFiscalYears(initialYears)

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ── Header ── */}
            {!fy.focusMode && (
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Calendar size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Fiscal Years</h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">Accounting Periods & Closing Cycles</p>
                        </div>
                    </div>
                    <button onClick={fy.openWizard} disabled={fy.isPending}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                        style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Plus size={13} /> Create Fiscal Year
                    </button>
                </div>
            )}

            {/* ── KPI Strip ── */}
            {!fy.focusMode && <KpiStrip kpis={fy.kpis} statusFilter={fy.statusFilter} setStatusFilter={fy.setStatusFilter} />}

            {/* ── Toolbar ── */}
            <Toolbar
                focusMode={fy.focusMode} setFocusMode={fy.setFocusMode}
                searchQuery={fy.searchQuery} setSearchQuery={fy.setSearchQuery}
                statusFilter={fy.statusFilter} setStatusFilter={fy.setStatusFilter}
                stats={fy.stats} openWizard={fy.openWizard}
            />

            {/* ── Year List ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl" style={{ border: '1px solid var(--app-border)' }}>
                {fy.filteredYears.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Calendar size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-[13px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                            {fy.years.length === 0 ? 'No fiscal years configured' : fy.searchQuery || fy.statusFilter ? 'No matching fiscal years' : 'No fiscal years'}
                        </p>
                        {fy.years.length === 0 && (
                            <>
                                <p className="text-[11px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>Create a year to start recording transactions</p>
                                <button onClick={fy.openWizard} className="mt-4 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl" style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    <Plus size={13} /> Create First Year
                                </button>
                            </>
                        )}
                    </div>
                ) : fy.filteredYears.map(year => (
                    <YearPanel
                        key={year.id}
                        year={year}
                        isExpanded={fy.expandedYear === year.id}
                        onToggle={() => fy.setExpandedYear(fy.expandedYear === year.id ? null : year.id)}
                        activeTab={fy.yearTab[year.id] || 'periods'}
                        onTabChange={tab => {
                            fy.setYearTab(prev => ({ ...prev, [year.id]: tab }))
                            if (tab === 'summary') fy.loadSummary(year.id)
                            if (tab === 'history') fy.loadHistory(year.id)
                        }}
                        isPending={fy.isPending}
                        closingYearId={fy.closingYearId}
                        summary={fy.summaryCache[year.id]}
                        history={fy.historyCache[year.id]}
                        handlePeriodStatus={fy.handlePeriodStatus}
                        handlePeriodAction={fy.handlePeriodAction}
                        onSoftClose={() => fy.setPendingAction({ type: 'close', yearId: year.id, title: 'Soft Close?', description: 'Closes all periods. No P&L closing.', variant: 'warning' })}
                        onYearEndClose={() => fy.startYearEndClose(year.id)}
                        onDelete={() => fy.setPendingAction({ type: 'delete', yearId: year.id, title: 'Delete Fiscal Year?', description: 'Permanently remove this year and all periods.', variant: 'danger' })}
                    />
                ))}
            </div>

            {/* ── Stats Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2.5"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', marginTop: '-1px', borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                    {fy.filteredYears.length === fy.years.length ? `${fy.years.length} fiscal years` : `${fy.filteredYears.length} of ${fy.years.length} fiscal years`}
                </span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{fy.stats.totalPeriods} periods · {fy.stats.openPeriods} open</span>
            </div>

            {/* ── Modals ── */}
            {fy.showWizard && <WizardModal data={fy.wizardData} setData={fy.setWizardData} onClose={fy.closeWizard} onSubmit={fy.handleCreateYear} isPending={fy.isPending} />}
            {fy.editingPeriod && <PeriodEditor period={fy.editingPeriod} onClose={() => { fy.setEditingPeriod(null); fy.refreshData() }} />}
            {fy.draftAudit && <DraftAuditModal data={fy.draftAudit} onClose={() => fy.setDraftAudit(null)} />}

            <ConfirmDialog open={fy.pendingAction !== null} onOpenChange={o => { if (!o) fy.setPendingAction(null) }} onConfirm={fy.confirmAction}
                title={fy.pendingAction?.title ?? ''} description={fy.pendingAction?.description ?? ''} confirmText="Confirm" variant={fy.pendingAction?.variant ?? 'danger'} />

            {fy.closeStep && fy.closePreview && (
                <YearEndCloseModal
                    closeStep={fy.closeStep} closePreview={fy.closePreview} closeResult={fy.closeResult}
                    closeConfirmText={fy.closeConfirmText} setCloseConfirmText={fy.setCloseConfirmText}
                    isPending={fy.isPending} onClose={fy.closeYearEndModal}
                    onDone={() => { fy.closeYearEndModal(); fy.refreshData() }}
                    onExecute={fy.executeYearEndClose}
                />
            )}
        </div>
    )
}
