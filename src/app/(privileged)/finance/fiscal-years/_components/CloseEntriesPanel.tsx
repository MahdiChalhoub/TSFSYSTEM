'use client'

import { BookOpen, ArrowRight, FileText, TrendingUp, DollarSign } from 'lucide-react'
import type { YearSummary } from '@/app/actions/finance/fiscal-year'
import { useScope } from '@/hooks/useScope'

interface CloseEntriesPanelProps {
    summary: YearSummary | undefined
}

function fmt(n: number) {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// Strip the redundant "(OFFICIAL)" / "(INTERNAL)" tag from a JE description
// when the user is already in that view — they don't need to be told the scope
// of an entry they're already filtering for.
function _stripScopeTag(s: string | undefined | null): string {
    if (!s) return ''
    return s.replace(/\s*\((OFFICIAL|INTERNAL)\)\s*/i, ' ').replace(/\s+/g, ' ').trim()
}

export function CloseEntriesPanel({ summary }: CloseEntriesPanelProps) {
    const { isOfficial } = useScope()
    if (!summary) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Loading summary data…</span>
            </div>
        )
    }

    const closingEntries = summary.closing_entries || (summary.closing_entry ? [summary.closing_entry] : [])
    const obSent = summary.opening_balances || []
    const obReceived = summary.opening_balances_received || []
    const obEntries = summary.opening_entries || []
    const obEntriesReceived = summary.opening_entries_received || []
    const hasClosingEntry = closingEntries.length > 0
    const hasOBSent = obSent.length > 0
    const hasOBReceived = obReceived.length > 0
    const yearStatus = summary.year?.status || 'OPEN'
    const isClosed = yearStatus === 'CLOSED' || summary.year?.is_hard_locked

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {/* ── P&L Snapshot ── Always visible, dual view when closed */}
                <div style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <SectionHeader icon={TrendingUp} label="P&L Summary — Business Activity" color="var(--app-primary)" />
                    <div className="px-5 py-3 grid grid-cols-3 gap-3">
                        <KpiChip label="Revenue" value={summary.pnl?.revenue ?? 0} color="var(--app-success, #22c55e)" />
                        <KpiChip label="Expenses" value={summary.pnl?.expenses ?? 0} color="var(--app-error, #ef4444)" />
                        <KpiChip label="Net Income" value={summary.pnl?.net_income ?? 0}
                            color={(summary.pnl?.net_income ?? 0) >= 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)'} />
                    </div>
                    {/* Post-close row — only shows when closing JE exists */}
                    {hasClosingEntry && summary.pnl_post_close && (
                        <>
                            <div className="px-5 pb-1">
                                <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
                                    After Closing Entry
                                </span>
                            </div>
                            <div className="px-5 pb-3 grid grid-cols-3 gap-3">
                                <KpiChip label="Revenue" value={summary.pnl_post_close.revenue} color="var(--app-muted-foreground)" />
                                <KpiChip label="Expenses" value={summary.pnl_post_close.expenses} color="var(--app-muted-foreground)" />
                                <KpiChip label="Net Income" value={summary.pnl_post_close.net_income} color="var(--app-muted-foreground)" />
                            </div>
                        </>
                    )}
                </div>

                {/* ── Closing Entries (P&L → Retained Earnings) — one per scope ── */}
                {hasClosingEntry && closingEntries.map((ce, idx) => (
                    <div key={ce.id || idx} style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <SectionHeader
                            icon={BookOpen}
                            label={isOfficial ? 'Closing JE' : `Closing JE — ${ce.scope || 'OFFICIAL'}`}
                            color="var(--app-warning, #f59e0b)"
                        />
                        <div className="px-5 py-2">
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)',
                            }}>
                                <FileText size={14} style={{ color: 'var(--app-warning, #f59e0b)', flexShrink: 0 }} />
                                <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                        {ce.reference}
                                        {!isOfficial && (
                                            <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{
                                                background: ce.scope === 'INTERNAL'
                                                    ? 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)'
                                                    : 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)',
                                                color: ce.scope === 'INTERNAL' ? 'var(--app-info, #3b82f6)' : 'var(--app-success, #22c55e)',
                                            }}>{ce.scope || 'OFFICIAL'}</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {isOfficial ? _stripScopeTag(ce.description) : ce.description}
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {new Date(ce.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                        <LinesTable lines={ce.lines} />
                    </div>
                ))}

                {/* ── No closing JE — show why ── */}
                {!hasClosingEntry && (
                    <div style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <SectionHeader icon={BookOpen} label="Closing JE — P&L → Retained Earnings"
                            color="var(--app-muted-foreground)" />
                        <div className="px-5 py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                                background: 'color-mix(in srgb, var(--app-muted-foreground) 6%, transparent)',
                            }}>
                                <BookOpen size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                            </div>
                            <div>
                                <div className="text-[11px] font-bold" style={{ color: 'var(--app-foreground)' }}>
                                    {isClosed ? 'Year was soft-closed' : 'Year-end close not yet executed'}
                                </div>
                                <div className="text-[10px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {isClosed
                                        ? 'This year was closed without a P&L closing entry. Run Year-End Close to generate retained earnings and opening balances.'
                                        : 'Execute Year-End Close to generate the closing journal entry, transfer P&L to retained earnings, and create opening balances for the next year.'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Opening Balances Sent → Next Year ── */}
                {hasOBSent && (
                    <div style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <SectionHeader icon={ArrowRight} label={`Opening Balances Sent${summary.opening_balances_target ? ` → ${summary.opening_balances_target}` : ''}`}
                            color="var(--app-success, #22c55e)" />
                        {obEntries.length > 0 && (
                            <div className="px-5 py-2 flex flex-wrap gap-2">
                                {obEntries.map(e => (
                                    <div key={e.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{
                                        background: 'color-mix(in srgb, var(--app-success, #22c55e) 4%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)',
                                    }}>
                                        <FileText size={12} style={{ color: 'var(--app-success, #22c55e)' }} />
                                        <span className="text-[10px] font-bold" style={{ color: 'var(--app-foreground)' }}>{e.reference}</span>
                                        {!isOfficial && (
                                            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded" style={{
                                                color: 'var(--app-success, #22c55e)',
                                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)',
                                            }}>{e.scope}</span>
                                        )}
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

                {/* ── Opening Balances Received from Prior Year ── */}
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
                                        {!isOfficial && (
                                            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded" style={{
                                                color: 'var(--app-info, #3b82f6)',
                                                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                            }}>{e.scope}</span>
                                        )}
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
        </div>
    )
}

/* ── Sub-components ── */

function KpiChip({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="rounded-xl px-3 py-2" style={{
            background: `color-mix(in srgb, ${color} 5%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
        }}>
            <div className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
            <div className="text-[14px] font-black tabular-nums" style={{ color }}>{fmt(value)}</div>
        </div>
    )
}

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
