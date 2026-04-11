'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    CalendarDays, Plus, Search, Maximize2, Minimize2,
    Calendar, CalendarCheck, CalendarX, Lock, ShieldCheck,
    ChevronDown, ChevronRight, PlayCircle, Clock,
    Forward, Trash2, Edit2, X, Loader2, AlertTriangle
} from 'lucide-react'
import { createFiscalYear, deleteFiscalYear, updatePeriodStatus, closeFiscalYear, hardLockFiscalYear, transferBalancesToNextYear } from '@/app/actions/finance/fiscal-year'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import PeriodEditor from './period-editor'
import type { FiscalYear, FiscalPeriod } from '@/types/erp'

// ── KPI helpers ──
function getKPIs(years: FiscalYear[]) {
    const open = years.filter(y => y.status === 'OPEN').length
    const closed = years.filter(y => y.status === 'CLOSED').length
    const locked = years.filter(y => (y as any).isHardLocked).length
    const totalPeriods = years.reduce((acc, y) => acc + ((y as any).periods?.length || 0), 0)
    const openPeriods = years.reduce((acc, y) =>
        acc + ((y as any).periods || []).filter((p: any) => (p.status || 'OPEN') === 'OPEN').length, 0)

    return [
        { label: 'Total Years', value: years.length, color: 'var(--app-primary)', icon: <CalendarDays size={14} /> },
        { label: 'Active', value: open, color: 'var(--app-success, #22c55e)', icon: <Calendar size={14} /> },
        { label: 'Closed', value: closed, color: 'var(--app-warning, #f59e0b)', icon: <CalendarX size={14} /> },
        { label: 'Finalized', value: locked, color: 'var(--app-error, #ef4444)', icon: <ShieldCheck size={14} /> },
        { label: 'Periods', value: `${openPeriods}/${totalPeriods}`, color: '#8b5cf6', icon: <CalendarCheck size={14} /> },
    ]
}

export default function FiscalYearsViewer({ initialYears }: { initialYears: FiscalYear[] }) {
    const router = useRouter()
    const [focusMode, setFocusMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set(initialYears.filter(y => y.status === 'OPEN').map(y => y.id)))
    const [showWizard, setShowWizard] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    // Wizard state
    const [isPending, startTransition] = useTransition()
    const currentYear = new Date().getFullYear()
    const lastYear = initialYears[0]
    const [wizardData, setWizardData] = useState({
        name: `FY ${currentYear}`,
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-12-31`,
        frequency: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY',
        defaultPeriodStatus: 'OPEN' as 'OPEN' | 'FUTURE',
        includeAuditPeriod: true,
    })

    // Year card state
    const [editingPeriod, setEditingPeriod] = useState<FiscalPeriod | null>(null)
    const [pendingAction, setPendingAction] = useState<{
        type: string; yearId: number; nextYearId?: number;
        title: string; description: string; variant: 'danger' | 'warning' | 'info'
    } | null>(null)

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // ── Wizard auto-fill ──
    useEffect(() => {
        if (showWizard && lastYear) {
            const lastEnd = new Date((lastYear as any).endDate || lastYear.end_date)
            const nextStart = new Date(lastEnd)
            nextStart.setDate(nextStart.getDate() + 1)
            const nextStartStr = nextStart.toISOString().split('T')[0]
            const nextYearNum = nextStart.getFullYear()
            setWizardData(prev => ({ ...prev, name: `FY ${nextYearNum}`, startDate: nextStartStr }))
        }
    }, [showWizard, lastYear])

    // ── End date calc ──
    useEffect(() => {
        if (wizardData.startDate) {
            const start = new Date(wizardData.startDate)
            if (isNaN(start.getTime())) return
            const end = new Date(start)
            end.setFullYear(end.getFullYear() + 1)
            end.setDate(end.getDate() - 1)
            setWizardData(prev => ({ ...prev, endDate: end.toISOString().split('T')[0] }))
        }
    }, [wizardData.startDate])

    // ── Filter ──
    const filtered = initialYears.filter(y =>
        !searchQuery || y.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const kpis = getKPIs(initialYears)

    const toggleYear = (id: number) => {
        setExpandedYears(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const expandAll = () => setExpandedYears(new Set(filtered.map(y => y.id)))
    const collapseAll = () => setExpandedYears(new Set())

    // ── Create ──
    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            try {
                await createFiscalYear({
                    name: wizardData.name,
                    startDate: new Date(wizardData.startDate),
                    endDate: new Date(wizardData.endDate),
                    frequency: wizardData.frequency,
                    defaultPeriodStatus: wizardData.defaultPeriodStatus as any,
                    includeAuditPeriod: wizardData.includeAuditPeriod,
                })
                setShowWizard(false)
                toast.success('Fiscal year created successfully')
            } catch (err: any) {
                toast.error(err?.message || 'Failed to create fiscal year')
            }
        })
    }

    // ── Year actions ──
    const handlePeriodStatus = (periodId: number, status: 'OPEN' | 'CLOSED' | 'FUTURE') => {
        startTransition(async () => {
            try {
                await updatePeriodStatus(periodId, status)
                toast.success(`Period set to ${status}`)
                router.refresh()
            } catch (err: any) {
                toast.error(err?.message || 'Failed to update status')
            }
        })
    }

    const handleConfirmAction = () => {
        if (!pendingAction) return
        startTransition(async () => {
            try {
                switch (pendingAction.type) {
                    case 'delete':
                        await deleteFiscalYear(pendingAction.yearId)
                        toast.success('Fiscal year deleted')
                        break
                    case 'close':
                        await closeFiscalYear(pendingAction.yearId)
                        toast.success('Fiscal year closed')
                        break
                    case 'hardLock':
                        await hardLockFiscalYear(pendingAction.yearId)
                        toast.success('Fiscal year finalized')
                        break
                    case 'rollForward':
                        await transferBalancesToNextYear(pendingAction.yearId, pendingAction.nextYearId!)
                        toast.success('Balances transferred successfully')
                        break
                }
            } catch (err: any) {
                toast.error(err?.message || 'Action failed')
            }
            setPendingAction(null)
        })
    }

    const getStatusConfig = (year: any) => {
        if (year.isHardLocked) return { label: 'FINALIZED', color: 'var(--app-error, #ef4444)', bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)' }
        if (year.status === 'CLOSED') return { label: 'CLOSED', color: 'var(--app-warning, #f59e0b)', bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)' }
        return { label: 'OPEN', color: 'var(--app-success, #22c55e)', bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)' }
    }

    const getPeriodStatusConfig = (status: string) => {
        if (status === 'OPEN') return { color: 'var(--app-success, #22c55e)', bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', border: 'color-mix(in srgb, var(--app-success, #22c55e) 25%, transparent)' }
        if (status === 'CLOSED') return { color: 'var(--app-warning, #f59e0b)', bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)', border: 'color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)' }
        return { color: 'var(--app-info, #3b82f6)', bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)', border: 'color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }
    }

    // ═══════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════
    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>

            {/* ── Header ── */}
            {!focusMode ? (
                <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary"
                            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <CalendarDays size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                                Fiscal Years
                            </h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {initialYears.length} Years · Periods & Closing
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={expandAll}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <ChevronDown size={13} />
                            <span className="hidden md:inline">Expand All</span>
                        </button>
                        <button onClick={collapseAll}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <ChevronRight size={13} />
                            <span className="hidden md:inline">Collapse</span>
                        </button>
                        <button onClick={() => setShowWizard(true)}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Plus size={14} />
                            <span className="hidden sm:inline">New Fiscal Year</span>
                        </button>
                        <button onClick={() => setFocusMode(true)}
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Maximize2 size={13} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                            <CalendarDays size={14} className="text-white" />
                        </div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Fiscal Years</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length}/{initialYears.length}</span>
                    </div>
                    <div className="flex-1" />
                    <button onClick={() => setShowWizard(true)}
                        className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <Plus size={14} />
                    </button>
                    <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                </div>
            )}

            {/* ── KPI Strip ── */}
            {!focusMode && (
                <div className="flex-shrink-0 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {kpis.map(s => (
                        <div key={s.label}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                {s.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Search Bar ── */}
            <div className="flex-shrink-0 mb-3 flex items-center gap-2">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search fiscal years... (Ctrl+K)"
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                    />
                </div>
            </div>

            {/* ── Year List ── */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar space-y-3">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <CalendarDays size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">
                            {searchQuery ? 'No matching fiscal years' : 'No fiscal years configured'}
                        </p>
                        <p className="text-[11px] text-app-muted-foreground mt-1">
                            {searchQuery ? 'Try a different search term.' : 'Create a year to start recording transactions.'}
                        </p>
                        {!searchQuery && (
                            <button onClick={() => setShowWizard(true)}
                                className="mt-4 flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-4 py-2 rounded-xl transition-all"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <Plus size={14} /> Create Fiscal Year
                            </button>
                        )}
                    </div>
                ) : (
                    filtered.map((year: any, idx) => {
                        const sc = getStatusConfig(year)
                        const isExpanded = expandedYears.has(year.id)
                        const periods = [...(year.periods || [])].sort((a: any, b: any) =>
                            (a.start_date || '').localeCompare(b.start_date || ''))
                        const openPeriodsCount = periods.filter((p: any) => (p.status || 'OPEN') === 'OPEN').length
                        const nextYear = filtered[idx - 1]

                        return (
                            <div key={year.id}
                                className="rounded-2xl overflow-hidden transition-all animate-in fade-in duration-200"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: `1px solid ${year.isHardLocked ? 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                }}>

                                {/* ── Year Header ── */}
                                <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 cursor-pointer transition-all hover:bg-app-surface/40"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                                        borderLeft: `3px solid ${sc.color}`,
                                    }}
                                    onClick={() => toggleYear(year.id)}>

                                    {/* Toggle */}
                                    <button className="w-5 h-5 flex items-center justify-center rounded-md transition-all hover:bg-app-border/50 text-app-muted-foreground flex-shrink-0">
                                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                    </button>

                                    {/* Icon */}
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
                                        {year.isHardLocked ? <ShieldCheck size={15} /> : <CalendarDays size={15} />}
                                    </div>

                                    {/* Name + date */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] font-bold text-app-foreground truncate">{year.name}</span>
                                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                                style={{ background: sc.bg, color: sc.color, border: `1px solid color-mix(in srgb, ${sc.color} 20%, transparent)` }}>
                                                {sc.label}
                                            </span>
                                        </div>
                                        <div className="text-[11px] font-bold text-app-muted-foreground mt-0.5">
                                            {year.startDate ? new Date(year.startDate).toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            {' → '}
                                            {year.endDate ? new Date(year.endDate).toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                        </div>
                                    </div>

                                    {/* Period count */}
                                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                        style={{ color: '#8b5cf6', background: 'color-mix(in srgb, #8b5cf6 8%, transparent)' }}>
                                        <Calendar size={10} />
                                        {openPeriodsCount}/{periods.length} periods
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                        {year.status === 'OPEN' && (
                                            <button onClick={() => setPendingAction({
                                                type: 'close', yearId: year.id,
                                                title: 'Close Fiscal Year?',
                                                description: 'This acts as a Soft Close. You can still reopen periods if needed.',
                                                variant: 'warning',
                                            })}
                                                disabled={isPending}
                                                className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all">
                                                <Lock size={11} />
                                                <span className="hidden lg:inline">Close</span>
                                            </button>
                                        )}
                                        {year.status === 'CLOSED' && nextYear && (
                                            <button onClick={() => setPendingAction({
                                                type: 'rollForward', yearId: year.id, nextYearId: nextYear.id,
                                                title: 'Transfer Balances?',
                                                description: `Transfer Asset, Liability, and Equity balances from ${year.name} to ${nextYear.name}.`,
                                                variant: 'warning',
                                            })}
                                                disabled={isPending}
                                                className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all">
                                                <Forward size={11} />
                                                <span className="hidden lg:inline">Roll Forward</span>
                                            </button>
                                        )}
                                        {year.status === 'CLOSED' && !year.isHardLocked && (
                                            <button onClick={() => setPendingAction({
                                                type: 'hardLock', yearId: year.id,
                                                title: 'Hard Lock Fiscal Year?',
                                                description: 'CRITICAL: Hard Locking is permanent. You will NOT be able to reopen periods.',
                                                variant: 'danger',
                                            })}
                                                disabled={isPending}
                                                className="flex items-center gap-1 text-[10px] font-bold border px-2 py-1 rounded-lg transition-all"
                                                style={{ color: 'var(--app-error, #ef4444)', borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}>
                                                <ShieldCheck size={11} />
                                                <span className="hidden lg:inline">Finalize</span>
                                            </button>
                                        )}
                                        {year.isHardLocked && (
                                            <div className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg"
                                                style={{ color: 'var(--app-error, #ef4444)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)' }}>
                                                <ShieldCheck size={11} /> IMMUTABLE
                                            </div>
                                        )}
                                        <button onClick={() => setPendingAction({
                                            type: 'delete', yearId: year.id,
                                            title: 'Delete Fiscal Year?',
                                            description: 'This will permanently remove this fiscal year and all its periods.',
                                            variant: 'danger',
                                        })}
                                            disabled={isPending || year.isHardLocked}
                                            className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors disabled:opacity-30"
                                            title="Delete Year">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                {/* ── Period Grid ── */}
                                {isExpanded && periods.length > 0 && (
                                    <div className="px-3 md:px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-150"
                                        style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '6px' }}>
                                            {periods.map((p: any, pidx: number) => {
                                                const ps = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                                                const pc = getPeriodStatusConfig(ps)
                                                const periodLabel = p.name || `P${String(pidx + 1).padStart(2, '0')}`
                                                const monthLabel = p.start_date ? new Date(p.start_date).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : ''

                                                // ── Temporal awareness ──
                                                const today = new Date()
                                                today.setHours(0, 0, 0, 0)
                                                const pStart = p.start_date ? new Date(p.start_date) : null
                                                const pEnd = p.end_date ? new Date(p.end_date) : null
                                                if (pStart) pStart.setHours(0, 0, 0, 0)
                                                if (pEnd) pEnd.setHours(0, 0, 0, 0)

                                                const isFuturePeriod = pStart ? pStart > today : false        // hasn't started yet
                                                const isPastPeriod = pEnd ? pEnd < today : false              // already ended
                                                const isCurrentPeriod = pStart && pEnd ? (today >= pStart && today <= pEnd) : false

                                                // Can only set FUTURE if the period hasn't started yet
                                                const canSetFuture = isFuturePeriod

                                                return (
                                                    <div key={p.id}
                                                        className="group relative rounded-xl p-2.5 text-center transition-all cursor-default"
                                                        style={{
                                                            background: isCurrentPeriod
                                                                ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)'
                                                                : pc.bg,
                                                            border: `1px solid ${isCurrentPeriod
                                                                ? 'color-mix(in srgb, var(--app-primary) 35%, transparent)'
                                                                : pc.border}`,
                                                        }}>
                                                        <div className="text-[9px] font-black uppercase tracking-wider mb-0.5"
                                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                                            {periodLabel}
                                                        </div>
                                                        <div className="text-[12px] font-bold text-app-foreground">
                                                            {monthLabel}
                                                        </div>
                                                        <div className="mt-1 flex items-center justify-center gap-1">
                                                            {isCurrentPeriod && (
                                                                <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
                                                                    style={{
                                                                        color: 'white',
                                                                        background: 'var(--app-primary)',
                                                                    }}>
                                                                    NOW
                                                                </span>
                                                            )}
                                                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                                style={{ color: pc.color, background: `color-mix(in srgb, ${pc.color} 15%, transparent)` }}>
                                                                {ps}
                                                            </span>
                                                        </div>

                                                        {/* Hover overlay actions */}
                                                        {!year.isHardLocked && (
                                                            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center justify-center gap-1.5"
                                                                style={{
                                                                    background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)',
                                                                    backdropFilter: 'blur(4px)',
                                                                    border: `1px solid var(--app-border)`,
                                                                }}>
                                                                <div className="flex gap-1">
                                                                    <button onClick={() => canSetFuture && handlePeriodStatus(p.id, 'FUTURE')}
                                                                        disabled={!canSetFuture}
                                                                        className="p-1.5 rounded-lg transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                                                                        style={{
                                                                            background: ps === 'FUTURE' ? 'color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)' : 'transparent',
                                                                            color: ps === 'FUTURE' ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                                                                        }}
                                                                        title={canSetFuture ? 'Set to Future' : 'Cannot set to Future — period has already started'}>
                                                                        <Clock size={13} />
                                                                    </button>
                                                                    <button onClick={() => handlePeriodStatus(p.id, 'OPEN')}
                                                                        className="p-1.5 rounded-lg transition-all"
                                                                        style={{
                                                                            background: ps === 'OPEN' ? 'color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)' : 'transparent',
                                                                            color: ps === 'OPEN' ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)',
                                                                        }}
                                                                        title="Open">
                                                                        <PlayCircle size={13} />
                                                                    </button>
                                                                    <button onClick={() => handlePeriodStatus(p.id, 'CLOSED')}
                                                                        className="p-1.5 rounded-lg transition-all"
                                                                        style={{
                                                                            background: ps === 'CLOSED' ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)' : 'transparent',
                                                                            color: ps === 'CLOSED' ? 'var(--app-warning, #f59e0b)' : 'var(--app-muted-foreground)',
                                                                        }}
                                                                        title="Close">
                                                                        <Lock size={13} />
                                                                    </button>
                                                                </div>
                                                                {!canSetFuture && ps !== 'FUTURE' && (
                                                                    <span className="text-[8px] font-bold text-app-muted-foreground opacity-60">
                                                                        {isCurrentPeriod ? 'Current period' : isPastPeriod ? 'Past period' : ''}
                                                                    </span>
                                                                )}
                                                                <button onClick={() => setEditingPeriod(p)}
                                                                    className="text-[9px] font-bold uppercase tracking-wider text-app-muted-foreground hover:text-app-foreground transition-colors">
                                                                    Edit
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
                    })
                )}
            </div>

            {/* ── Create Fiscal Year Modal ── */}
            {showWizard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowWizard(false) }}>
                    <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

                        {/* Modal Header */}
                        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <CalendarDays size={15} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-app-foreground">New Fiscal Year</h3>
                                    <p className="text-[10px] font-bold text-app-muted-foreground">Configure financial periods</p>
                                </div>
                            </div>
                            <button onClick={() => setShowWizard(false)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Year Name</label>
                                <input
                                    value={wizardData.name}
                                    onChange={e => setWizardData({ ...wizardData, name: e.target.value })}
                                    className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 focus:border-app-border transition-all"
                                    required
                                />
                            </div>

                            {/* Dates */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                                <div>
                                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Start Date</label>
                                    <input
                                        type="date"
                                        value={wizardData.startDate}
                                        onChange={e => setWizardData({ ...wizardData, startDate: e.target.value })}
                                        className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 focus:border-app-border transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">End Date</label>
                                    <input
                                        type="date"
                                        value={wizardData.endDate}
                                        onChange={e => setWizardData({ ...wizardData, endDate: e.target.value })}
                                        className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 focus:border-app-border transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Strategy Section */}
                            <div className="p-4 rounded-xl"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, var(--app-surface))',
                                    border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)',
                                    borderLeft: '3px solid var(--app-info, #3b82f6)',
                                }}>
                                <h4 className="text-[11px] font-black uppercase tracking-wider mb-3"
                                    style={{ color: 'var(--app-info, #3b82f6)' }}>
                                    📅 Period Strategy
                                </h4>

                                {/* Frequency */}
                                <div className="mb-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest mb-2 block"
                                        style={{ color: 'var(--app-muted-foreground)' }}>Frequency</label>
                                    <div className="flex gap-2">
                                        {(['MONTHLY', 'QUARTERLY'] as const).map(f => (
                                            <button key={f} type="button"
                                                onClick={() => setWizardData({ ...wizardData, frequency: f })}
                                                className="flex-1 text-[11px] font-bold py-2 rounded-xl transition-all"
                                                style={{
                                                    background: wizardData.frequency === f
                                                        ? 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)'
                                                        : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                                                    color: wizardData.frequency === f ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                                                    border: `1px solid ${wizardData.frequency === f ? 'color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)' : 'transparent'}`,
                                                }}>
                                                {f === 'MONTHLY' ? 'Monthly (12)' : 'Quarterly (4)'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Default Status */}
                                <div className="mb-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest mb-2 block"
                                        style={{ color: 'var(--app-muted-foreground)' }}>Initial Period Status</label>
                                    <div className="flex gap-2">
                                        {([{ value: 'OPEN', label: 'Open (Active)' }, { value: 'FUTURE', label: 'Future (Locked)' }] as const).map(s => (
                                            <button key={s.value} type="button"
                                                onClick={() => setWizardData({ ...wizardData, defaultPeriodStatus: s.value as any })}
                                                className="flex-1 text-[11px] font-bold py-2 rounded-xl transition-all"
                                                style={{
                                                    background: wizardData.defaultPeriodStatus === s.value
                                                        ? 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)'
                                                        : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                                                    color: wizardData.defaultPeriodStatus === s.value ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)',
                                                    border: `1px solid ${wizardData.defaultPeriodStatus === s.value ? 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)' : 'transparent'}`,
                                                }}>
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Audit Period */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                                        style={{
                                            background: wizardData.includeAuditPeriod ? 'var(--app-info, #3b82f6)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                            border: wizardData.includeAuditPeriod ? 'none' : '1px solid var(--app-border)',
                                        }}
                                        onClick={() => setWizardData({ ...wizardData, includeAuditPeriod: !wizardData.includeAuditPeriod })}>
                                        {wizardData.includeAuditPeriod && <CalendarCheck size={12} className="text-white" />}
                                    </div>
                                    <span className="text-[11px] font-bold text-app-foreground">Include Audit Adjustment Period (13th Month)</span>
                                </label>

                                <p className="text-[10px] font-bold text-app-muted-foreground mt-2 ml-7">
                                    "Future" prevents accidentally posting to later periods.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setShowWizard(false)}
                                    className="flex-1 text-[11px] font-bold py-2.5 rounded-xl text-app-muted-foreground border border-app-border hover:bg-app-surface transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isPending}
                                    className="flex-1 text-[11px] font-bold py-2.5 rounded-xl text-white bg-app-primary hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    {isPending ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : 'Generate Periods'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Period Editor ── */}
            {editingPeriod && (
                <PeriodEditor period={editingPeriod} onClose={() => setEditingPeriod(null)} />
            )}

            {/* ── Confirm Dialog ── */}
            <ConfirmDialog
                open={pendingAction !== null}
                onOpenChange={(open) => { if (!open) setPendingAction(null) }}
                onConfirm={handleConfirmAction}
                title={pendingAction?.title ?? ''}
                description={pendingAction?.description ?? ''}
                confirmText="Confirm"
                variant={pendingAction?.variant ?? 'danger'}
            />
        </div>
    )
}
