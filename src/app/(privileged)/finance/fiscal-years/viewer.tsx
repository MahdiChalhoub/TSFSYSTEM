'use client'

import { useEffect, useState, useRef } from 'react'
import { Calendar, Plus, Zap, Bell, Loader2, X, ExternalLink, Check, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { reopenPeriod } from '@/app/actions/finance/fiscal-year'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import PeriodEditor from './period-editor'
import { WizardModal } from './_components/WizardModal'
import { DraftAuditModal } from './_components/DraftAuditModal'
import { YearEndCloseModal } from './_components/YearEndCloseModal'
import { KpiStrip } from './_components/KpiStrip'
import { Toolbar } from './_components/Toolbar'
import { YearPanel } from './_components/YearPanel'
import { useFiscalYears } from './_hooks/useFiscalYears'

function TaskSettingsModal({ onClose }: { onClose: () => void }) {
    const [days, setDays] = useState<number>(7)
    const [loadingSettings, setLoadingSettings] = useState(true)
    const [savingSettings, setSavingSettings] = useState(false)
    const [rules, setRules] = useState<any[]>([])
    const [loadingRules, setLoadingRules] = useState(true)
    const [togglingId, setTogglingId] = useState<number | null>(null)

    useEffect(() => {
        erpFetch('settings/item/period_reminder_days_before/')
            .then((v: any) => {
                const n = Number(v)
                if (Number.isFinite(n) && n > 0) setDays(n)
            })
            .catch(() => {})
            .finally(() => setLoadingSettings(false))
    }, [])

    useEffect(() => {
        erpFetch('auto-task-rules/')
            .then((r: any) => {
                const all = Array.isArray(r) ? r : r?.results || []
                setRules(all.filter((x: any) => (x.module || '').toLowerCase() === 'finance'))
            })
            .catch(() => setRules([]))
            .finally(() => setLoadingRules(false))
    }, [])

    const saveLead = async (v: number) => {
        setSavingSettings(true)
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
            setSavingSettings(false)
        }
    }

    const toggleRule = async (rule: any) => {
        setTogglingId(rule.id)
        try {
            await erpFetch(`auto-task-rules/${rule.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !rule.is_active }),
            })
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Toggle failed')
        } finally {
            setTogglingId(null)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Zap size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">Task Settings · Finance</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">Reminders · auto-task rules · routing</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <div className="rounded-xl p-4"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Bell size={13} style={{ color: 'var(--app-primary)' }} />
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)' }}>Reminder Lead-Time</span>
                        </div>
                        <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                            How many days before a period's end/start the reminder task fires.
                        </p>
                        <div className="flex items-center gap-2">
                            <input type="number" min={1} max={60} value={days}
                                disabled={loadingSettings || savingSettings}
                                onChange={e => { const n = Math.max(1, Math.min(60, Number(e.target.value) || 1)); setDays(n) }}
                                onBlur={() => { if (!loadingSettings) saveLead(days) }}
                                className="w-20 text-[13px] font-black tabular-nums px-2 py-1.5 rounded-lg outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>days</span>
                            {savingSettings && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--app-primary)' }} />}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                Finance auto-task rules · {rules.length}
                            </span>
                            <Link href="/workspace/auto-task-rules?module=finance" onClick={onClose}
                                className="flex items-center gap-1 text-[10px] font-bold transition-all"
                                style={{ color: 'var(--app-primary)' }}>
                                Open full editor <ExternalLink size={10} />
                            </Link>
                        </div>
                        <div className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            {loadingRules ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={18} className="animate-spin text-app-primary" />
                                </div>
                            ) : rules.length === 0 ? (
                                <div className="p-4 text-[11px] text-center" style={{ color: 'var(--app-muted-foreground)' }}>
                                    No finance rules yet.{' '}
                                    <Link href="/workspace/auto-task-rules?module=finance" onClick={onClose}
                                        className="font-black underline" style={{ color: 'var(--app-primary)' }}>
                                        Create one
                                    </Link>.
                                </div>
                            ) : rules.map((r, i) => (
                                <div key={r.id}
                                    className={`flex items-center gap-2 px-3 py-2.5 transition-all ${i > 0 ? 'border-t border-app-border/30' : ''} ${!r.is_active ? 'opacity-60' : ''}`}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            {r.code && (
                                                <span className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                    {r.code}
                                                </span>
                                            )}
                                            <span className="text-[12px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{r.name}</span>
                                        </div>
                                        <div className="text-[10px] font-medium truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {r.assign_to_user ? 'Goes to one person'
                                                : r.assign_to_user_group ? 'Goes to a team'
                                                : r.template?.assign_to_role ? 'Routed automatically'
                                                : 'No-one assigned yet'}
                                        </div>
                                    </div>
                                    <button onClick={() => toggleRule(r)} disabled={togglingId === r.id}
                                        title={r.is_active ? 'Disable' : 'Enable'}
                                        className={`w-9 h-4 rounded-full relative transition-all flex-shrink-0 ${r.is_active ? 'bg-app-primary' : 'bg-app-border'}`}>
                                        <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow ${r.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                    <Link href="/workspace/auto-task-rules?module=finance" onClick={onClose}
                                        title="Edit in full editor"
                                        className="p-1 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all flex-shrink-0">
                                        <Pencil size={12} />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl p-3 flex items-center gap-2"
                        style={{ background: 'color-mix(in srgb, var(--app-info) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                        <Check size={13} style={{ color: 'var(--app-info)' }} />
                        <span className="text-[10px] font-medium" style={{ color: 'var(--app-foreground)' }}>
                            For ad-hoc teams, visit{' '}
                            <Link href="/workspace/user-groups" onClick={onClose} className="font-black underline" style={{ color: 'var(--app-info)' }}>
                                User Groups
                            </Link>.
                        </span>
                    </div>
                </div>

                <div className="px-5 py-3 flex items-center justify-end flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-bg))', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose}
                        className="text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function FiscalYearsViewer({ initialYears }: { initialYears: Record<string, any>[] }) {
    const fy = useFiscalYears(initialYears)
    const [showTaskSettings, setShowTaskSettings] = useState(false)

    /** Deep-link from a task: /finance/fiscal-years?from_task=<taskId>&period=<periodId>
     *  Finds the period, expands its year, scrolls to it, offers one-click reopen,
     *  and closes the source task on success. One-shot — runs once per mount. */
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const deepLinkHandled = useRef(false)
    const [pendingReopen, setPendingReopen] = useState<{ periodId: number; periodName: string; yearName: string; fromTask: number | null } | null>(null)

    useEffect(() => {
        if (deepLinkHandled.current) return
        const fromTaskRaw = searchParams?.get('from_task')
        const periodRaw = searchParams?.get('period')
        if (!periodRaw) return
        const periodId = Number(periodRaw)
        if (!Number.isFinite(periodId)) return

        const year = initialYears.find((y: any) =>
            (y.periods || []).some((p: any) => Number(p.id) === periodId)
        )
        if (!year) return
        const period = (year.periods || []).find((p: any) => Number(p.id) === periodId)
        if (!period) return
        deepLinkHandled.current = true

        // Expand the year panel so the period is visible.
        fy.setExpandedYear(year.id)

        // Scroll to the row after the panel expands.
        setTimeout(() => {
            const node = document.querySelector(`[data-period-id="${periodId}"]`)
            if (node) (node as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)

        // Only offer reopen for periods that are actually closed/locked.
        const isClosed = period.status && period.status !== 'OPEN'
        if (isClosed) {
            setPendingReopen({
                periodId,
                periodName: period.name || `Period #${periodId}`,
                yearName: year.name || '',
                fromTask: fromTaskRaw ? Number(fromTaskRaw) : null,
            })
        }
    }, [searchParams, initialYears, fy])

    const confirmReopen = async () => {
        if (!pendingReopen) return
        const { periodId, periodName, fromTask } = pendingReopen
        const res = await reopenPeriod(periodId)
        if (res.success) {
            toast.success(`${periodName} reopened`)
            // If we came from a task, close it automatically — this is the
            // reusable "task follows the user through the action" hook.
            if (fromTask) {
                try {
                    await erpFetch(`tasks/${fromTask}/complete/`, { method: 'POST' })
                } catch { /* non-blocking */ }
            }
            fy.refreshData()
        } else {
            toast.error(res.error || `Failed to reopen ${periodName}`)
        }
        setPendingReopen(null)
        // Strip the query params so a browser back/refresh doesn't re-trigger.
        try { router.replace(pathname) } catch { /* noop */ }
    }

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
                        <button onClick={() => setShowTaskSettings(true)}
                            title="Reminders, routing & auto-task rules for Finance"
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                            <Zap size={13} /> Task Settings
                        </button>
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

            {showTaskSettings && <TaskSettingsModal onClose={() => setShowTaskSettings(false)} />}

            <ConfirmDialog open={pendingReopen !== null}
                onOpenChange={o => { if (!o) setPendingReopen(null) }}
                onConfirm={confirmReopen}
                title={pendingReopen ? `Reopen ${pendingReopen.periodName}?` : ''}
                description={pendingReopen
                    ? `You came from a task linked to this ${pendingReopen.yearName} period. Reopen it now${pendingReopen.fromTask ? ' — the linked task will be marked done' : ''}?`
                    : ''}
                confirmText="Reopen Period"
                variant="warning" />
        </div>
    )
}
