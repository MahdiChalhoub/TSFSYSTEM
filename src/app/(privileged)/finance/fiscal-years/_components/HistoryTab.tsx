import { Loader2, Calendar, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react'
import type { YearHistoryEvent } from '@/app/actions/finance/fiscal-year'

interface HistoryTabProps {
    history: { events: YearHistoryEvent[]; je_by_month: { month: string; count: number }[] } | undefined
}

const TYPE_ICON: Record<string, { Icon: typeof Calendar; color: string }> = {
    CREATED:       { Icon: Calendar,     color: 'var(--app-primary)' },
    PERIOD_CLOSED: { Icon: Lock,         color: 'var(--app-muted-foreground)' },
    YEAR_CLOSED:   { Icon: ShieldCheck,  color: 'var(--app-warning, #f59e0b)' },
    CLOSING_ENTRY: { Icon: CheckCircle2, color: 'var(--app-success, #22c55e)' },
    HARD_LOCKED:   { Icon: ShieldCheck,  color: 'var(--app-error, #ef4444)' },
}

export function HistoryTab({ history }: HistoryTabProps) {
    if (!history) return <div className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-app-muted-foreground" /></div>

    const h = history
    return (
        <div className="p-4 space-y-3">
            {/* Timeline */}
            <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Event Log</div>
                <div className="space-y-1">
                    {h.events.map((ev, i) => {
                        const ti = TYPE_ICON[ev.type] || { Icon: Calendar, color: 'var(--app-muted-foreground)' }
                        return (
                            <div key={i} className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                <ti.Icon size={12} style={{ color: ti.color }} />
                                <span className="text-[10px] font-medium flex-1" style={{ color: 'var(--app-foreground)' }}>{ev.description}</span>
                                {ev.user && <span className="text-[9px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>{ev.user}</span>}
                                <span className="text-[9px] font-mono tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {ev.date ? new Date(ev.date).toLocaleDateString() : ''}
                                </span>
                            </div>
                        )
                    })}
                    {h.events.length === 0 && (
                        <div className="text-[11px] font-medium py-4 text-center" style={{ color: 'var(--app-muted-foreground)' }}>No events recorded</div>
                    )}
                </div>
            </div>
            {/* JE by Month */}
            {h.je_by_month.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Journal Entries by Month</div>
                    <div className="flex gap-2 flex-wrap">
                        {h.je_by_month.map(m => (
                            <div key={m.month} className="text-center px-2 py-1 rounded-lg" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="text-[12px] font-black tabular-nums" style={{ color: 'var(--app-primary)' }}>{m.count}</div>
                                <div className="text-[8px] font-bold uppercase" style={{ color: 'var(--app-muted-foreground)' }}>{m.month}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
