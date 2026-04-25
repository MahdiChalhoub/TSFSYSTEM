import { useState } from 'react'
import { PlayCircle, ShieldCheck, Lock, Clock, LockKeyhole, RotateCcw, LayoutGrid, List } from 'lucide-react'
import { getStatusStyle } from '../_lib/constants'

interface PeriodsGridProps {
    periods: Record<string, any>[]
    year: Record<string, any>
    isPending: boolean
    handlePeriodStatus: (periodId: number, newStatus: 'OPEN' | 'CLOSED' | 'FUTURE', yearData?: Record<string, any>) => void
    handlePeriodAction: (periodId: number, action: 'close' | 'softLock' | 'hardLock' | 'reopen', periodName: string) => void
}

export function PeriodsGrid({ periods, year, isPending, handlePeriodStatus, handlePeriodAction }: PeriodsGridProps) {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    return (
        <div data-tour="periods-grid" className="flex flex-col h-full bg-(--app-bg)">
            {/* Toolbar / Header row */}
            <div className="flex items-center gap-4 px-6 py-2 border-b border-(--app-border) bg-(--app-surface)/30">
                {viewMode === 'list' ? (
                    <>
                        <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-(--app-muted-foreground)">Period Name</div>
                        <div className="w-24 text-[10px] font-black uppercase tracking-wider text-(--app-muted-foreground) text-center">Status</div>
                        <div className="w-16 text-[10px] font-black uppercase tracking-wider text-(--app-muted-foreground) text-center">Log</div>
                        <div className="w-40 text-[10px] font-black uppercase tracking-wider text-(--app-muted-foreground) text-right">Actions</div>
                    </>
                ) : (
                    <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-(--app-muted-foreground)">Period Overview (Grid)</div>
                )}
                
                {/* Switcher */}
                <div className="flex items-center bg-(--app-surface) rounded-lg p-0.5 border border-(--app-border)/40 ml-2">
                    <button onClick={() => setViewMode('grid')}
                        className={`p-1 rounded-md transition-all ${viewMode === 'grid' ? 'bg-(--app-primary) text-white' : 'text-(--app-muted-foreground) hover:bg-(--app-surface-hover)'}`}>
                        <LayoutGrid size={11} />
                    </button>
                    <button onClick={() => setViewMode('list')}
                        className={`p-1 rounded-md transition-all ${viewMode === 'list' ? 'bg-(--app-primary) text-white' : 'text-(--app-muted-foreground) hover:bg-(--app-surface-hover)'}`}>
                        <List size={11} />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {viewMode === 'list' ? (
                    <div className="flex flex-col">
                        {periods.map((p, pidx) => {
                            const pStatus = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                            const ps = getStatusStyle(pStatus)
                            const pLabel = p.name || `P${String(pidx + 1).padStart(2, '0')}`
                            const jeCount = p.journal_entry_count || 0
                            
                            return (
                                <div key={p.id} className="flex items-center gap-4 px-6 py-2.5 transition-all hover:bg-(--app-surface)/50 border-b border-(--app-border)/40 group">
                                    <div className="flex-1 flex flex-col min-w-0">
                                        <div className="text-[12px] font-bold text-(--app-foreground) truncate">{pLabel}</div>
                                        <div className="text-[10px] text-(--app-muted-foreground) truncate">
                                            {new Date(p.start_date || p.startDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} – {new Date(p.end_date || p.endDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                        </div>
                                    </div>
                                    <div className="w-24 flex justify-center">
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-current flex items-center gap-1"
                                            style={{ color: ps.color, background: `${ps.color}10`, borderColor: `${ps.color}30` }}>
                                            {pStatus}
                                        </span>
                                    </div>
                                    <div className="w-16 text-center text-[11px] font-bold tabular-nums text-(--app-foreground)">
                                        {jeCount > 0 ? jeCount : <span className="opacity-20">—</span>}
                                    </div>
                                    <div className="w-40 flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        {!year.isHardLocked && (
                                            <Actions p={p} pStatus={pStatus} isPending={isPending} handlePeriodStatus={handlePeriodStatus} handlePeriodAction={handlePeriodAction} />
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-9 gap-2">
                        {periods.map((p, pidx) => {
                            const pStatus = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                            const pLabel = p.name || `P${String(pidx + 1).padStart(2, '0')}`
                            const jeCount = p.journal_entry_count || 0
                            const isClosed = pStatus === 'CLOSED'
                            const isLocked = pStatus === 'HARD_LOCKED' || pStatus === 'SOFT_LOCKED'
                            const isFuture = pStatus === 'FUTURE'
                            const isOpen = pStatus === 'OPEN'

                            // Visual state config
                            const cardBg = isClosed
                                ? 'color-mix(in srgb, var(--app-success, #22c55e) 8%, var(--app-surface))'
                                : isLocked
                                ? 'color-mix(in srgb, var(--app-error, #ef4444) 6%, var(--app-surface))'
                                : isFuture
                                ? 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, var(--app-surface))'
                                : 'color-mix(in srgb, var(--app-success, #22c55e) 4%, var(--app-surface))'
                            const borderColor = isClosed
                                ? 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)'
                                : isLocked
                                ? 'color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)'
                                : isFuture
                                ? 'color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)'
                                : 'color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)'
                            const statusColor = isClosed
                                ? 'var(--app-success, #22c55e)'
                                : isLocked
                                ? 'var(--app-error, #ef4444)'
                                : isFuture
                                ? 'var(--app-info, #3b82f6)'
                                : 'var(--app-success, #22c55e)'

                            return (
                                <div key={p.id} className="rounded-xl p-3 border transition-all hover:shadow-md text-center flex flex-col items-center gap-0.5 relative overflow-hidden"
                                    style={{ background: cardBg, borderColor }}>
                                    {/* Sealed overlay watermark for closed/locked */}
                                    {(isClosed || isLocked) && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.04 }}>
                                            <Lock size={60} style={{ color: statusColor }} />
                                        </div>
                                    )}
                                    {/* Period name */}
                                    <div className="text-[10px] font-black uppercase tracking-wider leading-tight" style={{ color: 'var(--app-foreground)' }}>
                                        {pLabel}
                                    </div>
                                    {/* Status badge */}
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {isClosed && <ShieldCheck size={10} style={{ color: statusColor }} />}
                                        {isLocked && <LockKeyhole size={10} style={{ color: statusColor }} />}
                                        {isFuture && <Clock size={10} style={{ color: statusColor }} />}
                                        {isOpen && <PlayCircle size={10} style={{ color: statusColor }} />}
                                        <span className="text-[9px] font-black uppercase" style={{ color: statusColor }}>
                                            {pStatus === 'HARD_LOCKED' ? 'LOCKED' : pStatus === 'SOFT_LOCKED' ? 'SOFT-LOCK' : pStatus}
                                        </span>
                                    </div>
                                    {/* JE count */}
                                    <div className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {jeCount > 0 ? `${jeCount} JEs` : '—'}
                                    </div>
                                    {/* Action icons row */}
                                    {!year.isHardLocked && (
                                        <div className="flex items-center justify-center gap-0 mt-1">
                                            <Actions p={p} pStatus={pStatus} isPending={isPending} handlePeriodStatus={handlePeriodStatus} handlePeriodAction={handlePeriodAction} size={14} />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function Actions({ p, pStatus, isPending, handlePeriodStatus, handlePeriodAction, size = 14 }: any) {
    return (
        <>
            <button onClick={() => handlePeriodStatus(p.id, 'FUTURE')} title="Set as Future" disabled={isPending || pStatus === 'FUTURE'}
                className="p-1.5 rounded-lg transition-all disabled:opacity-20 hover:bg-(--app-surface)"
                style={{ color: pStatus === 'FUTURE' ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)' }}>
                <Clock size={size} />
            </button>
            <button onClick={() => handlePeriodStatus(p.id, 'OPEN')} title="Open" disabled={isPending || pStatus === 'OPEN'}
                className="p-1.5 rounded-lg transition-all disabled:opacity-20 hover:bg-(--app-surface)"
                style={{ color: pStatus === 'OPEN' ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                <PlayCircle size={size} />
            </button>
            <button onClick={() => handlePeriodAction(p.id, 'softLock', p.name)} title="Soft-lock" disabled={isPending || pStatus === 'SOFT_LOCKED'}
                className="p-1.5 rounded-lg transition-all disabled:opacity-20 hover:bg-(--app-surface)"
                style={{ color: pStatus === 'SOFT_LOCKED' ? 'var(--app-warning, #f59e0b)' : 'var(--app-muted-foreground)' }}>
                <ShieldCheck size={size} />
            </button>
            <button onClick={() => handlePeriodAction(p.id, 'hardLock', p.name)} title="Hard-lock" disabled={isPending || pStatus === 'HARD_LOCKED'}
                className="p-1.5 rounded-lg transition-all disabled:opacity-20 hover:bg-(--app-surface)"
                style={{ color: pStatus === 'HARD_LOCKED' ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                <LockKeyhole size={size} />
            </button>
            <button onClick={() => handlePeriodAction(p.id, 'close', p.name)} title="Close" disabled={isPending || pStatus === 'CLOSED'}
                className="p-1.5 rounded-lg transition-all disabled:opacity-20 hover:bg-(--app-surface)"
                style={{ color: pStatus === 'CLOSED' ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                <Lock size={size} />
            </button>
            {(pStatus === 'CLOSED' || pStatus === 'HARD_LOCKED' || pStatus === 'SOFT_LOCKED') && (
                <button onClick={() => handlePeriodAction(p.id, 'reopen', p.name)} title="Reopen" disabled={isPending}
                    className="p-1.5 rounded-lg transition-all disabled:opacity-20 hover:bg-(--app-surface) ml-auto"
                    style={{ color: 'var(--app-error)' }}>
                    <RotateCcw size={size} />
                </button>
            )}
        </>
    )
}


