'use client'

import { useEffect, useState } from 'react'
import { Calendar, Plus, Zap, Bell, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import PeriodEditor from './period-editor'
import { WizardModal } from './_components/WizardModal'
import { DraftAuditModal } from './_components/DraftAuditModal'
import { YearEndCloseModal } from './_components/YearEndCloseModal'
import { KpiStrip } from './_components/KpiStrip'
import { Toolbar } from './_components/Toolbar'
import { YearPanel } from './_components/YearPanel'
import { useFiscalYears } from './_hooks/useFiscalYears'

function ReminderLeadTimeControl() {
    const [days, setDays] = useState<number>(7)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        erpFetch('settings/item/period_reminder_days_before/')
            .then((v: any) => {
                const n = Number(v)
                if (Number.isFinite(n) && n > 0) setDays(n)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const save = async (v: number) => {
        setSaving(true)
        try {
            await erpFetch('settings/item/period_reminder_days_before/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(v),
            })
            toast.success(`Reminder lead-time set to ${v} day${v === 1 ? '' : 's'}`)
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}
            title="How many days before a period's end/start the reminder task fires">
            <Bell size={13} style={{ color: 'var(--app-primary)' }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)' }}>Lead</span>
            <input type="number" min={1} max={60} value={days}
                disabled={loading || saving}
                onChange={e => { const n = Math.max(1, Math.min(60, Number(e.target.value) || 1)); setDays(n) }}
                onBlur={() => { if (!loading) save(days) }}
                className="w-12 text-[12px] font-black tabular-nums px-1.5 py-0.5 rounded-md outline-none"
                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
            <span className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>days</span>
            {saving && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--app-primary)' }} />}
        </div>
    )
}

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
                    <div className="flex items-center gap-2">
                        <ReminderLeadTimeControl />
                        <Link href="/workspace/auto-task-rules?module=finance"
                            title="Auto-task rules for fiscal period events (closing/starting soon, reopen requests)"
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                            <Zap size={13} /> Reminder Rules
                        </Link>
                        <button onClick={fy.openWizard} disabled={fy.isPending}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                            style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Plus size={13} /> Create Fiscal Year
                        </button>
                    </div>
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
