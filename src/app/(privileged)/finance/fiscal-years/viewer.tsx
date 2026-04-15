'use client'

import { useState, useMemo, useRef, useTransition } from 'react'
import {
    Calendar, Plus, CheckCircle2, Clock, Lock, Search,
    PlayCircle, ShieldCheck, Trash2, AlertTriangle, TrendingUp, TrendingDown,
    Maximize2, Minimize2, X, Loader2, ChevronDown, ChevronRight, ArrowRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    deleteFiscalYear, updatePeriodStatus, closeFiscalYear,
    hardLockFiscalYear, createFiscalYear, getClosePreview,
    type ClosePreview,
} from '@/app/actions/finance/fiscal-year'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import PeriodEditor from './period-editor'

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    OPEN:      { color: 'var(--app-success, #22c55e)', bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', label: 'Open' },
    CLOSED:    { color: 'var(--app-muted-foreground)',  bg: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',  label: 'Closed' },
    FUTURE:    { color: 'var(--app-info, #3b82f6)',     bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',     label: 'Future' },
    FINALIZED: { color: 'var(--app-error, #ef4444)',    bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',    label: 'Finalized' },
}
const getStatusStyle = (s: string) => STATUS_STYLE[s] || STATUS_STYLE.OPEN

export default function FiscalYearsViewer({ initialYears }: { initialYears: Record<string, any>[] }) {
    const router = useRouter()
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
    const pendingPeriodChange = useRef<{ periodId: number; newStatus: string; period: Record<string, any> } | null>(null)

    const currentYear = new Date().getFullYear()
    const lastYear = years[0] || null
    const [wizardData, setWizardData] = useState({
        name: `FY ${currentYear}`, startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31`,
        frequency: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY', defaultPeriodStatus: 'OPEN' as 'OPEN' | 'FUTURE', includeAuditPeriod: true,
    })

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

    const kpis = [
        { label: 'Fiscal Years', value: stats.total, color: 'var(--app-primary)', icon: <Calendar size={14} />, filterKey: 'ALL' as string | null },
        { label: 'Open Periods', value: stats.openPeriods, color: 'var(--app-success, #22c55e)', icon: <PlayCircle size={14} />, filterKey: 'OPEN' as string | null },
        { label: 'Closed', value: stats.closedPeriods, color: 'var(--app-muted-foreground)', icon: <Lock size={14} />, filterKey: 'CLOSED' as string | null },
        { label: 'Future', value: stats.futurePeriods, color: 'var(--app-info, #3b82f6)', icon: <Clock size={14} />, filterKey: 'FUTURE' as string | null },
        { label: 'Finalized', value: stats.lockedYears, color: 'var(--app-error, #ef4444)', icon: <ShieldCheck size={14} />, filterKey: 'FINALIZED' as string | null },
    ]

    // ── Filter years ──
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
                // Filter years that have periods matching the status
                result = result.filter(y => (y.periods || []).some((p: any) => (p.status || 'OPEN') === statusFilter))
            }
        }
        return result
    }, [years, searchQuery, statusFilter])

    const refreshData = () => { window.location.reload() }

    const handleCreateYear = async (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            try {
                await createFiscalYear({
                    name: wizardData.name, startDate: new Date(wizardData.startDate), endDate: new Date(wizardData.endDate),
                    frequency: wizardData.frequency, defaultPeriodStatus: wizardData.defaultPeriodStatus, includeAuditPeriod: wizardData.includeAuditPeriod,
                })
                toast.success(`Created ${wizardData.name}`); setShowWizard(false); refreshData()
            } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)) }
        })
    }

    /** Validate and apply period status change */
    const handlePeriodStatus = (periodId: number, newStatus: 'OPEN' | 'CLOSED' | 'FUTURE', yearData?: Record<string, any>) => {
        // Find the year and period
        const year = yearData || years.find(y => (y.periods || []).some((p: any) => p.id === periodId))
        if (!year) return
        const periods = [...(year.periods || [])].sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
        const periodIdx = periods.findIndex((p: any) => p.id === periodId)
        const period = periods[periodIdx]
        if (!period) return

        // ── Rule 1: Can't CLOSE or FUTURE if draft JEs exist ──
        const draftCount = period.draft_je_count || 0
        const draftRefs = period.draft_je_refs || []
        if ((newStatus === 'CLOSED' || newStatus === 'FUTURE') && draftCount > 0) {
            const refList = draftRefs.length > 0 ? draftRefs.join(', ') : ''
            toast.error(
                `Cannot ${newStatus === 'CLOSED' ? 'close' : 'set to future'} ${period.name} — ${draftCount} draft journal ${draftCount === 1 ? 'entry' : 'entries'} must be posted or deleted first${refList ? ': ' + refList : ''}`,
                { duration: 8000 }
            )
            return
        }

        // ── Rule 2: Can't set FUTURE if period has posted transactions ──
        if (newStatus === 'FUTURE' && (period.journal_entry_count || 0) > 0) {
            toast.error(`Cannot set ${period.name} to FUTURE — it has ${period.journal_entry_count} posted journal entries`)
            return
        }

        // ── Rule 3: Can't close if previous period is still OPEN ──
        if (newStatus === 'CLOSED' && periodIdx > 0) {
            const prevPeriod = periods[periodIdx - 1]
            if (prevPeriod && prevPeriod.status === 'OPEN') {
                toast.error(`Cannot close ${period.name} — close ${prevPeriod.name} first (sequential close required)`)
                return
            }
        }

        // ── Warnings that need confirmation ──
        const txnCount = period.journal_entry_count || 0

        // OPEN → FUTURE: warn — no more posting allowed
        if (newStatus === 'FUTURE' && period.status === 'OPEN') {
            setPendingAction({
                type: 'periodChange', yearId: periodId,
                title: `Set ${period.name} to Future?`,
                description: txnCount > 0
                    ? `This period has ${txnCount} journal entries. Setting to FUTURE will prevent any new transactions from being posted.`
                    : `This will prevent transactions from being posted to this period until it is reopened.`,
                variant: 'warning',
            })
            pendingPeriodChange.current = { periodId, newStatus, period }
            return
        }

        // OPEN → CLOSED: warn about what it means
        if (newStatus === 'CLOSED' && period.status === 'OPEN') {
            setPendingAction({
                type: 'periodChange', yearId: periodId,
                title: `Close ${period.name}?`,
                description: txnCount > 0
                    ? `This period has ${txnCount} journal entries. After closing, no more transactions can be posted to this period's date range (${period.start_date} — ${period.end_date}). Existing entries are preserved.`
                    : `After closing, no transactions can be posted to this period. You can reopen it later if needed.`,
                variant: 'warning',
            })
            pendingPeriodChange.current = { periodId, newStatus, period }
            return
        }

        // All other transitions — apply directly
        applyPeriodStatus(periodId, newStatus, period)
    }

    /** Apply period status after validation/confirmation */
    const applyPeriodStatus = (periodId: number, newStatus: string, period: Record<string, any>) => {
        setYears(prev => prev.map(y => ({
            ...y,
            periods: (y.periods || []).map((p: any) =>
                p.id === periodId ? { ...p, status: newStatus, is_closed: newStatus === 'CLOSED' } : p
            ),
        })))
        startTransition(async () => {
            try {
                await updatePeriodStatus(periodId, newStatus)
                toast.success(`${period.name} → ${newStatus}`)
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : String(err))
                refreshData()
            }
        })
    }

    const confirmAction = () => {
        if (!pendingAction) return
        const { type, yearId } = pendingAction; setPendingAction(null)

        // Handle period status change confirmation
        if (type === 'periodChange' && pendingPeriodChange.current) {
            const { periodId, newStatus, period } = pendingPeriodChange.current
            pendingPeriodChange.current = null
            applyPeriodStatus(periodId, newStatus, period)
            return
        }

        startTransition(async () => {
            try {
                if (type === 'delete' && yearId) { await deleteFiscalYear(yearId); toast.success('Year deleted') }
                if (type === 'close' && yearId) { await closeFiscalYear(yearId); toast.success('Year soft-closed') }
                if (type === 'hardLock' && yearId) { await hardLockFiscalYear(yearId); toast.success('Year-end close complete — P&L closed, opening balances generated') }
                refreshData()
            } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)) }
        })
    }

    const openWizard = () => {
        if (lastYear) {
            const ns = new Date(new Date(lastYear.endDate)); ns.setDate(ns.getDate() + 1)
            const ne = new Date(ns); ne.setFullYear(ne.getFullYear() + 1); ne.setDate(ne.getDate() - 1)
            setWizardData(p => ({ ...p, name: `FY ${ns.getFullYear()}`, startDate: ns.toISOString().split('T')[0], endDate: ne.toISOString().split('T')[0] }))
        }
        setShowWizard(true)
    }

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>

            {!focusMode && (
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
                    <button onClick={openWizard} disabled={isPending}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                        style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Plus size={13} /> Create Fiscal Year
                    </button>
                </div>
            )}

            {!focusMode && (
                <div className="flex-shrink-0 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                    {kpis.map(k => {
                        const isActive = statusFilter === k.filterKey || (k.filterKey === 'ALL' && statusFilter === null)
                        return (
                            <button key={k.label}
                                onClick={() => {
                                    if (k.filterKey === 'ALL' || statusFilter === k.filterKey) setStatusFilter(null)
                                    else setStatusFilter(k.filterKey)
                                }}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                style={{
                                    background: isActive ? `color-mix(in srgb, ${k.color} 8%, var(--app-surface))` : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: isActive ? `2px solid color-mix(in srgb, ${k.color} 40%, transparent)` : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    cursor: 'pointer',
                                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                                }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: `color-mix(in srgb, ${k.color} ${isActive ? '18' : '10'}%, transparent)`, color: k.color }}>{k.icon}</div>
                                <div className="min-w-0">
                                    <div className="text-[9px] font-bold uppercase tracking-wider truncate"
                                        style={{ color: isActive ? k.color : 'var(--app-muted-foreground)' }}>{k.label}</div>
                                    <div className="text-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{k.value}</div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* ── Current Month Alert ── */}
            {(() => {
                const today = new Date()
                // Find the period that contains today
                for (const y of years) {
                    for (const p of (y.periods || [])) {
                        const start = new Date(p.start_date)
                        const end = new Date(p.end_date)
                        if (today >= start && today <= end && p.status !== 'OPEN') {
                            return (
                                <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 mb-3 rounded-xl animate-in fade-in"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                                    <AlertTriangle size={15} style={{ color: 'var(--app-warning, #f59e0b)', flexShrink: 0 }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold" style={{ color: 'var(--app-foreground)' }}>
                                            Current period <strong>{p.name}</strong> is <strong>{p.status}</strong> — transactions cannot be posted
                                        </div>
                                        <div className="text-[9px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {start.toLocaleDateString()} — {end.toLocaleDateString()}
                                        </div>
                                    </div>
                                    <button onClick={() => handlePeriodStatus(p.id, 'OPEN', y)} disabled={isPending}
                                        className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                                        style={{ background: 'var(--app-success, #22c55e)', color: 'white' }}>
                                        {isPending ? <Loader2 size={11} className="animate-spin" /> : <PlayCircle size={11} />} Open Now
                                    </button>
                                </div>
                            )
                        }
                    }
                }
                return null
            })()}

            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                {focusMode && (
                    <div className="flex items-center gap-2 flex-shrink-0 mr-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)', color: 'var(--app-primary)' }}>
                            <Calendar size={12} /> {stats.total} years
                        </div>
                        {statusFilter && (
                            <button onClick={() => setStatusFilter(null)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)', color: 'var(--app-primary)' }}>
                                {statusFilter} <X size={10} />
                            </button>
                        )}
                    </div>
                )}
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search fiscal years..."
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] rounded-xl outline-none transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.background = 'var(--app-surface)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
                </div>
                {focusMode && (
                    <button onClick={openWizard} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
                        style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)' }}>
                        <Plus size={11} /> New
                    </button>
                )}
                <button onClick={() => setFocusMode(p => !p)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-all flex-shrink-0 text-[11px] font-bold"
                    style={{ color: focusMode ? 'var(--app-primary)' : 'var(--app-muted-foreground)', borderColor: focusMode ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'var(--app-border)', background: focusMode ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)' : 'transparent' }}>
                    {focusMode ? <><Minimize2 size={13} /> Exit</> : <Maximize2 size={13} />}
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl" style={{ border: '1px solid var(--app-border)' }}>
                {filteredYears.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Calendar size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-[13px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                            {years.length === 0 ? 'No fiscal years configured' : searchQuery || statusFilter ? 'No matching fiscal years' : 'No fiscal years'}
                        </p>
                        {years.length === 0 && (
                            <>
                                <p className="text-[11px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>Create a year to start recording transactions</p>
                                <button onClick={openWizard} className="mt-4 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl" style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    <Plus size={13} /> Create First Year
                                </button>
                            </>
                        )}
                    </div>
                ) : filteredYears.map((year, idx) => {
                    const isExpanded = expandedYear === year.id
                    const yearStatus = year.isHardLocked ? 'FINALIZED' : (year.status || 'OPEN')
                    const ss = getStatusStyle(yearStatus)
                    const periods = [...(year.periods || [])].sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
                    const openCount = periods.filter((p: any) => (p.status || 'OPEN') === 'OPEN').length
                    return (
                        <div key={year.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <button onClick={() => setExpandedYear(isExpanded ? null : year.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-app-surface/50 text-left"
                                style={{ background: isExpanded ? 'var(--app-surface)' : 'transparent' }}>
                                {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--app-muted-foreground)' }} /> : <ChevronRight size={14} style={{ color: 'var(--app-muted-foreground)' }} />}
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-black" style={{ color: 'var(--app-foreground)' }}>{year.name}</div>
                                    <div className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {new Date(year.startDate).toLocaleDateString()} — {new Date(year.endDate).toLocaleDateString()}
                                    </div>
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                                <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{periods.length} periods · {openCount} open</span>
                            </button>

                            {isExpanded && (
                                <div style={{ background: 'var(--app-bg)' }}>
                                    <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                        {yearStatus === 'OPEN' && (
                                            <button onClick={() => setPendingAction({ type: 'close', yearId: year.id, title: 'Soft Close?', description: 'Closes all periods. You can still reopen them if needed. No P&L closing or balance transfer.', variant: 'warning' })}
                                                disabled={isPending} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all"
                                                style={{ color: 'var(--app-warning, #f59e0b)', borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                                                <Lock size={11} /> Soft Close
                                            </button>
                                        )}
                                        {yearStatus === 'OPEN' && (
                                            <button onClick={() => {
                                                setClosingYearId(year.id)
                                                startTransition(async () => {
                                                    const preview = await getClosePreview(year.id)
                                                    if (preview) { setClosePreview(preview); setCloseStep('preview') }
                                                    else toast.error('Failed to load close preview')
                                                })
                                            }}
                                                disabled={isPending} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all"
                                                style={{ color: 'var(--app-error, #ef4444)', borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}>
                                                {isPending && closingYearId === year.id ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />} Year-End Close
                                            </button>
                                        )}
                                        {year.isHardLocked && (
                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded"
                                                style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                                                <ShieldCheck size={10} /> Immutable
                                            </span>
                                        )}
                                        <div className="flex-1" />
                                        {!year.isHardLocked && (
                                            <button onClick={() => setPendingAction({ type: 'delete', yearId: year.id, title: 'Delete Fiscal Year?', description: 'Permanently remove this year and all periods.', variant: 'danger' })}
                                                disabled={isPending} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--app-muted-foreground)' }}>
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                                        {periods.map((p: Record<string, any>, pidx: number) => {
                                            const pStatus = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                                            const ps = getStatusStyle(pStatus)
                                            const pLabel = p.name || `P${String(pidx + 1).padStart(2, '0')}`
                                            const monthLabel = p.start_date ? new Date(p.start_date).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : ''
                                            return (
                                                <div key={p.id} className="rounded-xl p-2.5 text-center transition-all" style={{ background: ps.bg, border: `1px solid ${ps.color}20` }}>
                                                    <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{pLabel}</div>
                                                    <div className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--app-foreground)' }}>{monthLabel}</div>
                                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.color}30` }}>{pStatus}</span>
                                                    {!year.isHardLocked && (
                                                        <div className="flex items-center justify-center gap-1 mt-1.5">
                                                            <button onClick={() => handlePeriodStatus(p.id, 'OPEN')} title="Open" disabled={isPending || pStatus === 'OPEN'}
                                                                className="p-1 rounded-lg transition-all disabled:opacity-30"
                                                                style={{ color: pStatus === 'OPEN' ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                                                                <PlayCircle size={13} />
                                                            </button>
                                                            <button onClick={() => handlePeriodStatus(p.id, 'CLOSED')} title="Close" disabled={isPending || pStatus === 'CLOSED'}
                                                                className="p-1 rounded-lg transition-all disabled:opacity-30"
                                                                style={{ color: pStatus === 'CLOSED' ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                                                <Lock size={13} />
                                                            </button>
                                                            <button onClick={() => handlePeriodStatus(p.id, 'FUTURE')} title="Future" disabled={isPending || pStatus === 'FUTURE'}
                                                                className="p-1 rounded-lg transition-all disabled:opacity-30"
                                                                style={{ color: pStatus === 'FUTURE' ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)' }}>
                                                                <Clock size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2.5"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', marginTop: '-1px', borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                    {filteredYears.length === years.length ? `${years.length} fiscal years` : `${filteredYears.length} of ${years.length} fiscal years`}
                </span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{stats.totalPeriods} periods · {stats.openPeriods} open</span>
            </div>

            {/* Wizard Modal */}
            {showWizard && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="px-5 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                                    <Calendar size={16} style={{ color: 'var(--app-primary)' }} />
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-black" style={{ color: 'var(--app-foreground)' }}>Create Fiscal Year</h2>
                                    <p className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Configure periods and timeline</p>
                                </div>
                            </div>
                            <button onClick={() => setShowWizard(false)} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--app-muted-foreground)' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleCreateYear} className="p-5 space-y-4">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Year Name</label>
                                <input value={wizardData.name} onChange={e => setWizardData({ ...wizardData, name: e.target.value })}
                                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-[12px] font-medium text-app-foreground outline-none focus:border-app-primary" required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Start Date</label>
                                    <input type="date" value={wizardData.startDate} onChange={e => {
                                        const s = new Date(e.target.value); const en = new Date(s); en.setFullYear(en.getFullYear() + 1); en.setDate(en.getDate() - 1)
                                        setWizardData({ ...wizardData, startDate: e.target.value, endDate: en.toISOString().split('T')[0] })
                                    }} className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-[12px] font-medium text-app-foreground outline-none" required />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>End Date</label>
                                    <input type="date" value={wizardData.endDate} onChange={e => setWizardData({ ...wizardData, endDate: e.target.value })}
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-[12px] font-medium text-app-foreground outline-none" required />
                                </div>
                            </div>
                            <div className="rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)' }}>
                                <div className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--app-info, #3b82f6)' }}>Period Strategy</div>
                                <div className="flex gap-3 mb-3">
                                    {(['MONTHLY', 'QUARTERLY'] as const).map(f => (
                                        <label key={f} className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="freq" checked={wizardData.frequency === f} onChange={() => setWizardData({ ...wizardData, frequency: f })} className="accent-[var(--app-primary)]" />
                                            <span className="text-[11px] font-bold" style={{ color: 'var(--app-foreground)' }}>{f === 'MONTHLY' ? 'Monthly (12)' : 'Quarterly (4)'}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="mb-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Initial Status</label>
                                    <select value={wizardData.defaultPeriodStatus} onChange={e => setWizardData({ ...wizardData, defaultPeriodStatus: e.target.value as any })}
                                        className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-[11px] font-medium text-app-foreground outline-none">
                                        <option value="OPEN">OPEN — Active immediately</option>
                                        <option value="FUTURE">FUTURE — Locked until needed</option>
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={wizardData.includeAuditPeriod} onChange={e => setWizardData({ ...wizardData, includeAuditPeriod: e.target.checked })} className="accent-[var(--app-primary)] rounded" />
                                    <span className="text-[10px] font-bold" style={{ color: 'var(--app-foreground)' }}>Include Audit Period (13th Month)</span>
                                </label>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setShowWizard(false)} className="flex-1 py-2 text-[11px] font-bold rounded-xl border transition-all" style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>Cancel</button>
                                <button type="submit" disabled={isPending} className="flex-1 py-2 text-[11px] font-bold rounded-xl transition-all disabled:opacity-50" style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    {isPending ? <><Loader2 size={12} className="animate-spin inline mr-1" /> Generating...</> : 'Generate Periods'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingPeriod && <PeriodEditor period={editingPeriod} onClose={() => { setEditingPeriod(null); refreshData() }} />}

            <ConfirmDialog open={pendingAction !== null} onOpenChange={o => { if (!o) setPendingAction(null) }} onConfirm={confirmAction}
                title={pendingAction?.title ?? ''} description={pendingAction?.description ?? ''} confirmText="Confirm" variant={pendingAction?.variant ?? 'danger'} />

            {/* ══════ Year-End Close Modal ══════ */}
            {closeStep && closePreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

                        {/* Header */}
                        <div className="px-5 py-4 flex justify-between items-center"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                    style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)' }}>
                                    <ShieldCheck size={18} style={{ color: 'var(--app-error, #ef4444)' }} />
                                </div>
                                <div>
                                    <h2 className="text-[14px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                        {closeStep === 'preview' ? 'Year-End Close' : 'Close Complete'}
                                    </h2>
                                    <p className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {closePreview.year.name} · {closePreview.year.start_date} — {closePreview.year.end_date}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setCloseStep(null); setClosePreview(null); setCloseResult(null) }}
                                className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--app-muted-foreground)' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {closeStep === 'preview' ? (
                            /* ── Preview Report ── */
                            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

                                {/* Blockers */}
                                {closePreview.blockers.length > 0 && (
                                    <div className="rounded-xl p-3 space-y-2"
                                        style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)' }}>
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={14} style={{ color: 'var(--app-error, #ef4444)' }} />
                                            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--app-error, #ef4444)' }}>Blockers</span>
                                        </div>
                                        {closePreview.blockers.map((b, i) => (
                                            <div key={i} className="text-[11px] font-medium flex items-start gap-2" style={{ color: 'var(--app-error, #ef4444)' }}>
                                                <X size={12} className="flex-shrink-0 mt-0.5" /> {b}
                                            </div>
                                        ))}

                                        {/* No manual period close needed — Year-End Close auto-closes all periods */}
                                    </div>
                                )}

                                {/* Periods summary */}
                                <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Periods</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                        {[
                                            { label: 'Open', value: closePreview.periods.open, color: 'var(--app-success, #22c55e)' },
                                            { label: 'Closed', value: closePreview.periods.closed, color: 'var(--app-muted-foreground)' },
                                            { label: 'Future', value: closePreview.periods.future, color: 'var(--app-info, #3b82f6)' },
                                        ].map(s => (
                                            <div key={s.label} className="text-center">
                                                <div className="text-[16px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
                                                <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Journal entries */}
                                <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Journal Entries</div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[12px] font-bold" style={{ color: 'var(--app-foreground)' }}>
                                            {closePreview.journal_entries.posted} posted
                                        </span>
                                        {closePreview.journal_entries.draft > 0 && (
                                            <span className="text-[12px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                                {closePreview.journal_entries.draft} draft
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* P&L Summary */}
                                <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Profit & Loss Closing</div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--app-success, #22c55e)' }}>
                                                <TrendingUp size={12} /> Revenue
                                            </span>
                                            <span className="text-[12px] font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                                                {closePreview.pnl.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--app-error, #ef4444)' }}>
                                                <TrendingDown size={12} /> Expenses
                                            </span>
                                            <span className="text-[12px] font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                                                {closePreview.pnl.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between pt-1.5 mt-1.5" style={{ borderTop: '1px solid var(--app-border)' }}>
                                            <span className="text-[11px] font-black uppercase" style={{ color: 'var(--app-foreground)' }}>
                                                Net {closePreview.pnl.net_income >= 0 ? 'Income' : 'Loss'}
                                            </span>
                                            <span className="text-[13px] font-black tabular-nums"
                                                style={{ color: closePreview.pnl.net_income >= 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>
                                                {closePreview.pnl.net_income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* What will happen */}
                                <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>What will happen</div>
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                            <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                            <span className="text-[11px] font-medium" style={{ color: 'var(--app-foreground)' }}>
                                                {closePreview.periods.open > 0 ? `${closePreview.periods.open} open periods will be auto-closed, then all` : 'All'} Income & Expense accounts will be zeroed out
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                            <span className="text-[11px] font-medium" style={{ color: 'var(--app-foreground)' }}>
                                                Net {closePreview.pnl.net_income >= 0 ? 'income' : 'loss'} transferred to{' '}
                                                <strong>{closePreview.retained_earnings ? `${closePreview.retained_earnings.code} — ${closePreview.retained_earnings.name}` : 'Retained Earnings (not found!)'}</strong>
                                            </span>
                                        </div>
                                        {closePreview.next_year ? (
                                            <div className="flex items-start gap-2">
                                                <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                                <span className="text-[11px] font-medium" style={{ color: 'var(--app-foreground)' }}>
                                                    {closePreview.opening_balances_count} opening balances generated for <strong>{closePreview.next_year.name}</strong>
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                                <span className="text-[11px] font-medium" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                                    No next fiscal year found — opening balances will NOT be generated. Create the next year first.
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-2">
                                            <Lock size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-error, #ef4444)' }} />
                                            <span className="text-[11px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                                This fiscal year will be permanently locked. This cannot be undone.
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Opening Balances Preview */}
                                {closePreview.opening_preview && closePreview.opening_preview.length > 0 && (
                                    <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                        <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Opening Balances Preview ({closePreview.opening_balances_count} accounts)
                                        </div>
                                        <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                                            {closePreview.opening_preview.map(ob => (
                                                <div key={ob.code} className="flex items-center justify-between text-[10px] py-0.5"
                                                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="font-mono font-bold flex-shrink-0" style={{ color: 'var(--app-primary)', minWidth: '40px' }}>{ob.code}</span>
                                                        <span className="font-medium truncate" style={{ color: 'var(--app-foreground)' }}>{ob.name}</span>
                                                    </div>
                                                    <span className="font-black tabular-nums flex-shrink-0 ml-2"
                                                        style={{ color: ob.balance >= 0 ? 'var(--app-foreground)' : 'var(--app-error, #ef4444)' }}>
                                                        {ob.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {closePreview.opening_balances_count > 30 && (
                                            <div className="text-[9px] font-bold mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                                ... and {closePreview.opening_balances_count - 30} more accounts
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => { setCloseStep(null); setClosePreview(null) }}
                                        className="flex-1 py-2.5 text-[11px] font-bold rounded-xl border transition-all"
                                        style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                        Cancel
                                    </button>
                                    <button disabled={!closePreview.can_close || isPending}
                                        onClick={() => {
                                            if (!closingYearId) return
                                            startTransition(async () => {
                                                try {
                                                    await hardLockFiscalYear(closingYearId)
                                                    setCloseStep('result')
                                                    setCloseResult('Year-end close completed successfully. P&L accounts closed into Retained Earnings. Opening balances generated for the next year.')
                                                } catch (err: unknown) {
                                                    setCloseStep('result')
                                                    setCloseResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
                                                }
                                            })
                                        }}
                                        className="flex-1 py-2.5 text-[11px] font-bold rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                                        style={{ background: closePreview.can_close ? 'var(--app-error, #ef4444)' : 'var(--app-muted)', color: 'white' }}>
                                        {isPending ? <><Loader2 size={12} className="animate-spin" /> Closing...</> : <><ShieldCheck size={12} /> Execute Year-End Close</>}
                                    </button>
                                </div>
                            </div>
                        ) : closeStep === 'result' ? (
                            /* ── Result Report ── */
                            <div className="p-5 space-y-4">
                                <div className="flex flex-col items-center py-4">
                                    {closeResult?.startsWith('Error') ? (
                                        <AlertTriangle size={36} style={{ color: 'var(--app-error, #ef4444)' }} />
                                    ) : (
                                        <CheckCircle2 size={36} style={{ color: 'var(--app-success, #22c55e)' }} />
                                    )}
                                    <p className="text-[13px] font-bold mt-3 text-center" style={{ color: 'var(--app-foreground)' }}>
                                        {closeResult?.startsWith('Error') ? 'Year-End Close Failed' : 'Year-End Close Complete'}
                                    </p>
                                    <p className="text-[11px] font-medium mt-2 text-center leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {closeResult}
                                    </p>
                                </div>

                                {!closeResult?.startsWith('Error') && (
                                    <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                        <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Summary</div>
                                        <div className="space-y-1.5 text-[11px]" style={{ color: 'var(--app-foreground)' }}>
                                            <div className="flex items-center gap-2"><CheckCircle2 size={11} style={{ color: 'var(--app-success, #22c55e)' }} /> P&L closed into Retained Earnings</div>
                                            <div className="flex items-center gap-2"><CheckCircle2 size={11} style={{ color: 'var(--app-success, #22c55e)' }} /> Net {closePreview.pnl.net_income >= 0 ? 'income' : 'loss'}: {closePreview.pnl.net_income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                            {closePreview.next_year && (
                                                <div className="flex items-center gap-2"><CheckCircle2 size={11} style={{ color: 'var(--app-success, #22c55e)' }} /> Opening balances → {closePreview.next_year.name}</div>
                                            )}
                                            <div className="flex items-center gap-2"><Lock size={11} style={{ color: 'var(--app-error, #ef4444)' }} /> {closePreview.year.name} permanently locked</div>
                                        </div>
                                    </div>
                                )}

                                <button onClick={() => { setCloseStep(null); setClosePreview(null); setCloseResult(null); refreshData() }}
                                    className="w-full py-2.5 text-[11px] font-bold rounded-xl transition-all"
                                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    Done
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    )
}
