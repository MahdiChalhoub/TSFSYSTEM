'use client'

import { BookOpen, ArrowRight, FileText, TrendingUp, DollarSign } from 'lucide-react'
import type { YearSummary } from '@/app/actions/finance/fiscal-year'

interface CloseEntriesPanelProps {
    summary: YearSummary | undefined
}

function fmt(n: number) {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function CloseEntriesPanel({ summary }: CloseEntriesPanelProps) {
    if (!summary) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Loading summary data…</span>
            </div>
        )
    }

    const ce = summary.closing_entry
    const obSent = summary.opening_balances || []
    const obReceived = summary.opening_balances_received || []
    const obEntries = summary.opening_entries || []
    const obEntriesReceived = summary.opening_entries_received || []
    const hasClosingEntry = !!ce
    const hasOBSent = obSent.length > 0
    const hasOBReceived = obReceived.length > 0
    const isEmpty = !hasClosingEntry && !hasOBSent && !hasOBReceived

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
            {isEmpty ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                        background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                    }}>
                        <BookOpen size={18} style={{ color: 'var(--app-muted-foreground)' }} />
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                        No close entries yet
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--app-muted-foreground)', opacity: 0.6 }}>
                        Close entries appear after year-end close is executed
                    </span>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {/* ── Section 1: Closing Entry (P&L → Retained Earnings) ── */}
                    {hasClosingEntry && (
                        <div style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <SectionHeader icon={TrendingUp} label="Closing Entry — P&L → Retained Earnings"
                                color="var(--app-warning, #f59e0b)" />
                            {/* JE reference card */}
                            <div className="px-5 py-2">
                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{
                                    background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)',
                                }}>
                                    <FileText size={14} style={{ color: 'var(--app-warning, #f59e0b)', flexShrink: 0 }} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-black" style={{ color: 'var(--app-foreground)' }}>{ce.reference}</div>
                                        <div className="text-[10px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>{ce.description}</div>
                                    </div>
                                    <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {new Date(ce.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                            {/* Lines table */}
                            <LinesTable lines={ce.lines} />
                        </div>
                    )}

                    {/* ── Section 2: Opening Balances Sent → Next Year ── */}
                    {hasOBSent && (
                        <div style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <SectionHeader icon={ArrowRight} label={`Opening Balances Sent${summary.opening_balances_target ? ` → ${summary.opening_balances_target}` : ''}`}
                                color="var(--app-success, #22c55e)" />
                            {/* OB JE references */}
                            {obEntries.length > 0 && (
                                <div className="px-5 py-2 flex flex-wrap gap-2">
                                    {obEntries.map(e => (
                                        <div key={e.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{
                                            background: 'color-mix(in srgb, var(--app-success, #22c55e) 4%, transparent)',
                                            border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)',
                                        }}>
                                            <FileText size={12} style={{ color: 'var(--app-success, #22c55e)' }} />
                                            <span className="text-[10px] font-bold" style={{ color: 'var(--app-foreground)' }}>{e.reference}</span>
                                            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded" style={{
                                                color: 'var(--app-success, #22c55e)',
                                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)',
                                            }}>{e.scope}</span>
                                            <span className="text-[9px] font-mono tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                                {e.line_count} lines · DR {fmt(e.total_debit)} / CR {fmt(e.total_credit)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <BalanceTable rows={obSent} />
                        </div>
                    )}

                    {/* ── Section 3: Opening Balances Received from Prior Year ── */}
                    {hasOBReceived && (
                        <div style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <SectionHeader icon={DollarSign} label="Opening Balances Received from Prior Year"
                                color="var(--app-info, #3b82f6)" />
                            {obEntriesReceived.length > 0 && (
                                <div className="px-5 py-2 flex flex-wrap gap-2">
                                    {obEntriesReceived.map(e => (
                                        <div key={e.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{
                                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, transparent)',
                                            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',
                                        }}>
                                            <FileText size={12} style={{ color: 'var(--app-info, #3b82f6)' }} />
                                            <span className="text-[10px] font-bold" style={{ color: 'var(--app-foreground)' }}>{e.reference}</span>
                                            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded" style={{
                                                color: 'var(--app-info, #3b82f6)',
                                                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                            }}>{e.scope}</span>
                                            <span className="text-[9px] font-mono tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                                {e.line_count} lines · DR {fmt(e.total_debit)} / CR {fmt(e.total_credit)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <BalanceTable rows={obReceived} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/* ── Sub-components ── */

function SectionHeader({ icon: Icon, label, color }: { icon: typeof BookOpen; label: string; color: string }) {
    return (
        <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: `color-mix(in srgb, ${color} 3%, transparent)` }}>
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}>
                <Icon size={12} style={{ color }} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.06em]" style={{ color }}>{label}</span>
        </div>
    )
}

function LinesTable({ lines }: { lines: { code: string; name: string; debit: number; credit: number }[] }) {
    const totalDr = lines.reduce((s, l) => s + l.debit, 0)
    const totalCr = lines.reduce((s, l) => s + l.credit, 0)
    return (
        <div className="px-5 pb-3">
            <table className="w-full text-[10px]">
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <th className="text-left px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Code</th>
                        <th className="text-left px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Account</th>
                        <th className="text-right px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Debit</th>
                        <th className="text-right px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Credit</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.map((l, i) => (
                        <tr key={i} className="transition-colors hover:bg-[color-mix(in_srgb,var(--app-surface)_40%,transparent)]"
                            style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <td className="px-2 py-1.5 font-mono font-bold tabular-nums" style={{ color: 'var(--app-primary)' }}>{l.code}</td>
                            <td className="px-2 py-1.5 font-bold truncate max-w-[300px]" style={{ color: 'var(--app-foreground)' }}>{l.name}</td>
                            <td className="px-2 py-1.5 font-mono font-bold tabular-nums text-right" style={{ color: l.debit > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', opacity: l.debit > 0 ? 1 : 0.3 }}>{l.debit > 0 ? fmt(l.debit) : '—'}</td>
                            <td className="px-2 py-1.5 font-mono font-bold tabular-nums text-right" style={{ color: l.credit > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', opacity: l.credit > 0 ? 1 : 0.3 }}>{l.credit > 0 ? fmt(l.credit) : '—'}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr style={{ borderTop: '2px solid var(--app-border)' }}>
                        <td className="px-2 py-1.5" colSpan={2}>
                            <span className="text-[9px] font-black uppercase" style={{ color: 'var(--app-muted-foreground)' }}>Totals</span>
                        </td>
                        <td className="px-2 py-1.5 font-mono font-black tabular-nums text-right" style={{ color: 'var(--app-foreground)' }}>{fmt(totalDr)}</td>
                        <td className="px-2 py-1.5 font-mono font-black tabular-nums text-right" style={{ color: 'var(--app-foreground)' }}>{fmt(totalCr)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}

function BalanceTable({ rows }: { rows: { code: string; name: string; type: string; debit: number; credit: number }[] }) {
    const totalDr = rows.reduce((s, r) => s + r.debit, 0)
    const totalCr = rows.reduce((s, r) => s + r.credit, 0)
    return (
        <div className="px-5 pb-3">
            <table className="w-full text-[10px]">
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <th className="text-left px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Code</th>
                        <th className="text-left px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Account</th>
                        <th className="text-left px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Type</th>
                        <th className="text-right px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Debit</th>
                        <th className="text-right px-2 py-1.5 font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--app-muted-foreground)' }}>Credit</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className="transition-colors hover:bg-[color-mix(in_srgb,var(--app-surface)_40%,transparent)]"
                            style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <td className="px-2 py-1.5 font-mono font-bold tabular-nums" style={{ color: 'var(--app-primary)' }}>{r.code}</td>
                            <td className="px-2 py-1.5 font-bold truncate max-w-[250px]" style={{ color: 'var(--app-foreground)' }}>{r.name}</td>
                            <td className="px-2 py-1.5">
                                <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded" style={{
                                    color: 'var(--app-muted-foreground)',
                                    background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                                }}>{r.type}</span>
                            </td>
                            <td className="px-2 py-1.5 font-mono font-bold tabular-nums text-right" style={{ color: r.debit > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', opacity: r.debit > 0 ? 1 : 0.3 }}>{r.debit > 0 ? fmt(r.debit) : '—'}</td>
                            <td className="px-2 py-1.5 font-mono font-bold tabular-nums text-right" style={{ color: r.credit > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', opacity: r.credit > 0 ? 1 : 0.3 }}>{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr style={{ borderTop: '2px solid var(--app-border)' }}>
                        <td className="px-2 py-1.5" colSpan={3}>
                            <span className="text-[9px] font-black uppercase" style={{ color: 'var(--app-muted-foreground)' }}>Totals ({rows.length} accounts)</span>
                        </td>
                        <td className="px-2 py-1.5 font-mono font-black tabular-nums text-right" style={{ color: 'var(--app-foreground)' }}>{fmt(totalDr)}</td>
                        <td className="px-2 py-1.5 font-mono font-black tabular-nums text-right" style={{ color: 'var(--app-foreground)' }}>{fmt(totalCr)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
