import { Loader2, Calendar, Lock, ShieldCheck, CheckCircle2, FileText, RotateCcw, PlayCircle } from 'lucide-react'
import type { YearHistoryEvent } from '@/app/actions/finance/fiscal-year'

interface HistoryTabProps {
    history: { events: YearHistoryEvent[]; je_by_month: { month: string; count: number }[] } | undefined
}

const TYPE_META: Record<string, { Icon: typeof Calendar; color: string; label: string }> = {
    CREATED:        { Icon: PlayCircle,  color: 'var(--app-primary)',              label: 'Created' },
    PERIOD_CLOSED:  { Icon: Lock,        color: 'var(--app-muted-foreground)',     label: 'Period Closed' },
    PERIOD_OPENED:  { Icon: RotateCcw,   color: 'var(--app-success, #22c55e)',     label: 'Opened' },
    YEAR_CLOSED:    { Icon: ShieldCheck,  color: 'var(--app-warning, #f59e0b)',    label: 'Year Closed' },
    CLOSING_ENTRY:  { Icon: FileText,    color: 'var(--app-success, #22c55e)',     label: 'Closing Entry' },
    HARD_LOCKED:    { Icon: ShieldCheck,  color: 'var(--app-error, #ef4444)',      label: 'Finalized' },
}

export function HistoryTab({ history }: HistoryTabProps) {
    if (!history) return (
        <div className="p-8 text-center flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
            <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Loading history...</span>
        </div>
    )

    const h = history
    const maxJe = Math.max(...h.je_by_month.map(m => m.count), 1)

    return (
        <div className="flex flex-col min-h-0">
            {/* ── Monthly Activity Heatmap ── */}
            {h.je_by_month.length > 0 && (
                <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="text-[9px] font-black uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                        Journal Entries by Month
                    </div>
                    <div className="flex gap-1">
                        {h.je_by_month.map(m => {
                            const intensity = Math.max(0.08, m.count / maxJe)
                            return (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${m.month}: ${m.count} JEs`}>
                                    <div className="w-full rounded" style={{
                                        height: '24px',
                                        background: `color-mix(in srgb, var(--app-primary) ${Math.round(intensity * 60)}%, transparent)`,
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <span className="text-[10px] font-black tabular-nums" style={{
                                            color: intensity > 0.4 ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        }}>{m.count}</span>
                                    </div>
                                    <span className="text-[8px] font-bold uppercase" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {new Date(m.month + '-01').toLocaleDateString(undefined, { month: 'short' })}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Event Timeline ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="px-5 py-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.12em] mb-3" style={{ color: 'var(--app-muted-foreground)' }}>
                        Audit Trail
                    </div>
                    {h.events.length === 0 ? (
                        <div className="text-[11px] italic py-6 text-center" style={{ color: 'var(--app-muted-foreground)' }}>
                            No governance events recorded yet
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Vertical timeline line */}
                            <div className="absolute left-[11px] top-3 bottom-3 w-px" style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />

                            {h.events.map((ev, i) => {
                                const ti = TYPE_META[ev.type] || { Icon: Calendar, color: 'var(--app-muted-foreground)', label: ev.type }
                                return (
                                    <div key={i} className="flex gap-3 mb-0.5 group relative">
                                        {/* Dot */}
                                        <div className="flex-shrink-0 w-[22px] flex justify-center pt-2.5 z-10">
                                            <div className="w-2 h-2 rounded-full border-2" style={{
                                                borderColor: ti.color,
                                                background: i === 0 ? ti.color : 'var(--app-bg)',
                                            }} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 py-1.5 flex items-center gap-2">
                                            <ti.Icon size={12} className="flex-shrink-0" style={{ color: ti.color }} />
                                            <span className="text-[12px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                {ev.description}
                                            </span>
                                            {ev.user && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                    {ev.user}
                                                </span>
                                            )}
                                            <span className="ml-auto text-[9px] font-mono tabular-nums flex-shrink-0 opacity-40">
                                                {ev.date ? new Date(ev.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
