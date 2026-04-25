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
    if (!history) return <div className="p-8 text-center flex flex-col items-center gap-2">
        <Loader2 size={24} className="animate-spin text-(--app-primary)" />
        <span className="text-[11px] font-bold text-(--app-muted-foreground)">Indexing journal history...</span>
    </div>

    const h = history
    return (
        <div className="flex flex-col min-h-0">
            {/* Monthly stats header — simplified from cards to a clean badge row */}
            <div className="px-6 py-4 border-b border-(--app-border)/40 bg-(--app-surface)/10">
                <div className="text-[10px] font-black uppercase tracking-[0.1em] mb-3 text-(--app-muted-foreground)">Activity Density (JEs per month)</div>
                <div className="flex gap-2 flex-wrap">
                    {h.je_by_month.map(m => (
                        <div key={m.month} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-(--app-border)/40 bg-(--app-bg)" title={`${m.count} Journal Entries`}>
                            <span className="text-[9px] font-black uppercase text-(--app-muted-foreground)">{m.month.slice(0, 3)}</span>
                            <span className="text-[12px] font-black tabular-nums text-(--app-primary)">{m.count}</span>
                        </div>
                    ))}
                    {h.je_by_month.length === 0 && <span className="text-[11px] text-(--app-muted-foreground) italic opacity-50">No ledger activity recorded yet</span>}
                </div>
            </div>

            {/* Event Timeline */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.1em] mb-4 text-(--app-muted-foreground)">Governance Timeline</div>
                <div className="space-y-4">
                    {h.events.map((ev, i) => {
                        const ti = TYPE_ICON[ev.type] || { Icon: Calendar, color: 'var(--app-muted-foreground)' }
                        return (
                            <div key={i} className="flex gap-4 group">
                                <div className="flex flex-col items-center pt-1">
                                    <div className="p-1.5 rounded-full border border-current bg-current/10" style={{ color: ti.color }}>
                                        <ti.Icon size={12} />
                                    </div>
                                    {i < h.events.length - 1 && <div className="flex-1 w-px bg-(--app-border)/40 mt-1" />}
                                </div>
                                <div className="flex-1 pb-4">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[12px] font-bold text-(--app-foreground)">{ev.description}</span>
                                        <span className="text-[10px] font-mono opacity-50">{ev.date ? new Date(ev.date).toLocaleDateString() : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {ev.user && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.25 rounded bg-(--app-surface) text-(--app-muted-foreground) border border-(--app-border)/40">
                                                {ev.user}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-30 group-hover:opacity-60 transition-opacity">{ev.type}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

