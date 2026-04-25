'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Calendar, Plus, Zap, RefreshCcw, Target } from 'lucide-react'
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
import { CanaryCard } from './_components/CanaryCard'
import { MultiYearCard } from './_components/MultiYearCard'
import { SnapshotBrowserCard } from './_components/SnapshotBrowserCard'
import { TaskSettingsModal } from './_components/TaskSettingsModal'
import { PageTabs, type PageTab } from './_components/PageTabs'
import { useFiscalYears } from './_hooks/useFiscalYears'

export default function FiscalYearsViewer({ initialYears }: { initialYears: Record<string, any>[] }) {
    const fy = useFiscalYears(initialYears)
    const [showTaskSettings, setShowTaskSettings] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    // ── Top-level tab routing ──
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const rawTab = searchParams?.get('tab') as PageTab | null
    const pageTab: PageTab = rawTab && ['years', 'multiyear', 'snapshots', 'integrity'].includes(rawTab) ? rawTab : 'years'

    const setPageTab = useCallback((tab: PageTab) => {
        const params = new URLSearchParams(searchParams?.toString() || '')
        if (tab === 'years') params.delete('tab')
        else params.set('tab', tab)
        const qs = params.toString()
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    }, [searchParams, router, pathname])

    // ── Current period context ──
    const today = useMemo(() => new Date(), [])
    const currentContext = useMemo(() => {
        for (const y of fy.years) {
            const periods: any[] = (y as any).periods || []
            for (const p of periods) {
                if (!p.start_date || !p.end_date) continue
                const s = new Date(p.start_date), e = new Date(p.end_date)
                if (today >= s && today <= e) {
                    const daysToEnd = Math.ceil((e.getTime() - today.getTime()) / 86_400_000)
                    return { year: y, period: p, daysToEnd }
                }
            }
        }
        return null
    }, [fy.years, today])

    const focusCurrentPeriod = () => {
        if (!currentContext) return
        if (pageTab !== 'years') setPageTab('years')
        fy.setExpandedYear(currentContext.year.id)
        setTimeout(() => {
            const node = document.querySelector(`[data-period-id="${currentContext.period.id}"]`)
            if (node) (node as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)
    }

    const doRefresh = async () => {
        setRefreshing(true)
        try { await fy.refreshData() } finally { setRefreshing(false) }
    }

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null
            const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                if (pageTab !== 'years') setPageTab('years')
                const el = document.getElementById('fy-search-input') as HTMLInputElement | null
                el?.focus(); el?.select()
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'q' && !inField) {
                e.preventDefault()
                fy.setFocusMode(prev => !prev)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [fy, pageTab, setPageTab])
    const deepLinkHandled = useRef(false)
    const [pendingReopen, setPendingReopen] = useState<{ periodId: number; periodName: string; yearName: string; fromTask: number | null } | null>(null)

    useEffect(() => {
        if (deepLinkHandled.current) return
        const fromTaskRaw = searchParams?.get('from_task')
        const periodRaw = searchParams?.get('period')
        if (!periodRaw) return
        const periodId = Number(periodRaw)
        if (!Number.isFinite(periodId)) return

        const year = initialYears.find((y: any) => (y.periods || []).some((p: any) => Number(p.id) === periodId))
        if (!year) return
        const period = (year.periods || []).find((p: any) => Number(p.id) === periodId)
        if (!period) return
        deepLinkHandled.current = true
        if (pageTab !== 'years') setPageTab('years')
        fy.setExpandedYear(year.id)
        setTimeout(() => {
            const node = document.querySelector(`[data-period-id="${periodId}"]`)
            if (node) (node as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)
        if (period.status && period.status !== 'OPEN') {
            setPendingReopen({ periodId, periodName: period.name || `Period #${periodId}`, yearName: year.name || '', fromTask: fromTaskRaw ? Number(fromTaskRaw) : null })
        }
    }, [searchParams, initialYears, fy, pageTab, setPageTab])

    const confirmReopen = async () => {
        if (!pendingReopen) return
        const { periodId, periodName, fromTask } = pendingReopen
        const res = await reopenPeriod(periodId)
        if (res.success) {
            toast.success(`${periodName} reopened`)
            if (fromTask) { try { await erpFetch(`tasks/${fromTask}/complete/`, { method: 'POST' }) } catch {} }
            fy.refreshData()
        } else { toast.error(res.error || `Failed to reopen ${periodName}`) }
        setPendingReopen(null)
        try { router.replace(pathname) } catch {}
    }

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>
            {/* ── Header ── */}
            {!fy.focusMode && (
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Calendar size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">Fiscal Years</h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">Accounting Periods & Closing Cycles</p>
                        </div>
                        {currentContext && (
                            <button onClick={focusCurrentPeriod}
                                title={`Jump to ${currentContext.period.name} in ${currentContext.year.name}`}
                                className="flex items-center gap-1.5 text-tp-xs font-bold px-2.5 py-1.5 rounded-xl transition-all hover:brightness-110"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 25%, transparent)',
                                    color: 'var(--app-success, #22c55e)',
                                }}>
                                <Target size={12} />
                                <span className="uppercase tracking-wide">Current:</span>
                                <span className="normal-case">{currentContext.year.name} · {currentContext.period.name}</span>
                                <span className="opacity-70 normal-case">
                                    · {currentContext.daysToEnd <= 0 ? 'ends today' : `${currentContext.daysToEnd} day${currentContext.daysToEnd === 1 ? '' : 's'} left`}
                                </span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={doRefresh} disabled={refreshing || fy.isPending}
                            title="Refresh fiscal years data" aria-label="Refresh"
                            className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-xl transition-all hover:bg-app-surface disabled:opacity-50"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                            <RefreshCcw size={13} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={() => setShowTaskSettings(true)}
                            title="Reminders, routing & auto-task rules for Finance"
                            className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-xl transition-all"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                            <Zap size={13} /> Task Settings
                        </button>
                        <button onClick={fy.openWizard} disabled={fy.isPending}
                            className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-xl transition-all"
                            style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Plus size={13} /> Create Fiscal Year
                        </button>
                    </div>
                </div>
            )}
            {/* ── KPI Strip ── */}
            {!fy.focusMode && <KpiStrip kpis={fy.kpis} statusFilter={fy.statusFilter} setStatusFilter={fy.setStatusFilter} />}

            <PageTabs activeTab={pageTab} onTabChange={setPageTab} focusMode={fy.focusMode} setFocusMode={fy.setFocusMode} />

            <div className="flex-1 min-h-0 flex flex-col">
                {pageTab === 'years' && (
                    <>
                        <Toolbar
                            focusMode={fy.focusMode} setFocusMode={fy.setFocusMode}
                            searchQuery={fy.searchQuery} setSearchQuery={fy.setSearchQuery}
                            statusFilter={fy.statusFilter} setStatusFilter={fy.setStatusFilter}
                            stats={fy.stats} openWizard={fy.openWizard}
                        />
                        <YearsListPanel fy={fy} />
                    </>
                )}
                {pageTab === 'multiyear' && <MultiYearCard fullHeight />}
                {pageTab === 'snapshots' && <SnapshotBrowserCard fullHeight />}
                {pageTab === 'integrity' && <CanaryCard fullHeight />}
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
                    yearId={fy.closePreview.year.id}
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
/** Years List Sub-Panel */
function YearsListPanel({ fy }: { fy: ReturnType<typeof useFiscalYears> }) {
    return (
        <>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl" style={{ border: '1px solid var(--app-border)' }}>
                {fy.filteredYears.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Calendar size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-tp-lg font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                            {fy.years.length === 0 ? 'No fiscal years configured' : fy.searchQuery || fy.statusFilter ? 'No matching fiscal years' : 'No fiscal years'}
                        </p>
                        {fy.years.length === 0 && (
                            <>
                                <p className="text-tp-sm mt-1" style={{ color: 'var(--app-muted-foreground)' }}>Create a year to start recording transactions</p>
                                <button onClick={fy.openWizard} className="mt-4 flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-xl" style={{ background: 'var(--app-primary)', color: 'white' }}>
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
                        onCloseBacklog={() => fy.handleCloseBacklog(year.id)}
                    />
                ))}
            </div>

            {/* ── Stats Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2.5"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', marginTop: '-1px', borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
                <span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-foreground)' }}>
                    {fy.filteredYears.length === fy.years.length ? `${fy.years.length} fiscal years` : `${fy.filteredYears.length} of ${fy.years.length} fiscal years`}
                </span>
                <span className="text-tp-xs font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{fy.stats.totalPeriods} periods · {fy.stats.openPeriods} open</span>
            </div>
        </>
    )
}
