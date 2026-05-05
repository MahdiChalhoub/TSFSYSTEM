'use client'

import { useEffect, useState } from 'react'
import {
    Calendar, BarChart3, History, BookOpen, ShieldCheck,
    Lock, ArrowLeft, Loader2, X,
} from 'lucide-react'
import { getYearSummary, getYearHistory, type YearSummary, type YearHistoryEvent } from '@/app/actions/finance/fiscal-year'

type TabId = 'periods' | 'summary' | 'history' | 'entries' | 'snapshots'

interface YearShape {
    id: number
    name: string
    startDate: string
    endDate: string
    status?: string
    isHardLocked?: boolean
    periods?: Array<{ id: number; name: string; status?: string; start_date: string; end_date: string }>
}

interface Props {
    year: YearShape
    onClose: () => void
    onYearEndClose: () => void
    onSoftClose: () => void
}

const TABS: { id: TabId; label: string; Icon: typeof Calendar }[] = [
    { id: 'periods', label: 'Periods', Icon: Calendar },
    { id: 'summary', label: 'Summary', Icon: BarChart3 },
    { id: 'history', label: 'History', Icon: History },
    { id: 'entries', label: 'Closing', Icon: BookOpen },
    { id: 'snapshots', label: 'Snaps', Icon: ShieldCheck },
]

export function MobileYearDetailSheet({ year, onClose, onYearEndClose, onSoftClose }: Props) {
    const [activeTab, setActiveTab] = useState<TabId>('periods')
    const [summary, setSummary] = useState<YearSummary | null>(null)
    const [history, setHistory] = useState<{ events: YearHistoryEvent[]; je_by_month: { month: string; count: number }[] } | null>(null)
    const [loading, setLoading] = useState(false)

    // Lazy-load data per tab — first time only.
    useEffect(() => {
        let alive = true
        async function load() {
            if (activeTab === 'summary' && !summary) {
                setLoading(true)
                const s = await getYearSummary(year.id)
                if (alive) setSummary(s)
                if (alive) setLoading(false)
            } else if (activeTab === 'history' && !history) {
                setLoading(true)
                const h = await getYearHistory(year.id)
                if (alive) setHistory(h)
                if (alive) setLoading(false)
            } else if (activeTab === 'entries' && !summary) {
                setLoading(true)
                const s = await getYearSummary(year.id)
                if (alive) setSummary(s)
                if (alive) setLoading(false)
            }
        }
        void load()
        return () => { alive = false }
    }, [activeTab, year.id, summary, history])

    const status = year.isHardLocked ? 'FINALIZED' : (year.status || 'OPEN')
    const periods = [...(year.periods || [])].sort((a, b) =>
        (a.start_date || '').localeCompare(b.start_date || '')
    )

    const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <ArrowLeft size={16} style={{ color: 'var(--app-muted-foreground)' }} />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="truncate" style={{ color: 'var(--app-foreground)' }}>
                        {year.name}
                    </h2>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
                        {year.startDate} → {year.endDate} · {status}
                    </p>
                </div>
                {status === 'OPEN' && !year.isHardLocked && (
                    <button onClick={onYearEndClose}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)', color: 'var(--app-error, #ef4444)' }}
                        title="Year-End Close">
                        <Lock size={14} />
                    </button>
                )}
            </div>

            {/* Tabs strip — horizontal scroll on small screens */}
            <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto flex-shrink-0"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                {TABS.map(({ id, label, Icon }) => {
                    const active = activeTab === id
                    return (
                        <button key={id} onClick={() => setActiveTab(id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-shrink-0"
                            style={{
                                background: active ? 'var(--app-primary)' : 'transparent',
                                color: active ? 'white' : 'var(--app-muted-foreground)',
                            }}>
                            <Icon size={12} />
                            {label}
                        </button>
                    )
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading && (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--app-muted-foreground)' }} />
                    </div>
                )}

                {activeTab === 'periods' && !loading && (
                    <div className="space-y-2">
                        {periods.length === 0 ? (
                            <div className="text-center py-8 text-[12px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                No periods configured.
                            </div>
                        ) : periods.map(p => {
                            const pStatus = p.status || 'OPEN'
                            const pColor = pStatus === 'OPEN'
                                ? 'var(--app-success, #22c55e)'
                                : pStatus === 'CLOSED' ? 'var(--app-warning, #f59e0b)'
                                    : pStatus === 'HARD_LOCKED' ? 'var(--app-error, #ef4444)'
                                        : 'var(--app-muted-foreground)'
                            return (
                                <div key={p.id} className="p-3 rounded-xl flex items-center gap-3"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pColor }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-bold" style={{ color: 'var(--app-foreground)' }}>{p.name}</div>
                                        <div className="text-[10px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {p.start_date} → {p.end_date}
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                        style={{ background: `color-mix(in srgb, ${pColor} 10%, transparent)`, color: pColor }}>
                                        {pStatus}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}

                {activeTab === 'summary' && summary && !loading && (
                    <div className="space-y-3">
                        {/* P&L card */}
                        <div className="p-4 rounded-2xl space-y-3"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Profit &amp; Loss
                                </div>
                                <div className="text-[9px] font-bold uppercase opacity-50">Activity this year</div>
                            </div>
                            {[
                                { label: 'Revenue', value: summary.pnl?.revenue ?? 0, color: 'var(--app-success, #22c55e)' },
                                { label: 'Expenses', value: summary.pnl?.expenses ?? 0, color: 'var(--app-error, #ef4444)' },
                                { label: (summary.pnl?.net_income ?? 0) >= 0 ? 'Net Income' : 'Net Loss', value: summary.pnl?.net_income ?? 0, color: (summary.pnl?.net_income ?? 0) >= 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' },
                            ].map(v => (
                                <div key={v.label} className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wide opacity-60">{v.label}</span>
                                    <span className="text-[14px] font-black tabular-nums" style={{ color: v.color }}>
                                        {fmt(v.value)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Balance Sheet card */}
                        <div className="p-4 rounded-2xl space-y-3"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Balance Sheet
                                </div>
                                <div className="text-[9px] font-bold uppercase opacity-50">Position at year-end</div>
                            </div>
                            {[
                                { label: 'Assets', value: summary.balance_sheet?.assets ?? 0, color: 'var(--app-info, #3b82f6)' },
                                { label: 'Liabilities', value: summary.balance_sheet?.liabilities ?? 0, color: 'var(--app-error, #ef4444)' },
                                { label: 'Equity', value: summary.balance_sheet?.equity ?? 0, color: 'var(--app-primary)' },
                            ].map(v => (
                                <div key={v.label} className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wide opacity-60">{v.label}</span>
                                    <span className="text-[14px] font-black tabular-nums" style={{ color: v.color }}>
                                        {fmt(v.value)}
                                    </span>
                                </div>
                            ))}
                            {/* Identity self-check */}
                            {(() => {
                                const a = summary.balance_sheet?.assets ?? 0
                                const l = summary.balance_sheet?.liabilities ?? 0
                                const e = summary.balance_sheet?.equity ?? 0
                                const ni = summary.pnl?.net_income ?? 0
                                const gap = a - l - e
                                const isClosed = (summary.year?.status === 'CLOSED' || summary.year?.status === 'FINALIZED') && summary.closing_entry
                                const looksRight = isClosed ? Math.abs(gap) < 0.01 : Math.abs(gap - ni) < 0.01
                                return (
                                    <div className="text-[10px] font-medium pt-1.5 border-t" style={{ color: looksRight ? 'var(--app-muted-foreground)' : 'var(--app-error, #ef4444)', borderColor: 'var(--app-border)' }}>
                                        {looksRight ? '✓' : '⚠'} A − L − E = {fmt(gap)}
                                        {!isClosed && looksRight && ' · matches P&L net'}
                                        {isClosed && looksRight && ' · year closed'}
                                    </div>
                                )
                            })()}
                        </div>

                        {/* JE counts */}
                        <div className="p-4 rounded-2xl flex items-center justify-around"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            {[
                                { label: 'Total JEs', value: summary.journal_entries?.total ?? 0, color: 'var(--app-foreground)' },
                                { label: 'Posted', value: summary.journal_entries?.posted ?? 0, color: 'var(--app-success, #22c55e)' },
                                ...(summary.journal_entries?.draft ? [{ label: 'Draft', value: summary.journal_entries.draft, color: 'var(--app-warning, #f59e0b)' }] : []),
                            ].map(v => (
                                <div key={v.label} className="text-center">
                                    <div className="text-[15px] font-black tabular-nums" style={{ color: v.color }}>{v.value}</div>
                                    <div className="text-[9px] font-bold uppercase opacity-50">{v.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && history && !loading && (
                    <div className="space-y-2">
                        {history.events.length === 0 ? (
                            <div className="text-center py-8 text-[12px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                No history yet.
                            </div>
                        ) : history.events.map((e, i) => (
                            <div key={i} className="p-3 rounded-xl"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--app-primary)' }}>
                                        {e.type}
                                    </span>
                                    <span className="text-[10px] font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {e.date?.slice(0, 10)}
                                    </span>
                                </div>
                                <div className="text-[12px] font-medium" style={{ color: 'var(--app-foreground)' }}>{e.description}</div>
                                {e.user && (
                                    <div className="text-[10px] mt-1 opacity-60" style={{ color: 'var(--app-muted-foreground)' }}>
                                        by {e.user}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'entries' && summary && !loading && (
                    <div className="space-y-3">
                        {(summary.closing_entries || (summary.closing_entry ? [summary.closing_entry] : [])).length === 0 ? (
                            <div className="text-center py-8 text-[12px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                No closing entries yet — run Year-End Close.
                            </div>
                        ) : (summary.closing_entries || [summary.closing_entry!]).map((ce, i) => (
                            <div key={i} className="p-4 rounded-2xl"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[12px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                        {ce.reference}
                                    </span>
                                    <span className="text-[9px] font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {ce.date}
                                    </span>
                                </div>
                                <div className="text-[11px] mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {ce.description}
                                </div>
                                <div className="space-y-1 text-[10px] font-mono">
                                    {ce.lines.map((l, j) => (
                                        <div key={j} className="flex items-center justify-between">
                                            <span className="truncate flex-1 mr-2" style={{ color: 'var(--app-foreground)' }}>
                                                {l.code} {l.name}
                                            </span>
                                            <span className="tabular-nums opacity-70">
                                                {l.debit > 0 ? `Dr ${fmt(l.debit)}` : `Cr ${fmt(l.credit)}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'snapshots' && !loading && (
                    <div className="text-center py-8 text-[12px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                        Snapshot integrity verification is desktop-only —
                        the chain visualizer needs more horizontal space.
                        Open this page on desktop to audit the hash chain.
                    </div>
                )}
            </div>

            {/* Footer actions */}
            {status === 'OPEN' && !year.isHardLocked && (
                <div className="px-4 py-3 flex gap-2 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onSoftClose}
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
                        style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 14%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                        <Lock size={12} /> Soft Close
                    </button>
                    <button onClick={onYearEndClose}
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 text-white"
                        style={{ background: 'var(--app-error, #ef4444)' }}>
                        <ShieldCheck size={12} /> Year-End Close
                    </button>
                </div>
            )}
        </div>
    )
}
