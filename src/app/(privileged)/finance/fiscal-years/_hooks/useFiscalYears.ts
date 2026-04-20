'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import { Calendar, PlayCircle, Lock, Clock, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
    deleteFiscalYear, updatePeriodStatus, closeFiscalYear,
    hardLockFiscalYear, createFiscalYear, getClosePreview,
    getYearSummary, getYearHistory, getDraftAudit,
    closePeriod as closePeriodAction, softLockPeriod, hardLockPeriod, reopenPeriod,
    type ClosePreview, type YearSummary, type YearHistoryEvent, type DraftAuditEntry,
} from '@/app/actions/finance/fiscal-year'
import { notifyPeriodChange } from '@/components/finance/period-warning-banner'
import type { WizardFormData } from '../_components/WizardModal'
import type { UseFiscalYearsReturn } from '../_lib/types'
import { computeWizardDefaults } from '../_lib/wizard-defaults'

export function useFiscalYears(initialYears: Record<string, any>[]): UseFiscalYearsReturn {
    const [isPending, startTransition] = useTransition()
    const [years, setYears] = useState(initialYears)
    const [expandedYear, setExpandedYear] = useState<number | null>(years[0]?.id ?? null)
    const [focusMode, setFocusMode] = useState(false)
    const [showWizard, setShowWizard] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string | null>(null)
    const [editingPeriod, setEditingPeriod] = useState<Record<string, any> | null>(null)
    const [pendingAction, setPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'; yearId?: number } | null>(null)
    const [closePreview, setClosePreview] = useState<ClosePreview | null>(null)
    const [closeStep, setCloseStep] = useState<'preview' | 'result' | null>(null)
    const [closeResult, setCloseResult] = useState<string | null>(null)
    const [closingYearId, setClosingYearId] = useState<number | null>(null)
    const [closeConfirmText, setCloseConfirmText] = useState('')
    const pendingPeriodChange = useRef<{ periodId: number; newStatus: string; period: Record<string, any> } | null>(null)
    const [yearTab, setYearTab] = useState<Record<number, 'periods' | 'summary' | 'history'>>({})
    const [summaryCache, setSummaryCache] = useState<Record<number, YearSummary>>({})
    const [historyCache, setHistoryCache] = useState<Record<number, { events: YearHistoryEvent[]; je_by_month: { month: string; count: number }[] }>>({})
    const [draftAudit, setDraftAudit] = useState<{ drafts: DraftAuditEntry[]; total: number; periodName: string } | null>(null)

    const currentYear = new Date().getFullYear()
    const [wizardData, setWizardData] = useState<WizardFormData>({
        name: `FY ${currentYear}`, startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31`,
        frequency: 'MONTHLY', defaultPeriodStatus: 'OPEN', includeAuditPeriod: true,
    })

    const closeYearEndModal = () => {
        setCloseStep(null); setClosePreview(null); setCloseResult(null); setCloseConfirmText(''); setClosingYearId(null)
    }

    // Listen for period changes from the global banner
    useEffect(() => {
        const handler = async () => {
            try {
                const { getFiscalYears } = await import('@/app/actions/finance/fiscal-year')
                const fresh = await getFiscalYears()
                setYears(Array.isArray(fresh) ? fresh : [])
            } catch { /* silent */ }
        }
        window.addEventListener('tsf:period-change', handler)
        return () => window.removeEventListener('tsf:period-change', handler)
    }, [])

    const stats = useMemo(() => {
        const all = years.flatMap(y => y.periods || [])
        return {
            total: years.length, totalPeriods: all.length,
            openPeriods: all.filter(p => (p.status || 'OPEN') === 'OPEN').length,
            closedPeriods: all.filter(p => (p.status || '') === 'CLOSED').length,
            futurePeriods: all.filter(p => (p.status || '') === 'FUTURE').length,
            lockedYears: years.filter(y => y.isHardLocked).length,
        }
    }, [years])

    const kpis = useMemo(() => [
        { label: 'Fiscal Years', value: stats.total, color: 'var(--app-primary)', icon: Calendar, filterKey: 'ALL' as string | null },
        { label: 'Open Periods', value: stats.openPeriods, color: 'var(--app-success, #22c55e)', icon: PlayCircle, filterKey: 'OPEN' as string | null },
        { label: 'Closed', value: stats.closedPeriods, color: 'var(--app-muted-foreground)', icon: Lock, filterKey: 'CLOSED' as string | null },
        { label: 'Future', value: stats.futurePeriods, color: 'var(--app-info, #3b82f6)', icon: Clock, filterKey: 'FUTURE' as string | null },
        { label: 'Finalized', value: stats.lockedYears, color: 'var(--app-error, #ef4444)', icon: ShieldCheck, filterKey: 'FINALIZED' as string | null },
    ], [stats])

    const filteredYears = useMemo(() => {
        let result = years
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(y => y.name.toLowerCase().includes(q))
        }
        if (statusFilter && statusFilter !== 'ALL') {
            if (statusFilter === 'FINALIZED') {
                result = result.filter(y => y.isHardLocked)
            } else {
                result = result.filter(y => (y.periods || []).some((p: any) => (p.status || 'OPEN') === statusFilter))
            }
        }
        return result
    }, [years, searchQuery, statusFilter])

    const refreshData = async () => {
        try {
            const { getFiscalYears } = await import('@/app/actions/finance/fiscal-year')
            const fresh = await getFiscalYears()
            setYears(Array.isArray(fresh) ? fresh : [])
        } catch (err) {
            toast.error(`Failed to refresh fiscal years: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    const handleCreateYear = async (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const res = await createFiscalYear({
                name: wizardData.name, startDate: new Date(wizardData.startDate), endDate: new Date(wizardData.endDate),
                frequency: wizardData.frequency, defaultPeriodStatus: wizardData.defaultPeriodStatus, includeAuditPeriod: wizardData.includeAuditPeriod,
            })
            if (res.success) {
                toast.success(`Created ${wizardData.name}`); setShowWizard(false); refreshData()
            } else {
                toast.error(res.error || 'Failed to create fiscal year')
            }
        })
    }

    const handlePeriodAction = (periodId: number, action: 'close' | 'softLock' | 'hardLock' | 'reopen', periodName: string) => {
        startTransition(async () => {
            const fn = action === 'close' ? closePeriodAction
                     : action === 'softLock' ? softLockPeriod
                     : action === 'hardLock' ? hardLockPeriod
                     : reopenPeriod
            const result = await fn(periodId)
            if (result.success) {
                toast.success(`${periodName}: ${action}`)
                notifyPeriodChange()
                refreshData()
            } else {
                toast.error(result.error || `Failed to ${action} ${periodName}`)
            }
        })
    }

    const applyPeriodStatus = (periodId: number, newStatus: string, period: Record<string, any>) => {
        const prevStatus = period.status
        const prevIsClosed = !!period.is_closed
        setYears(prev => prev.map(y => ({
            ...y,
            periods: (y.periods || []).map((p: any) =>
                p.id === periodId ? { ...p, status: newStatus, is_closed: newStatus === 'CLOSED' } : p
            ),
        })))
        notifyPeriodChange()
        startTransition(async () => {
            try {
                await updatePeriodStatus(periodId, newStatus)
                toast.success(`${period.name} → ${newStatus}`)
                refreshData()
            } catch (err) {
                setYears(prev => prev.map(y => ({
                    ...y,
                    periods: (y.periods || []).map((p: any) =>
                        p.id === periodId ? { ...p, status: prevStatus, is_closed: prevIsClosed } : p
                    ),
                })))
                notifyPeriodChange()
                toast.error(`Failed to change ${period.name} → ${newStatus}: ${err instanceof Error ? err.message : String(err)}`)
            }
        })
    }

    const handlePeriodStatus = (periodId: number, newStatus: 'OPEN' | 'CLOSED' | 'FUTURE', yearData?: Record<string, any>) => {
        const year = yearData || years.find(y => (y.periods || []).some((p: any) => p.id === periodId))
        if (!year) return
        if (year.isHardLocked) { toast.error(`Cannot modify periods — ${year.name} is permanently locked`); return }

        const periods = [...(year.periods || [])].sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
        const periodIdx = periods.findIndex((p: any) => p.id === periodId)
        const period = periods[periodIdx]
        if (!period) return

        const draftCount = period.draft_je_count || 0
        if ((newStatus === 'CLOSED' || newStatus === 'FUTURE') && draftCount > 0) {
            const fy = yearData || years.find(y => (y.periods || []).some((pp: any) => pp.id === periodId))
            if (fy) {
                startTransition(async () => {
                    const audit = await getDraftAudit(fy.id, periodId)
                    setDraftAudit({ ...audit, periodName: period.name })
                })
            }
            return
        }
        if (newStatus === 'FUTURE' && (period.journal_entry_count || 0) > 0) {
            toast.error(`Cannot set ${period.name} to FUTURE — it has ${period.journal_entry_count} posted journal entries`)
            return
        }
        if (newStatus === 'CLOSED' && periodIdx > 0) {
            const prevPeriod = periods[periodIdx - 1]
            if (prevPeriod && prevPeriod.status === 'OPEN') {
                toast.error(`Cannot close ${period.name} — close ${prevPeriod.name} first (sequential close required)`)
                return
            }
        }

        const txnCount = period.journal_entry_count || 0
        if (newStatus === 'FUTURE' && period.status === 'OPEN') {
            setPendingAction({ type: 'periodChange', yearId: periodId, title: `Set ${period.name} to Future?`,
                description: txnCount > 0 ? `This period has ${txnCount} journal entries. Setting to FUTURE will prevent any new transactions from being posted.` : `This will prevent transactions from being posted to this period until it is reopened.`, variant: 'warning' })
            pendingPeriodChange.current = { periodId, newStatus, period }
            return
        }
        if (newStatus === 'CLOSED' && period.status === 'OPEN') {
            setPendingAction({ type: 'periodChange', yearId: periodId, title: `Close ${period.name}?`,
                description: txnCount > 0 ? `This period has ${txnCount} journal entries. After closing, no more transactions can be posted to this period's date range (${period.start_date} — ${period.end_date}). Existing entries are preserved.` : `After closing, no transactions can be posted to this period. You can reopen it later if needed.`, variant: 'warning' })
            pendingPeriodChange.current = { periodId, newStatus, period }
            return
        }
        applyPeriodStatus(periodId, newStatus, period)
    }

    const confirmAction = () => {
        if (!pendingAction) return
        const { type, yearId } = pendingAction; setPendingAction(null)
        if (type === 'periodChange' && pendingPeriodChange.current) {
            const { periodId, newStatus, period } = pendingPeriodChange.current
            pendingPeriodChange.current = null; applyPeriodStatus(periodId, newStatus, period); return
        }
        startTransition(async () => {
            try {
                if (type === 'delete' && yearId) { await deleteFiscalYear(yearId); toast.success('Year deleted') }
                if (type === 'close' && yearId) { const res = await closeFiscalYear(yearId); if (res?.success === false) { toast.error(res.error || 'Failed'); return }; toast.success('Year soft-closed') }
                if (type === 'hardLock' && yearId) { const res = await hardLockFiscalYear(yearId); if (res?.success === false) { toast.error(res.error || 'Failed'); return }; toast.success('Year-end close complete') }
                refreshData()
            } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)) }
        })
    }

    const openWizard = () => {
        const defaults = computeWizardDefaults(years)
        if (Object.keys(defaults).length > 0) {
            setWizardData(p => ({ ...p, ...defaults }))
        }
        setShowWizard(true)
    }

    const closeWizard = () => setShowWizard(false)

    const loadSummary = (yearId: number) => {
        if (!summaryCache[yearId]) startTransition(async () => { const s = await getYearSummary(yearId); if (s) setSummaryCache(p => ({ ...p, [yearId]: s })) })
    }

    const loadHistory = (yearId: number) => {
        if (!historyCache[yearId]) startTransition(async () => { const h = await getYearHistory(yearId); setHistoryCache(p => ({ ...p, [yearId]: h })) })
    }

    const startYearEndClose = (yearId: number) => {
        setClosingYearId(yearId)
        startTransition(async () => {
            try {
                const p = await getClosePreview(yearId)
                if (p) { setClosePreview(p); setCloseStep('preview') }
                else { setClosingYearId(null); toast.error('Failed to load close preview') }
            } catch (err) {
                setClosingYearId(null)
                toast.error(`Failed to load close preview: ${err instanceof Error ? err.message : String(err)}`)
            }
        })
    }

    const executeYearEndClose = (isPartial: boolean) => {
        if (!closingYearId) return
        startTransition(async () => {
            try {
                let closeDate: string | undefined
                if (isPartial) { const d = new Date(); d.setDate(d.getDate() - 1); closeDate = d.toISOString().split('T')[0] }
                await hardLockFiscalYear(closingYearId, closeDate)
                setCloseStep('result'); setCloseConfirmText('')
                setCloseResult(isPartial
                    ? 'Partial year-end close complete. P&L closed into Retained Earnings. New fiscal year auto-created for the remaining period.'
                    : 'Year-end close completed successfully. P&L accounts closed into Retained Earnings. Opening balances generated for the next year.')
            } catch (err: unknown) {
                setCloseStep('result')
                setCloseResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
            }
        })
    }

    return {
        years, filteredYears, expandedYear, setExpandedYear, focusMode, setFocusMode,
        searchQuery, setSearchQuery, statusFilter, setStatusFilter, isPending,
        stats, kpis, showWizard, wizardData, setWizardData, openWizard, closeWizard, handleCreateYear,
        handlePeriodStatus, handlePeriodAction, editingPeriod, setEditingPeriod,
        pendingAction, setPendingAction, confirmAction,
        yearTab, setYearTab, summaryCache, historyCache, loadSummary, loadHistory,
        closeStep, closePreview, closeResult, closeConfirmText, setCloseConfirmText,
        closingYearId, closeYearEndModal, startYearEndClose, executeYearEndClose,
        draftAudit, setDraftAudit, refreshData,
    }
}
