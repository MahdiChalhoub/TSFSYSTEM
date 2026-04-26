'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Calendar, Plus, Zap, Target } from 'lucide-react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { reopenPeriod } from '@/app/actions/finance/fiscal-year'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import PeriodEditor from './period-editor'
import { WizardModal } from './_components/WizardModal'
import { DraftAuditModal } from './_components/DraftAuditModal'
import { YearEndCloseModal } from './_components/YearEndCloseModal'
import { MultiYearCard } from './_components/MultiYearCard'
import { TaskSettingsModal } from './_components/TaskSettingsModal'
import { PageTabs, type PageTab } from './_components/PageTabs'
import { useFiscalYears } from './_hooks/useFiscalYears'
import { YearsListPanel } from './_components/YearsListPanel'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/finance-fiscal-years'

export default function FiscalYearsViewer({ initialYears }: { initialYears: Record<string, any>[] }) {
    const fy = useFiscalYears(initialYears)
    const [showTaskSettings, setShowTaskSettings] = useState(false)

    // ── Top-level tab routing ──
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const rawTab = searchParams?.get('tab') as PageTab | null
    const pageTab: PageTab = rawTab && ['years', 'multiyear'].includes(rawTab) ? rawTab : 'years'

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
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300" style={{ minHeight: 'calc(100dvh - 6rem)' }}>
            {/* ── Header ── */}
            {!fy.focusMode && (
                <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Calendar size={20} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight leading-tight">Fiscal Years</h1>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[11px] md:text-[12px] font-bold text-app-muted-foreground uppercase tracking-widest">Accounting Periods & Closing Cycles</p>
                                {currentContext && (
                                    <button onClick={focusCurrentPeriod}
                                        title={`Jump to ${currentContext.period.name} in ${currentContext.year.name}`}
                                        className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full transition-all hover:brightness-110"
                                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                        <Target size={9} />
                                        {currentContext.period.name} · {currentContext.daysToEnd <= 0 ? 'ends today' : `${currentContext.daysToEnd}d left`}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button data-tour="task-settings-btn" onClick={() => setShowTaskSettings(true)}
                            title="Reminders, routing & auto-task rules for Finance"
                            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Zap size={13} /> Task Settings
                        </button>
                        <button data-tour="create-year-btn" onClick={fy.openWizard} disabled={fy.isPending}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Plus size={14} /> <span className="hidden sm:inline">Create Fiscal Year</span>
                        </button>
                        <PageTour
                            tourId="finance-fiscal-years"
                            stepActions={{
                                // Step indices are wired to the tour definition in
                                // `lib/tours/definitions/finance-fiscal-years.ts` —
                                // change in lockstep if you reorder steps.
                                3: () => {
                                    // Periods tab — make sure a year is open + on Periods
                                    if (pageTab !== 'years') setPageTab('years')
                                    if (fy.years[0]) {
                                        fy.setExpandedYear(fy.years[0].id)
                                        fy.setYearTab(p => ({ ...p, [fy.years[0].id]: 'periods' }))
                                    }
                                },
                                4: () => {
                                    // Summary tab
                                    if (fy.years[0]) {
                                        fy.setExpandedYear(fy.years[0].id)
                                        fy.setYearTab(p => ({ ...p, [fy.years[0].id]: 'summary' }))
                                        fy.loadSummary(fy.years[0].id)
                                    }
                                },
                                5: () => {
                                    // History tab
                                    if (fy.years[0]) {
                                        fy.setYearTab(p => ({ ...p, [fy.years[0].id]: 'history' }))
                                        fy.loadHistory(fy.years[0].id)
                                    }
                                },
                                6: () => {
                                    // Close Entries tab
                                    if (fy.years[0]) {
                                        fy.setYearTab(p => ({ ...p, [fy.years[0].id]: 'entries' }))
                                        fy.loadSummary(fy.years[0].id)
                                    }
                                },
                                7: () => {
                                    // Snapshots tab
                                    if (fy.years[0]) {
                                        fy.setYearTab(p => ({ ...p, [fy.years[0].id]: 'snapshots' }))
                                    }
                                },
                                11: () => {
                                    // Multi-Year tab — top-level page switch
                                    setPageTab('multiyear')
                                },
                            }}
                        />
                    </div>
                </div>
            )}

            <PageTabs activeTab={pageTab} onTabChange={setPageTab} focusMode={fy.focusMode} setFocusMode={fy.setFocusMode} searchQuery={fy.searchQuery} setSearchQuery={fy.setSearchQuery} />

            <div className="flex-1 min-h-0 flex flex-col">
                {pageTab === 'years' && <YearsListPanel fy={fy} />}
                {pageTab === 'multiyear' && <MultiYearCard fullHeight />}
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
