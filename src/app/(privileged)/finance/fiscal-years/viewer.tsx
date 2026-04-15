'use client'

import { useState, useMemo, useTransition } from 'react'
import {
    Calendar, Plus, CheckCircle2, Clock, Lock,
    PlayCircle, ShieldCheck, Trash2, Forward,
    Maximize2, Minimize2, X, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    deleteFiscalYear, updatePeriodStatus, closeFiscalYear,
    hardLockFiscalYear, transferBalancesToNextYear, createFiscalYear,
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
    const [years] = useState(initialYears)
    const [expandedYear, setExpandedYear] = useState<number | null>(years[0]?.id ?? null)
    const [focusMode, setFocusMode] = useState(false)
    const [showWizard, setShowWizard] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string | null>(null)
    const [editingPeriod, setEditingPeriod] = useState<Record<string, any> | null>(null)
    const [pendingAction, setPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'; yearId?: number; nextYearId?: number } | null>(null)

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
        { label: 'Fiscal Years', value: stats.total, color: 'var(--app-primary)', icon: <Calendar size={14} /> },
        { label: 'Open Periods', value: stats.openPeriods, color: 'var(--app-success, #22c55e)', icon: <PlayCircle size={14} /> },
        { label: 'Closed', value: stats.closedPeriods, color: 'var(--app-muted-foreground)', icon: <Lock size={14} /> },
        { label: 'Future', value: stats.futurePeriods, color: 'var(--app-info, #3b82f6)', icon: <Clock size={14} /> },
        { label: 'Finalized', value: stats.lockedYears, color: 'var(--app-error, #ef4444)', icon: <ShieldCheck size={14} /> },
    ]

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

    const handlePeriodStatus = (periodId: number, status: 'OPEN' | 'CLOSED' | 'FUTURE') => {
        startTransition(async () => {
            try { await updatePeriodStatus(periodId, status); toast.success(`Period ${status.toLowerCase()}`); refreshData() }
            catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)) }
        })
    }

    const confirmAction = () => {
        if (!pendingAction) return
        const { type, yearId, nextYearId } = pendingAction; setPendingAction(null)
        startTransition(async () => {
            try {
                if (type === 'delete' && yearId) { await deleteFiscalYear(yearId); toast.success('Year deleted') }
                if (type === 'close' && yearId) { await closeFiscalYear(yearId); toast.success('Year closed') }
                if (type === 'hardLock' && yearId) { await hardLockFiscalYear(yearId); toast.success('Year finalized') }
                if (type === 'rollForward' && yearId && nextYearId) { await transferBalancesToNextYear(yearId, nextYearId); toast.success('Balances transferred') }
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
                    {kpis.map(k => (
                        <div key={k.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}>{k.icon}</div>
                            <div className="min-w-0">
                                <div className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                                <div className="text-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{k.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                {focusMode && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold mr-1"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)', color: 'var(--app-primary)' }}>
                        <Calendar size={12} /> {stats.total} years · {stats.openPeriods} open
                    </div>
                )}
                <div className="flex-1" />
                {focusMode && (
                    <button onClick={openWizard} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg" style={{ color: 'var(--app-primary)' }}>
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
                {years.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Calendar size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-[13px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>No fiscal years configured</p>
                        <p className="text-[11px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>Create a year to start recording transactions</p>
                        <button onClick={openWizard} className="mt-4 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl" style={{ background: 'var(--app-primary)', color: 'white' }}>
                            <Plus size={13} /> Create First Year
                        </button>
                    </div>
                ) : years.map((year, idx) => {
                    const isExpanded = expandedYear === year.id
                    const yearStatus = year.isHardLocked ? 'FINALIZED' : (year.status || 'OPEN')
                    const ss = getStatusStyle(yearStatus)
                    const periods = [...(year.periods || [])].sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
                    const openCount = periods.filter((p: any) => (p.status || 'OPEN') === 'OPEN').length
                    const nextYear = years[idx - 1]

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
                                            <button onClick={() => setPendingAction({ type: 'close', yearId: year.id, title: 'Close Fiscal Year?', description: 'Soft close — you can still reopen periods if needed.', variant: 'warning' })}
                                                disabled={isPending} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all"
                                                style={{ color: 'var(--app-warning, #f59e0b)', borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                                                <Lock size={11} /> Soft Close
                                            </button>
                                        )}
                                        {yearStatus === 'CLOSED' && nextYear && (
                                            <button onClick={() => setPendingAction({ type: 'rollForward', yearId: year.id, nextYearId: nextYear.id, title: 'Transfer Balances?', description: `Calculate all balances for ${year.name} and create Opening Entry in ${nextYear.name}.`, variant: 'warning' })}
                                                disabled={isPending} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all"
                                                style={{ color: 'var(--app-info, #3b82f6)', borderColor: 'color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)' }}>
                                                <Forward size={11} /> Roll Forward
                                            </button>
                                        )}
                                        {yearStatus === 'CLOSED' && !year.isHardLocked && (
                                            <button onClick={() => setPendingAction({ type: 'hardLock', yearId: year.id, title: 'Hard Lock?', description: 'PERMANENT. No reopening. Ensures compliance.', variant: 'danger' })}
                                                disabled={isPending} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all"
                                                style={{ color: 'var(--app-error, #ef4444)', borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}>
                                                <ShieldCheck size={11} /> Hard Lock
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
                                                <div key={p.id} className="relative group rounded-xl p-2.5 text-center transition-all" style={{ background: ps.bg, border: `1px solid ${ps.color}20` }}>
                                                    <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{pLabel}</div>
                                                    <div className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--app-foreground)' }}>{monthLabel}</div>
                                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.color}30` }}>{pStatus}</span>
                                                    {!year.isHardLocked && (
                                                        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 z-10"
                                                            style={{ background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)' }}>
                                                            <button onClick={() => handlePeriodStatus(p.id, 'OPEN')} title="Open" className="p-1 rounded-lg transition-all" style={{ color: pStatus === 'OPEN' ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}><PlayCircle size={14} /></button>
                                                            <button onClick={() => handlePeriodStatus(p.id, 'CLOSED')} title="Close" className="p-1 rounded-lg transition-all" style={{ color: pStatus === 'CLOSED' ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}><Lock size={14} /></button>
                                                            <button onClick={() => handlePeriodStatus(p.id, 'FUTURE')} title="Future" className="p-1 rounded-lg transition-all" style={{ color: pStatus === 'FUTURE' ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)' }}><Clock size={14} /></button>
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
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>{years.length} fiscal years</span>
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
        </div>
    )
}
