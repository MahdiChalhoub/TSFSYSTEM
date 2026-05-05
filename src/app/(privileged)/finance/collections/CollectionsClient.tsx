'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
    AlertCircle, Send, Loader2, Mail, Phone, MessageSquare, FileText,
    TrendingUp, RefreshCw, Search, Filter, Clock, Check, X, History,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getOverdueCustomers, getDunningHistory, sendDunningReminder,
    type OverdueCustomerRow, type OverdueReport, type DunningHistoryRow,
} from '@/app/actions/finance/collections'

const BUCKET_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    current:  { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',    color: 'var(--app-info, #3b82f6)',    label: '1-14 days' },
    '30_days':{ bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', color: 'var(--app-warning, #f59e0b)', label: '15-44 days' },
    '60_days':{ bg: 'color-mix(in srgb, var(--app-warning) 12%, transparent)',                     color: 'var(--app-warning)',                     label: '45-89 days' },
    '90_plus':{ bg: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)',   color: 'var(--app-error, #ef4444)',   label: '90+ days' },
}

const LEVEL_LABEL: Record<number, string> = {
    1: 'L1 · Friendly',
    2: 'L2 · Formal',
    3: 'L3 · Final',
    4: 'L4 · LEGAL',
}

const METHOD_ICON: Record<string, typeof Mail> = {
    EMAIL: Mail, SMS: MessageSquare, CALL: Phone, POST: FileText, PORTAL: FileText,
}

function fmtMoney(s: string): string {
    const n = Number(s)
    if (!Number.isFinite(n)) return s
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CollectionsClient({ initialReport }: { initialReport: OverdueReport | null }) {
    const [report, setReport] = useState<OverdueReport | null>(initialReport)
    const [loading, setLoading] = useState(false)
    const [bucketFilter, setBucketFilter] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
    const [history, setHistory] = useState<DunningHistoryRow[]>([])
    const [showHistoryFor, setShowHistoryFor] = useState<number | null>(null)
    const [isPending, startTransition] = useTransition()

    const reload = useCallback(async () => {
        setLoading(true)
        try { setReport(await getOverdueCustomers()) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        if (!showHistoryFor) return
        void (async () => setHistory(await getDunningHistory(showHistoryFor, 20)))()
    }, [showHistoryFor])

    const filteredRows = useMemo(() => {
        if (!report) return []
        let rows = report.rows
        if (bucketFilter) rows = rows.filter(r => r.bucket === bucketFilter)
        if (search.trim()) {
            const q = search.toLowerCase()
            rows = rows.filter(r =>
                r.contact_name.toLowerCase().includes(q) ||
                r.contact_email.toLowerCase().includes(q)
            )
        }
        return rows
    }, [report, bucketFilter, search])

    const sendReminder = (row: OverdueCustomerRow, level: number) => {
        startTransition(async () => {
            const res = await sendDunningReminder(row.contact_id, level)
            if (res.success) {
                toast.success(`L${level} reminder sent to ${row.contact_name}`)
                await reload()
                if (showHistoryFor === row.contact_id) {
                    setHistory(await getDunningHistory(row.contact_id, 20))
                }
            } else {
                toast.error(res.error || 'Failed to send reminder')
            }
        })
    }

    if (!report) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--app-muted-foreground)' }} />
            </div>
        )
    }

    const buckets = ['current', '30_days', '60_days', '90_plus']

    return (
        <div className="flex-1 flex flex-col p-3 md:p-4 gap-3 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 style={{ color: 'var(--app-foreground)' }}>
                        Collections
                    </h1>
                    <p className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                        Overdue receivables · Dunning workflow
                    </p>
                </div>
                <button onClick={() => void reload()} disabled={loading}
                    className="flex items-center gap-1.5 text-tp-xs font-bold px-2 py-1 rounded-lg border"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
                </button>
            </div>

            {/* KPI bucket strip */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <button onClick={() => setBucketFilter(null)}
                    className="text-left p-3 rounded-xl transition-all"
                    style={{
                        background: bucketFilter === null ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                    }}>
                    <div className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                        All overdue
                    </div>
                    <div className="flex items-baseline gap-2">
                        <div className="text-tp-xl font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                            {report.summary.customers}
                        </div>
                        <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>customers</div>
                    </div>
                    <div className="text-tp-xs font-mono tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                        {fmtMoney(report.summary.total_overdue)}
                    </div>
                </button>
                {buckets.map(b => {
                    const count = report.summary.buckets[b] ?? 0
                    const style = BUCKET_STYLE[b]
                    const active = bucketFilter === b
                    return (
                        <button key={b} onClick={() => setBucketFilter(active ? null : b)}
                            className="text-left p-3 rounded-xl transition-all"
                            style={{
                                background: active ? style.bg : 'var(--app-surface)',
                                border: '1px solid ' + (active ? style.color : 'var(--app-border)'),
                            }}>
                            <div className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: style.color }}>
                                {style.label}
                            </div>
                            <div className="flex items-baseline gap-2">
                                <div className="text-tp-xl font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                                    {count}
                                </div>
                                <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>customers</div>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Filter by customer name or email..."
                        className="w-full pl-9 pr-3 py-2 text-tp-sm rounded-xl outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                {bucketFilter && (
                    <button onClick={() => setBucketFilter(null)}
                        className="text-tp-xs font-bold px-2 py-1.5 rounded-lg flex items-center gap-1"
                        style={{ background: BUCKET_STYLE[bucketFilter].bg, color: BUCKET_STYLE[bucketFilter].color }}>
                        <Filter size={11} /> {BUCKET_STYLE[bucketFilter].label} <X size={11} />
                    </button>
                )}
            </div>

            {/* Overdue table */}
            <div className="flex-1 min-h-0 overflow-hidden rounded-xl"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                {filteredRows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                        <Check size={32} className="opacity-40 mb-3" style={{ color: 'var(--app-success, #22c55e)' }} />
                        <p className="text-tp-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                            {report.summary.customers === 0
                                ? 'No overdue customers — everyone is current.'
                                : 'No matches for this filter.'}
                        </p>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        {/* Header row */}
                        <div className="grid gap-2 px-3 py-2 text-tp-xxs font-bold uppercase tracking-wide sticky top-0 z-10"
                            style={{
                                gridTemplateColumns: '1fr 120px 80px 110px 110px 280px',
                                color: 'var(--app-muted-foreground)',
                                background: 'var(--app-surface)',
                                borderBottom: '1px solid var(--app-border)',
                            }}>
                            <div>Customer</div>
                            <div className="text-right">Overdue</div>
                            <div className="text-center">Invoices</div>
                            <div className="text-right">Oldest</div>
                            <div className="text-center">Last reminder</div>
                            <div className="text-right">Action</div>
                        </div>

                        {filteredRows.map(row => {
                            const style = BUCKET_STYLE[row.bucket]
                            const isSelected = selectedContactId === row.contact_id
                            return (
                                <div key={row.contact_id}>
                                    <div onClick={() => setSelectedContactId(isSelected ? null : row.contact_id)}
                                        className="grid gap-2 px-3 py-2 items-center cursor-pointer transition-colors"
                                        style={{
                                            gridTemplateColumns: '1fr 120px 80px 110px 110px 280px',
                                            background: isSelected ? 'color-mix(in srgb, var(--app-border) 30%, transparent)' : 'transparent',
                                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                        }}>
                                        {/* Customer */}
                                        <div className="min-w-0">
                                            <div className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                {row.contact_name}
                                            </div>
                                            {row.contact_email && (
                                                <div className="text-tp-xxs truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {row.contact_email}
                                                </div>
                                            )}
                                        </div>
                                        {/* Overdue */}
                                        <div className="text-right font-mono tabular-nums text-tp-sm font-bold"
                                            style={{ color: style.color }}>
                                            {fmtMoney(row.total_overdue)}
                                        </div>
                                        {/* Invoice count */}
                                        <div className="text-center text-tp-xs font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {row.invoice_count}
                                        </div>
                                        {/* Oldest */}
                                        <div className="text-right">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-tp-xxs font-bold"
                                                style={{ background: style.bg, color: style.color }}>
                                                <Clock size={10} /> {row.oldest_days}d
                                            </span>
                                        </div>
                                        {/* Last reminder */}
                                        <div className="text-center">
                                            {row.last_reminder_level > 0 ? (
                                                <div>
                                                    <div className="text-tp-xs font-bold" style={{ color: 'var(--app-foreground)' }}>
                                                        L{row.last_reminder_level}
                                                    </div>
                                                    <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        {row.last_reminder_sent_at ? new Date(row.last_reminder_sent_at).toLocaleDateString() : ''}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-tp-xxs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>—</span>
                                            )}
                                        </div>
                                        {/* Action */}
                                        <div className="flex items-center justify-end gap-1 flex-wrap">
                                            {[1, 2, 3, 4].map(lvl => {
                                                const suggested = lvl === row.next_suggested_level
                                                return (
                                                    <button key={lvl}
                                                        onClick={e => { e.stopPropagation(); sendReminder(row, lvl) }}
                                                        disabled={isPending}
                                                        className="text-tp-xxs font-bold px-1.5 py-1 rounded-md border transition-all disabled:opacity-40"
                                                        style={{
                                                            background: suggested ? 'var(--app-primary)' : 'transparent',
                                                            color: suggested ? 'white' : 'var(--app-muted-foreground)',
                                                            borderColor: suggested ? 'var(--app-primary)' : 'var(--app-border)',
                                                        }}
                                                        title={`Send ${LEVEL_LABEL[lvl]}`}>
                                                        {LEVEL_LABEL[lvl].split(' · ')[0]}
                                                    </button>
                                                )
                                            })}
                                            <button onClick={e => { e.stopPropagation(); setShowHistoryFor(row.contact_id) }}
                                                className="p-1 rounded-md hover:bg-app-surface/70"
                                                title="History">
                                                <History size={12} style={{ color: 'var(--app-muted-foreground)' }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* History modal */}
            {showHistoryFor !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setShowHistoryFor(null)}>
                    <div onClick={e => e.stopPropagation()}
                        className="rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="px-4 py-3 flex items-center justify-between"
                            style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <div>
                                <div className="text-tp-xs font-bold uppercase" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Dunning history
                                </div>
                                <div className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                    {filteredRows.find(r => r.contact_id === showHistoryFor)?.contact_name || `Contact ${showHistoryFor}`}
                                </div>
                            </div>
                            <button onClick={() => setShowHistoryFor(null)} className="p-1">
                                <X size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                            {history.length === 0 ? (
                                <div className="text-tp-sm text-center py-8" style={{ color: 'var(--app-muted-foreground)' }}>
                                    No reminders sent yet.
                                </div>
                            ) : history.map(h => {
                                const Icon = METHOD_ICON[h.method] || Mail
                                return (
                                    <div key={h.id} className="p-2 rounded-lg flex items-start gap-2"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }}>
                                        <Icon size={14} className="mt-1 flex-shrink-0" style={{ color: 'var(--app-primary)' }} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                                                    {LEVEL_LABEL[h.level]}
                                                </span>
                                                <span className="text-tp-xxs font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {h.sent_at ? new Date(h.sent_at).toLocaleString() : '—'}
                                                </span>
                                            </div>
                                            <div className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                                {h.method} · status: {h.status} · amount: {fmtMoney(h.amount_overdue)} · {h.invoices_referenced_count} invoice(s)
                                            </div>
                                            {h.subject && (
                                                <div className="text-tp-xs mt-1 font-mono truncate" style={{ color: 'var(--app-foreground)' }}>
                                                    {h.subject}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
