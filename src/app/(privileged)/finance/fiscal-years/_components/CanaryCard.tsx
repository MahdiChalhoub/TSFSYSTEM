'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, RefreshCw, Loader2, ChevronRight, Activity, AlertTriangle, Lightbulb } from 'lucide-react'
import { getIntegrityCanary, type CanaryReport } from '@/app/actions/finance/fiscal-year'

type Signal = { key: string; label: string; group: string; clean: boolean; count: number; detail?: string; fix?: string }

const GROUPS = [
    { id: 'ledger', label: 'Ledger' },
    { id: 'balance', label: 'Balance' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'close', label: 'Close Pipeline' },
]

function buildSignals(d: CanaryReport['details'][number]): Signal[] {
    return [
        { key: 'ob_je_chain', label: 'OB ↔ JE chain', group: 'ledger', clean: d.safe, count: d.years_drift + d.years_missing_je, detail: d.first_broken_year ? `First broken: ${d.first_broken_year}` : undefined, fix: 'Go to Opening Balances and re-post the OB entry for the broken year, then re-run this check.' },
        { key: 'parent_purity', label: 'Parent-balance purity', group: 'ledger', clean: d.parent_purity_clean, count: d.parent_offender_count, fix: 'Review the offending parent accounts below — they have direct journal lines. Move those lines to their child (leaf) accounts instead.' },
        { key: 'subledger', label: 'Sub-ledger integrity', group: 'ledger', clean: d.subledger_clean, count: d.subledger_offender_count, fix: 'These sub-ledger accounts have lines that don\'t match their expected posting pattern. Reconcile or reclassify the entries.' },
        { key: 'snapshot_chain', label: 'Snapshot hash chain', group: 'balance', clean: d.snapshot_chain_clean, count: d.snapshot_chain_breaks, detail: `${d.snapshot_chain_rows} row(s) checked`, fix: 'A snapshot was modified after capture. Re-close the affected period to regenerate a valid snapshot hash.' },
        { key: 'balance_integrity', label: 'Balance vs recompute', group: 'balance', clean: d.balance_integrity_clean, count: d.balance_integrity_drifted_accounts, fix: 'Stored balances are stale. Go to Settings → Maintenance and run "Recompute All Balances" to sync them.' },
        { key: 'fx_integrity', label: 'FX revaluation', group: 'compliance', clean: d.fx_integrity_clean ?? true, count: (d.fx_stale_rate_lines ?? 0) + (d.fx_missing_revaluations ?? 0) + (d.fx_orphaned_revaluations ?? 0), fix: 'Update exchange rates to the latest values and run FX revaluation for the current period.' },
        { key: 'revenue_recognition', label: 'Revenue recognition', group: 'compliance', clean: d.revenue_recognition_clean ?? true, count: (d.revenue_overdue_rows ?? 0) + (d.revenue_orphan_obligations ?? 0) + (d.revenue_over_recognised ?? 0), fix: 'Process overdue revenue recognition schedules and resolve any orphaned or over-recognised obligations.' },
        { key: 'consolidation', label: 'Consolidation', group: 'compliance', clean: d.consolidation_clean ?? true, count: (d.consolidation_failed_runs ?? 0) + (d.consolidation_missing_ic ?? 0) + (d.consolidation_missing_runs ?? 0), fix: 'Re-run consolidation for the failed periods. Ensure all inter-company eliminations are mapped.' },
        { key: 'close_checklist', label: 'Close checklist', group: 'close', clean: d.close_checklist_clean ?? true, count: (d.close_checklist_abandoned ?? 0) + (d.close_checklist_overdue ?? 0), fix: 'Go to the Checklist tab and complete or dismiss the overdue/abandoned checklist items.' },
        { key: 'realized_fx', label: 'Realized FX', group: 'close', clean: d.realized_fx_clean ?? true, count: d.realized_fx_missing ?? 0, fix: 'Post realized FX gain/loss entries for the settled foreign-currency transactions before closing.' },
        { key: 'tax_coverage', label: 'Tax country coverage', group: 'close', clean: d.tax_coverage_clean ?? true, count: d.tax_uncovered_countries ?? 0, detail: d.tax_uncovered_top?.length ? `Missing: ${d.tax_uncovered_top.join(', ')}` : undefined, fix: 'Add tax mappings for the uncovered countries in Settings → Tax Configuration.' },
    ]
}

export function CanaryCard() {
    const [report, setReport] = useState<CanaryReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

    const run = async () => {
        setLoading(true)
        try { setReport(await getIntegrityCanary()) } finally { setLoading(false) }
    }

    useEffect(() => { void run() }, [])

    const detail = report?.details?.[0]
    const signals = detail ? buildSignals(detail) : []
    const passCount = signals.filter(s => s.clean).length
    const totalCount = signals.length
    const allClean = passCount === totalCount
    const score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0

    // Auto-expand first dirty group
    useEffect(() => {
        if (!loading && detail && !allClean) {
            const firstDirty = signals.find(s => !s.clean)
            if (firstDirty && !expandedGroup) setExpandedGroup(firstDirty.group)
        }
    }, [loading, detail]) // eslint-disable-line

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
            {/* ── Score Header ── */}
            <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--app-border)' }}>
                {/* Score ring */}
                <div className="relative flex-shrink-0" style={{ width: 40, height: 40 }}>
                    <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3"
                            stroke="color-mix(in srgb, var(--app-border) 60%, transparent)" />
                        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3"
                            stroke={allClean ? 'var(--app-success, #22c55e)' : score >= 70 ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)'}
                            strokeDasharray={`${score * 0.974} 100`}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-black tabular-nums" style={{
                            color: allClean ? 'var(--app-success, #22c55e)' : score >= 70 ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)'
                        }}>
                            {loading ? '—' : `${score}`}
                        </span>
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-black" style={{ color: 'var(--app-foreground)' }}>
                        Integrity Score
                    </div>
                    <div className="text-[10px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                        {loading ? 'Scanning…' : allClean
                            ? `All ${totalCount} checks passed — books are clean`
                            : `${totalCount - passCount} of ${totalCount} check${totalCount - passCount === 1 ? '' : 's'} need attention`}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {report?.ran_at && (
                        <span className="text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded" style={{
                            color: 'var(--app-muted-foreground)',
                            background: 'color-mix(in srgb, var(--app-border) 40%, transparent)'
                        }}>
                            {new Date(report.ran_at).toLocaleTimeString()}
                        </span>
                    )}
                    <button onClick={() => void run()} disabled={loading}
                        className="p-1.5 rounded-lg transition-all hover:opacity-70 disabled:opacity-30"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }} title="Re-scan">
                        <RefreshCw size={12} style={{ color: 'var(--app-muted-foreground)' }} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex-1 flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--app-muted-foreground)' }} />
                    <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Running 11 integrity checks…</span>
                </div>
            )}

            {/* ── Signal Groups ── */}
            {!loading && signals.length > 0 && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {GROUPS.map(g => {
                        const groupSignals = signals.filter(s => s.group === g.id)
                        if (groupSignals.length === 0) return null
                        const groupClean = groupSignals.every(s => s.clean)
                        const groupDirty = groupSignals.filter(s => !s.clean).length
                        const isExpanded = expandedGroup === g.id

                        return (
                            <div key={g.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                                {/* Group header */}
                                <button onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
                                    className="w-full flex items-center gap-2.5 px-5 py-2.5 text-left transition-all group"
                                    style={{ background: isExpanded ? 'color-mix(in srgb, var(--app-surface) 80%, transparent)' : 'transparent' }}>
                                    {/* Status dot */}
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                                        background: groupClean ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)',
                                        boxShadow: groupClean ? '0 0 6px var(--app-success, #22c55e)' : '0 0 6px var(--app-warning, #f59e0b)',
                                    }} />
                                    <span className="text-[11px] font-black uppercase tracking-[0.08em] flex-1" style={{ color: 'var(--app-foreground)' }}>
                                        {g.label}
                                    </span>
                                    {/* Inline status chips */}
                                    <div className="flex items-center gap-1">
                                        {groupClean ? (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                                                color: 'var(--app-success, #22c55e)',
                                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)',
                                            }}>ALL PASS</span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tabular-nums" style={{
                                                color: 'var(--app-warning, #f59e0b)',
                                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                            }}>{groupDirty} ISSUE{groupDirty > 1 ? 'S' : ''}</span>
                                        )}
                                    </div>
                                    <ChevronRight size={12} style={{
                                        color: 'var(--app-muted-foreground)',
                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 150ms',
                                    }} />
                                </button>

                                {/* Expanded signal rows */}
                                {isExpanded && (
                                    <div className="px-5 pb-3">
                                        {groupSignals.map(s => (
                                            <div key={s.key} className="py-1.5" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                                <div className="flex items-center gap-2.5">
                                                    {/* Status indicator */}
                                                    {s.clean ? (
                                                        <ShieldCheck size={13} style={{ color: 'var(--app-success, #22c55e)', flexShrink: 0 }} />
                                                    ) : (
                                                        <AlertTriangle size={13} style={{ color: 'var(--app-warning, #f59e0b)', flexShrink: 0 }} />
                                                    )}
                                                    <span className="text-[11px] font-bold flex-1" style={{ color: s.clean ? 'var(--app-foreground)' : 'var(--app-warning, #f59e0b)' }}>
                                                        {s.label}
                                                    </span>
                                                    {/* Count badge */}
                                                    {!s.clean && s.count > 0 && (
                                                        <span className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-full" style={{
                                                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)',
                                                            color: 'var(--app-warning, #f59e0b)',
                                                        }}>{s.count}</span>
                                                    )}
                                                    {s.clean && (
                                                        <span className="text-[9px] font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>✓</span>
                                                    )}
                                                    {/* Detail */}
                                                    {s.detail && (
                                                        <span className="text-[9px] font-medium truncate max-w-[140px]" style={{ color: 'var(--app-muted-foreground)' }}>
                                                            {s.detail}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Fix hint — only for dirty signals */}
                                                {!s.clean && s.fix && (
                                                    <div className="flex items-start gap-1.5 mt-1 ml-[21px] px-2.5 py-1.5 rounded-lg" style={{
                                                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)',
                                                        border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',
                                                    }}>
                                                        <Lightbulb size={11} className="flex-shrink-0 mt-px" style={{ color: 'var(--app-info, #3b82f6)' }} />
                                                        <span className="text-[10px] font-medium leading-snug" style={{ color: 'var(--app-info, #3b82f6)' }}>
                                                            {s.fix}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Detail tables for this group */}
                                        {g.id === 'ledger' && (
                                            <>
                                                {detail?.parent_offenders_top?.length ? <DetailTable title="Parent offenders" rows={detail.parent_offenders_top} columns={['code', 'name', 'scope', 'net']} /> : null}
                                                {detail?.subledger_offenders_top?.length ? <DetailTable title="Sub-ledger offenders" rows={detail.subledger_offenders_top} columns={['code', 'name', 'scope', 'kind']} /> : null}
                                            </>
                                        )}
                                        {g.id === 'balance' && (
                                            <>
                                                {detail?.balance_integrity_drifts_top?.length ? <DetailTable title="Balance drifts" rows={detail.balance_integrity_drifts_top} columns={['code', 'name', 'stored', 'recomputed', 'diff']} /> : null}
                                                {detail?.snapshot_chain_breaks_top?.length ? <DetailTable title="Chain breaks" rows={detail.snapshot_chain_breaks_top} columns={['scope', 'kind', 'stored_hash', 'computed_hash']} /> : null}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {/* All clean celebration */}
                    {allClean && (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                            }}>
                                <Activity size={18} style={{ color: 'var(--app-success, #22c55e)' }} />
                            </div>
                            <span className="text-[11px] font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>
                                All systems nominal
                            </span>
                            <span className="text-[10px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                Close pipeline is ready — no issues detected
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/** Compact data table for detail rows */
function DetailTable({ title, rows, columns }: { title: string; rows: Array<Record<string, string>>; columns: string[] }) {
    return (
        <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <div className="px-3 py-1.5" style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, transparent)' }}>
                <span className="text-[9px] font-black uppercase tracking-[0.1em]" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                    {title}
                </span>
            </div>
            <table className="w-full text-[10px]">
                <thead>
                    <tr style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        {columns.map(c => (
                            <th key={c} className="text-left px-3 py-1 font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)', fontSize: '9px' }}>
                                {c.replace(/_/g, ' ')}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' : 'none' }}>
                            {columns.map(c => (
                                <td key={c} className="px-3 py-1 font-mono truncate max-w-[160px]" style={{ color: 'var(--app-foreground)' }}>
                                    {String(r[c] ?? '—').slice(0, c.endsWith('_hash') ? 10 : 40)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
