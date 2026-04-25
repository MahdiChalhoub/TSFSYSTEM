'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Link2, Link2Off, RefreshCw, Loader2, ChevronDown, Copy, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { getSnapshotChain, type SnapshotChainReport } from '@/app/actions/finance/fiscal-year'

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string; icon: typeof ShieldCheck }> = {
    intact:         { color: 'var(--app-success, #22c55e)', bg: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', label: 'intact',   icon: ShieldCheck },
    content_drift:  { color: 'var(--app-error, #ef4444)',   bg: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)',   label: 'tampered', icon: ShieldAlert },
    chain_break:    { color: 'var(--app-warning, #f59e0b)', bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', label: 'chain broken', icon: Link2Off },
}

const KIND_STYLE: Record<string, { color: string; bg: string }> = {
    year:   { color: 'var(--app-primary)',       bg: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' },
    period: { color: 'var(--app-info, #3b82f6)', bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' },
}

export function SnapshotBrowserCard({ fullHeight = false }: { fullHeight?: boolean }) {
    const [report, setReport] = useState<SnapshotChainReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [cardExpanded, setCardExpanded] = useState(fullHeight)
    const [userToggled, setUserToggled] = useState(fullHeight)

    const load = useCallback(async () => {
        setLoading(true)
        try { setReport(await getSnapshotChain()) }
        finally { setLoading(false) }
    }, [])
    useEffect(() => { void load() }, [load])

    // Auto-expand only when the chain is broken — stay calm when intact.
    useEffect(() => {
        if (!userToggled && report) setCardExpanded(!report.clean)
    }, [report, userToggled])

    const copyHash = (h: string | null | undefined) => {
        if (!h) return
        void navigator.clipboard.writeText(h)
        toast.success('Hash copied to clipboard')
    }

    if (loading && !report) {
        return <div className="p-4 text-center"><Loader2 size={16} className="animate-spin mx-auto" style={{ color: 'var(--app-muted-foreground)' }} /></div>
    }
    if (!report) return null

    return (
        <div className={`rounded-xl overflow-hidden flex flex-col ${fullHeight ? 'flex-1 min-h-0' : ''}`} style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            {/* Header */}
            {fullHeight ? (
                <div className="px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0"
                    style={{
                        borderBottom: '1px solid var(--app-border)',
                        background: report.clean
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 5%, transparent)'
                            : 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)',
                    }}>
                    <div className="flex items-center gap-2 min-w-0">
                        {report.clean
                            ? <ShieldCheck size={14} style={{ color: 'var(--app-success, #22c55e)' }} />
                            : <ShieldAlert size={14} style={{ color: 'var(--app-error, #ef4444)' }} />}
                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                            {report.rows_checked} snapshots · {report.breaks} break{report.breaks === 1 ? '' : 's'}
                        </span>
                    </div>
                    <button onClick={() => void load()} disabled={loading}
                        className="p-1 rounded hover:opacity-70" title="Re-verify chain">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--app-muted-foreground)' }} />
                    </button>
                </div>
            ) : (
            <button onClick={() => { setCardExpanded(v => !v); setUserToggled(true) }}
                aria-expanded={cardExpanded}
                className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left"
                style={{
                    borderBottom: cardExpanded ? '1px solid var(--app-border)' : 'none',
                    background: report.clean
                        ? 'color-mix(in srgb, var(--app-success, #22c55e) 5%, transparent)'
                        : 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)',
                }}>
                <div className="flex items-center gap-2 min-w-0">
                    {report.clean
                        ? <ShieldCheck size={14} style={{ color: 'var(--app-success, #22c55e)' }} />
                        : <ShieldAlert size={14} style={{ color: 'var(--app-error, #ef4444)' }} />}
                    <span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                        Snapshot hash chain
                    </span>
                    <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                        {report.rows_checked} snapshots · {report.breaks} break{report.breaks === 1 ? '' : 's'}
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span onClick={(e) => { e.stopPropagation(); void load() }}
                        role="button" tabIndex={-1}
                        aria-disabled={loading}
                        className="p-1 rounded hover:opacity-70" title="Re-verify chain">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--app-muted-foreground)' }} />
                    </span>
                    {cardExpanded
                        ? <ChevronUp size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                        : <ChevronDown size={14} style={{ color: 'var(--app-muted-foreground)' }} />}
                </div>
            </button>
            )}

            {(cardExpanded || fullHeight) && (<>
                {/* Explanation banner — shown in tab mode */}
                {fullHeight && (
                    <div className="px-4 py-3 flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <p className="text-tp-sm font-medium" style={{ color: 'var(--app-foreground)' }}>
                            Every time you close a period or year, the system takes a <strong>cryptographic snapshot</strong> of your financial data. These snapshots are chained together — if anyone modifies data after the close, the chain breaks and you'll know.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-2">
                            <span className="inline-flex items-center gap-1 text-tp-xs font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>
                                <ShieldCheck size={11} /> Intact — data unchanged since close
                            </span>
                            <span className="inline-flex items-center gap-1 text-tp-xs font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                <ShieldAlert size={11} /> Tampered — data was modified after close
                            </span>
                            <span className="inline-flex items-center gap-1 text-tp-xs font-bold" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                <Link2Off size={11} /> Chain break — snapshot deleted or corrupted
                            </span>
                        </div>
                        <p className="text-tp-xs font-medium mt-1.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            Check before audits or if you suspect unauthorized changes. For daily work, green = you're good.
                        </p>
                    </div>
                )}

                {report.chain.length === 0 ? (
                <div className="px-3 py-6 text-center text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                    No snapshots yet. First year- or period-close will seed the chain.
                </div>
            ) : (
                <div>
                    {/* Column headers */}
                    <div className="grid gap-2 px-3 py-1 text-tp-xxs font-bold uppercase tracking-wide"
                        style={{
                            gridTemplateColumns: '90px 1fr 90px 160px 140px 100px',
                            color: 'var(--app-muted-foreground)',
                            borderBottom: '1px solid var(--app-border)',
                        }}>
                        <div>Kind</div>
                        <div>Subject</div>
                        <div>Scope</div>
                        <div>Captured</div>
                        <div>Hash · Prev</div>
                        <div className="text-right">Status</div>
                    </div>

                    {report.chain.map((row, idx) => {
                        const statusStyle = STATUS_STYLE[row.status] || STATUS_STYLE.intact
                        const kindStyle = KIND_STYLE[row.kind]
                        const StatusIcon = statusStyle.icon
                        const isExpanded = expandedId === row.id
                        return (
                            <div key={`${row.kind}-${row.id}`}>
                                <button onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                    className="w-full grid gap-2 px-3 py-2 items-center text-left transition-colors hover:bg-app-surface/50"
                                    style={{
                                        gridTemplateColumns: '90px 1fr 90px 160px 140px 100px',
                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                    }}>
                                    {/* Kind pill */}
                                    <div>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-tp-xxs font-bold"
                                            style={{ background: kindStyle.bg, color: kindStyle.color }}>
                                            {row.kind.toUpperCase()}
                                        </span>
                                    </div>
                                    {/* Subject */}
                                    <div className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                        {row.label}
                                    </div>
                                    {/* Scope */}
                                    <div className="text-tp-xxs font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {row.scope}
                                    </div>
                                    {/* Captured */}
                                    <div className="text-tp-xxs font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {row.captured_at ? new Date(row.captured_at).toLocaleString() : '—'}
                                    </div>
                                    {/* Hash / prev */}
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-tp-xxs font-mono truncate flex items-center gap-1"
                                            style={{ color: 'var(--app-foreground)' }}
                                            title={row.content_hash || ''}>
                                            <Link2 size={10} style={{ color: 'var(--app-muted-foreground)' }} />
                                            {row.content_hash?.slice(0, 12)}…
                                        </span>
                                        <span className="text-tp-xxs font-mono truncate"
                                            style={{ color: 'var(--app-muted-foreground)' }}
                                            title={row.prev_hash || 'genesis'}>
                                            prev: {row.prev_hash ? row.prev_hash.slice(0, 12) + '…' : 'genesis'}
                                        </span>
                                    </div>
                                    {/* Status pill */}
                                    <div className="flex items-center gap-1 justify-end">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-tp-xxs font-bold"
                                            style={{ background: statusStyle.bg, color: statusStyle.color }}>
                                            <StatusIcon size={10} /> {statusStyle.label}
                                        </span>
                                    </div>
                                </button>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="px-3 py-3 space-y-2"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 20%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                                        <div className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Chain position #{idx + 1} of {report.chain.length}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-tp-xs font-mono">
                                            <div>
                                                <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>content_hash</div>
                                                <div className="flex items-center gap-1 break-all" style={{ color: 'var(--app-foreground)' }}>
                                                    {row.content_hash}
                                                    <button onClick={(e) => { e.stopPropagation(); copyHash(row.content_hash) }}
                                                        className="ml-1 opacity-60 hover:opacity-100">
                                                        <Copy size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>prev_hash</div>
                                                <div className="break-all" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {row.prev_hash || '(genesis — first snapshot in chain)'}
                                                </div>
                                            </div>
                                            {row.status === 'content_drift' && row.recomputed_hash && (
                                                <div className="col-span-2 p-2 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)' }}>
                                                    <div className="text-tp-xxs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--app-error, #ef4444)' }}>
                                                        Content drift detected
                                                    </div>
                                                    <div className="text-tp-xxs" style={{ color: 'var(--app-foreground)' }}>
                                                        Stored hash does not match recompute — snapshot was modified after capture.
                                                    </div>
                                                    <div className="text-tp-xxs mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        recomputed: <span style={{ color: 'var(--app-foreground)' }}>{row.recomputed_hash}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {row.status === 'chain_break' && (
                                                <div className="col-span-2 p-2 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)' }}>
                                                    <div className="text-tp-xxs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                                        Chain break
                                                    </div>
                                                    <div className="text-tp-xxs" style={{ color: 'var(--app-foreground)' }}>
                                                        This row's prev_hash doesn't match the previous snapshot's content_hash.
                                                    </div>
                                                    <div className="text-tp-xxs mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        expected prev: <span style={{ color: 'var(--app-foreground)' }}>{row.expected_prev || '(none)'}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
            </>)}
        </div>
    )
}
