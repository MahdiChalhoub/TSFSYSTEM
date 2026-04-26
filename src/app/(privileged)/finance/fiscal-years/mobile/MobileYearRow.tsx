'use client'

import { Calendar, ShieldCheck, Lock, Unlock, ChevronRight } from 'lucide-react'

interface YearShape {
    id: number
    name: string
    startDate: string
    endDate: string
    status?: string
    isHardLocked?: boolean
    periods?: Array<{ id: number; name: string; status?: string; start_date: string; end_date: string }>
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    OPEN:      { color: 'var(--app-success, #22c55e)', bg: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', label: 'Open' },
    CLOSED:    { color: 'var(--app-warning, #f59e0b)', bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', label: 'Closed' },
    FINALIZED: { color: 'var(--app-error, #ef4444)',   bg: 'color-mix(in srgb, var(--app-error, #ef4444) 14%, transparent)',   label: 'Finalized' },
}

interface Props {
    year: YearShape
    onTap: () => void
    onLongPress: () => void
}

export function MobileYearRow({ year, onTap, onLongPress }: Props) {
    const status = year.isHardLocked ? 'FINALIZED' : (year.status || 'OPEN')
    const ss = STATUS_STYLE[status] ?? STATUS_STYLE.OPEN
    const periods = year.periods || []
    const openCount = periods.filter(p => (p.status || 'OPEN') === 'OPEN').length
    const closedCount = periods.length - openCount
    const StatusIcon = year.isHardLocked ? Lock : (status === 'CLOSED' ? ShieldCheck : Unlock)

    // Long-press = 600ms hold without movement
    let pressTimer: ReturnType<typeof setTimeout> | null = null
    const startPress = () => { pressTimer = setTimeout(() => { pressTimer = null; onLongPress() }, 600) }
    const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null } }

    const fmtDate = (iso: string) => {
        if (!iso) return '—'
        const d = new Date(iso)
        return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    }

    return (
        <button
            onClick={() => { if (pressTimer) { cancelPress(); onTap() } else { onTap() } }}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={cancelPress}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            className="w-full text-left p-3 rounded-2xl flex items-start gap-3 transition-all active:scale-[0.99]"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid color-mix(in srgb, var(--app-border) 70%, transparent)',
            }}
        >
            <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: ss.bg, color: ss.color }}
            >
                <Calendar size={18} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[14px] font-black truncate" style={{ color: 'var(--app-foreground)' }}>
                        {year.name}
                    </span>
                    <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 flex-shrink-0"
                        style={{ background: ss.bg, color: ss.color }}
                    >
                        <StatusIcon size={9} />
                        {ss.label}
                    </span>
                </div>
                <div className="text-[11px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                    {fmtDate(year.startDate)} — {fmtDate(year.endDate)}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold tabular-nums">
                    <span style={{ color: 'var(--app-muted-foreground)' }}>{periods.length} periods</span>
                    {openCount > 0 && (
                        <span
                            className="px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}
                        >
                            {openCount} open
                        </span>
                    )}
                    {closedCount > 0 && (
                        <span
                            className="px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)', color: 'var(--app-muted-foreground)' }}
                        >
                            {closedCount} closed
                        </span>
                    )}
                </div>
            </div>

            <ChevronRight size={16} style={{ color: 'var(--app-muted-foreground)' }} className="flex-shrink-0 mt-3" />
        </button>
    )
}
