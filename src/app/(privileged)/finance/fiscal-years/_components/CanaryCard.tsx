'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, RefreshCw, Loader2, ChevronDown } from 'lucide-react'
import { getIntegrityCanary, type CanaryReport } from '@/app/actions/finance/fiscal-year'

type Signal = {
    key: string
    label: string
    clean: boolean
    count: number
    detail?: string
}

function buildSignals(d: CanaryReport['details'][number]): Signal[] {
    return [
        {
            key: 'ob_je_chain',
            label: 'OB ↔ JE chain',
            clean: d.safe,
            count: d.years_drift + d.years_missing_je,
            detail: d.first_broken_year ? `first broken: ${d.first_broken_year}` : undefined,
        },
        {
            key: 'parent_purity',
            label: 'Parent-balance purity',
            clean: d.parent_purity_clean,
            count: d.parent_offender_count,
        },
        {
            key: 'subledger',
            label: 'Sub-ledger integrity',
            clean: d.subledger_clean,
            count: d.subledger_offender_count,
        },
        {
            key: 'snapshot_chain',
            label: 'Snapshot hash chain',
            clean: d.snapshot_chain_clean,
            count: d.snapshot_chain_breaks,
            detail: `${d.snapshot_chain_rows} row(s) checked`,
        },
        {
            key: 'balance_integrity',
            label: 'Balance vs recompute',
            clean: d.balance_integrity_clean,
            count: d.balance_integrity_drifted_accounts,
        },
        {
            key: 'fx_integrity',
            label: 'FX revaluation',
            clean: d.fx_integrity_clean ?? true,
            count: (d.fx_stale_rate_lines ?? 0) + (d.fx_missing_revaluations ?? 0) + (d.fx_orphaned_revaluations ?? 0),
        },
        {
            key: 'revenue_recognition',
            label: 'Revenue recognition',
            clean: d.revenue_recognition_clean ?? true,
            count: (d.revenue_overdue_rows ?? 0) + (d.revenue_orphan_obligations ?? 0) + (d.revenue_over_recognised ?? 0),
        },
        {
            key: 'consolidation',
            label: 'Consolidation',
            clean: d.consolidation_clean ?? true,
            count: (d.consolidation_failed_runs ?? 0) + (d.consolidation_missing_ic ?? 0) + (d.consolidation_missing_runs ?? 0),
        },
        {
            key: 'close_checklist',
            label: 'Close checklist',
            clean: d.close_checklist_clean ?? true,
            count: (d.close_checklist_abandoned ?? 0) + (d.close_checklist_overdue ?? 0),
        },
        {
            key: 'realized_fx',
            label: 'Realized FX',
            clean: d.realized_fx_clean ?? true,
            count: d.realized_fx_missing ?? 0,
        },
        {
            key: 'tax_coverage',
            label: 'Tax country coverage',
            clean: d.tax_coverage_clean ?? true,
            count: d.tax_uncovered_countries ?? 0,
            detail: d.tax_uncovered_top?.length
                ? `missing: ${d.tax_uncovered_top.join(', ')}`
                : undefined,
        },
    ]
}

export function CanaryCard() {
    const [report, setReport] = useState<CanaryReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(false)
    const [userToggled, setUserToggled] = useState(false)

    const run = async () => {
        setLoading(true)
        try {
            const r = await getIntegrityCanary()
            setReport(r)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { void run() }, [])

    const detail = report?.details?.[0]
    const signals = detail ? buildSignals(detail) : []
    const allClean = signals.every(s => s.clean)
    const dirtyCount = signals.filter(s => !s.clean).length

    // Auto-expand on dirty state unless the user has explicitly set a preference.
    useEffect(() => {
        if (!loading && detail && !userToggled) setExpanded(!allClean)
    }, [loading, detail, allClean, userToggled])

    return (
        <div className="rounded-2xl p-3 mb-2" style={{
            background: 'var(--app-surface)',
            border: '1px solid var(--app-border)',
        }}>
            {/* Header row */}
            <button
                onClick={() => { setExpanded(e => !e); setUserToggled(true) }}
                aria-expanded={expanded}
                className="w-full flex items-center justify-between gap-3 text-left"
            >
                <div className="flex items-center gap-2 min-w-0">
                    {loading ? (
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--app-muted-foreground)' }} />
                    ) : allClean ? (
                        <ShieldCheck size={16} style={{ color: 'var(--app-success, #22c55e)' }} />
                    ) : (
                        <ShieldAlert size={16} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                    )}
                    <span className="text-tp-sm font-bold uppercase tracking-wide" style={{ color: 'var(--app-foreground)' }}>
                        Close-chain integrity
                    </span>
                    {!loading && detail && (
                        <span className="text-tp-xs font-medium truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                            {allClean ? `All ${signals.length} signals clean` : `${dirtyCount} of ${signals.length} signal(s) need attention`}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {report?.ran_at && (
                        <span className="text-tp-xxs font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                            {new Date(report.ran_at).toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); void run() }}
                        disabled={loading}
                        className="p-1 rounded hover:opacity-70 disabled:opacity-30"
                        title="Re-run canary"
                    >
                        <RefreshCw size={12} style={{ color: 'var(--app-muted-foreground)' }} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <ChevronDown size={14} style={{
                        color: 'var(--app-muted-foreground)',
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 150ms',
                    }} />
                </div>
            </button>

            {/* Signal pills — shown when expanded (auto-expanded when dirty) */}
            {expanded && !loading && signals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {signals.map(s => (
                        <span
                            key={s.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-tp-xxs font-bold"
                            style={{
                                background: s.clean
                                    ? 'color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)'
                                    : 'color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)',
                                color: s.clean
                                    ? 'var(--app-success, #22c55e)'
                                    : 'var(--app-warning, #f59e0b)',
                            }}
                            title={s.detail || (s.clean ? 'OK' : `${s.count} issue(s) — expand for detail`)}
                        >
                            {s.label}
                            {!s.clean && s.count > 0 && (
                                <span className="tabular-nums">· {s.count}</span>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {/* Expanded detail drawer */}
            {expanded && detail && !loading && (
                <div className="mt-3 space-y-2 pt-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                    {detail.parent_offenders_top && detail.parent_offenders_top.length > 0 && (
                        <DetailSection title="Parent-balance offenders (top 3)" rows={detail.parent_offenders_top} columns={['scope', 'code', 'name', 'net', 'n_lines']} />
                    )}
                    {detail.subledger_offenders_top && detail.subledger_offenders_top.length > 0 && (
                        <DetailSection title="Sub-ledger offenders (top 3)" rows={detail.subledger_offenders_top} columns={['scope', 'code', 'name', 'kind', 'n_lines', 'net']} />
                    )}
                    {detail.snapshot_chain_breaks_top && detail.snapshot_chain_breaks_top.length > 0 && (
                        <DetailSection title="Snapshot chain breaks" rows={detail.snapshot_chain_breaks_top} columns={['snapshot_id', 'scope', 'kind', 'stored_hash', 'computed_hash']} />
                    )}
                    {detail.balance_integrity_drifts_top && detail.balance_integrity_drifts_top.length > 0 && (
                        <DetailSection title="Balance drifts (top 3)" rows={detail.balance_integrity_drifts_top} columns={['code', 'name', 'field', 'stored', 'recomputed', 'diff']} />
                    )}
                    {allClean && (
                        <div className="text-tp-xs text-center py-2" style={{ color: 'var(--app-muted-foreground)' }}>
                            No issues detected — the close pipeline is ready.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function DetailSection({ title, rows, columns }: { title: string, rows: Array<Record<string, string>>, columns: string[] }) {
    return (
        <div>
            <div className="text-tp-xxs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--app-muted-foreground)' }}>
                {title}
            </div>
            <div className="text-tp-xs font-mono space-y-0.5">
                {rows.map((r, i) => (
                    <div key={i} className="flex gap-3 truncate" style={{ color: 'var(--app-foreground)' }}>
                        {columns.map(c => (
                            <span key={c} className="truncate">
                                <span style={{ color: 'var(--app-muted-foreground)' }}>{c}=</span>
                                {String(r[c] ?? '').slice(0, c.endsWith('_hash') ? 12 : 40)}
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
