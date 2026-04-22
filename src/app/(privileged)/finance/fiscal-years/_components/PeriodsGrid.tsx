import { PlayCircle, ShieldCheck, Lock, Clock, LockKeyhole, RotateCcw } from 'lucide-react'
import { getStatusStyle } from '../_lib/constants'

interface PeriodsGridProps {
    periods: Record<string, any>[]
    year: Record<string, any>
    isPending: boolean
    handlePeriodStatus: (periodId: number, newStatus: 'OPEN' | 'CLOSED' | 'FUTURE', yearData?: Record<string, any>) => void
    handlePeriodAction: (periodId: number, action: 'close' | 'softLock' | 'hardLock' | 'reopen', periodName: string) => void
}

export function PeriodsGrid({ periods, year, isPending, handlePeriodStatus, handlePeriodAction }: PeriodsGridProps) {
    return (
        <div className="p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px' }}>
            {periods.map((p: Record<string, any>, pidx: number) => {
                const pStatus = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                const ps = getStatusStyle(pStatus)
                const pLabel = p.name || `P${String(pidx + 1).padStart(2, '0')}`
                const monthLabel = p.start_date ? new Date(p.start_date).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : ''
                return (
                    <div key={p.id} data-period-id={p.id} className="rounded-xl p-2.5 text-center transition-all" style={{ background: ps.bg, border: `1px solid ${ps.color}20` }}>
                        <div className="text-tp-xxs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{pLabel}</div>
                        <div className="text-tp-sm font-bold mt-0.5" style={{ color: 'var(--app-foreground)' }}>{monthLabel}</div>
                        <span className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.color}30` }}>{pStatus}</span>
                        {(p.journal_entry_count || 0) > 0 && (
                            <div className="text-tp-xxs font-bold mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>{p.journal_entry_count} JEs</div>
                        )}
                        {!year.isHardLocked && (
                            <div className="flex items-center justify-center gap-1 mt-1.5 flex-wrap">
                                <button onClick={() => handlePeriodStatus(p.id, 'OPEN')} title="Open" disabled={isPending || pStatus === 'OPEN'} className="p-1 rounded-lg transition-all disabled:opacity-30" style={{ color: pStatus === 'OPEN' ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}><PlayCircle size={13} /></button>
                                <button onClick={() => handlePeriodAction(p.id, 'softLock', p.name)} title="Soft-lock (supervisors only)" disabled={isPending || pStatus === 'SOFT_LOCKED'} className="p-1 rounded-lg transition-all disabled:opacity-30" style={{ color: pStatus === 'SOFT_LOCKED' ? 'var(--app-warning, #f59e0b)' : 'var(--app-muted-foreground)' }}><ShieldCheck size={13} /></button>
                                <button onClick={() => handlePeriodAction(p.id, 'hardLock', p.name)} title="Hard-lock (no posting)" disabled={isPending || pStatus === 'HARD_LOCKED'} className="p-1 rounded-lg transition-all disabled:opacity-30" style={{ color: pStatus === 'HARD_LOCKED' ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}><LockKeyhole size={13} /></button>
                                <button onClick={() => handlePeriodAction(p.id, 'close', p.name)} title="Close" disabled={isPending || pStatus === 'CLOSED'} className="p-1 rounded-lg transition-all disabled:opacity-30" style={{ color: pStatus === 'CLOSED' ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}><Lock size={13} /></button>
                                <button onClick={() => handlePeriodStatus(p.id, 'FUTURE')} title="Future" disabled={isPending || pStatus === 'FUTURE'} className="p-1 rounded-lg transition-all disabled:opacity-30" style={{ color: pStatus === 'FUTURE' ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)' }}><Clock size={13} /></button>
                                {(pStatus === 'CLOSED' || pStatus === 'HARD_LOCKED' || pStatus === 'SOFT_LOCKED') && (
                                    <button onClick={() => handlePeriodAction(p.id, 'reopen', p.name)} title="Reopen (superuser only)" disabled={isPending} className="p-1 rounded-lg transition-all disabled:opacity-30" style={{ color: 'var(--app-muted-foreground)' }}><RotateCcw size={13} /></button>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
